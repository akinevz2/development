import { spawn } from 'node:child_process';
import { cpus, freemem, totalmem } from 'node:os';
import type { CPUMetrics, MemoryMetrics } from '../../../spec/metrics.types.ts';

export interface ProbeOptions {
    /** PowerShell invocation timeout in ms. */
    timeoutMs?: number;
}

/** Runs `powershell.exe -NoProfile -NonInteractive -Command <script>` and
 *  resolves stdout, or null on spawn error, timeout or nonzero exit.
 *  The 5 s default absorbs a cold PowerShell start (~2–3 s); warm WMI
 *  calls return in ~100–300 ms. */
function runPowerShell(script: string, timeoutMs: number): Promise<string | null> {
    return new Promise((resolve) => {
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
            windowsHide: true,
            timeout: timeoutMs,
            killSignal: 'SIGKILL'
        });
        let out = '';
        let settled = false;
        const done = (value: string | null): void => {
            if (!settled) {
                settled = true;
                resolve(value);
            }
        };
        child.on('error', () => done(null)); // spawn failure (no PowerShell)
        child.stdout.on('data', (chunk: Buffer) => {
            out += chunk.toString();
        });
        child.on('close', (code) => done(code === 0 ? out : null));
    });
}

const clampPct = (v: number): number => Math.min(100, Math.max(0, v));

export interface CpuSampleDelta {
    idle: number;
    user: number;
    total: number;
}

/**
 * Derives CPUMetrics from an os.cpus() snapshot plus the previous
 * snapshot's deltas. Pure so synthetic os.cpus()-shaped fixtures can
 * drive tests. First poll (no previous sample) and degenerate windows
 * (Δtotal ≤ 0) return valid zero usage: systemUsage 0, idleUsage 100 —
 * keeping `systemUsage + idleUsage = totalUsage` exact. loadAverage is
 * omitted on Windows (optional in the spec).
 */
export function cpuMetricsFromSnapshots(
    now: ReturnType<typeof cpus>,
    previous: { idle: number; user: number; total: number } | null,
    coreCount: number,
    timestamp: number
): CPUMetrics {
    let idle = 0;
    let user = 0;
    let total = 0;
    for (const cpu of now) {
        idle += cpu.times.idle;
        user += cpu.times.user;
        total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
    }
    if (previous === null || total - previous.total <= 0) {
        return {
            timestamp,
            systemUsage: 0,
            userUsage: 0,
            idleUsage: 100,
            totalUsage: 100,
            threadCount: now.length,
            coreCount
        };
    }
    const dIdle = idle - previous.idle;
    const dUser = user - previous.user;
    const dTotal = total - previous.total;
    const idleUsage = clampPct((dIdle / dTotal) * 100);
    return {
        timestamp,
        // systemUsage is 100 − idleUsage EXACTLY (spec invariant)
        systemUsage: 100 - idleUsage,
        userUsage: clampPct((dUser / dTotal) * 100),
        idleUsage,
        totalUsage: 100,
        threadCount: now.length,
        coreCount
    };
}

/**
 * CPU probe: per-poll deltas of os.cpus() times. coreCount comes from
 * WMI Win32_Processor.NumberOfCores summed over sockets, resolved once
 * and cached (fallback: NUMBER_OF_PROCESSORS, then logical threads).
 */
export class CpuProbe {
    private previous: { idle: number; user: number; total: number } | null = null;
    private coreCount: number | null = null;
    private readonly timeoutMs: number;

    constructor(options: ProbeOptions = {}) {
        this.timeoutMs = options.timeoutMs ?? 5000;
    }

    async getMetrics(): Promise<CPUMetrics> {
        const snapshot = cpus();
        const coreCount = await this.resolveCoreCount();
        const metrics = cpuMetricsFromSnapshots(snapshot, this.previous, coreCount, Date.now());
        let idle = 0;
        let user = 0;
        let total = 0;
        for (const cpu of snapshot) {
            idle += cpu.times.idle;
            user += cpu.times.user;
            total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
        }
        this.previous = { idle, user, total };
        return metrics;
    }

    private async resolveCoreCount(): Promise<number> {
        if (this.coreCount !== null) return this.coreCount;
        let resolved = 0;
        const out = await runPowerShell(
            'Get-CimInstance -ClassName Win32_Processor | Select-Object -ExpandProperty NumberOfCores',
            this.timeoutMs
        );
        if (out !== null) {
            for (const line of out.split(/\r?\n/)) {
                const n = Number(line.trim());
                if (Number.isInteger(n) && n > 0) resolved += n;
            }
        }
        if (resolved === 0) {
            const env = Number(process.env.NUMBER_OF_PROCESSORS);
            resolved = Number.isInteger(env) && env > 0 ? env : cpus().length;
        }
        this.coreCount = resolved;
        return resolved;
    }
}

/**
 * Memory probe: plain RAM via os.totalmem()/os.freemem() — zero system
 * calls beyond the OS queries themselves (`available` is avail-phys
 * including standby on Windows; `free` is the documented approximation).
 * Never throws; the OS quantities are always available on Windows.
 */
export class MemoryProbe {
    async getMetrics(): Promise<MemoryMetrics> {
        const total = totalmem();
        const available = freemem();
        const used = total - available;
        return {
            timestamp: Date.now(),
            total,
            used,
            available,
            free: available,
            allocationRatio: total > 0 ? clampPct((used / total) * 100) : 0
        };
    }
}
