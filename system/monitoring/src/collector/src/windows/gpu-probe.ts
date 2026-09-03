import { spawn } from 'node:child_process';
import type { GPUInfo } from '../../../spec/metrics.types.ts';

const MIB = 1048576;

export interface GpuProbeOptions {
    /** nvidia-smi binary path; resolved via PATH when omitted. */
    binaryPath?: string;
    /** Child-process timeout in ms (AGENTS.md: 3 s). */
    timeoutMs?: number;
    /** State sink: ok=false on missing binary, nonzero exit or parse failure. */
    onState?: (ok: boolean, detail?: string) => void;
}

/**
 * Splits one CSV line into fields, honoring double-quoted fields
 * (doubled "" is an escaped quote) and commas inside quotes.
 */
export function splitCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            fields.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    fields.push(current);
    return fields;
}

const clampPct = (v: number): number => Math.min(100, Math.max(0, v));

/**
 * Parses `nvidia-smi --query-gpu=index,name,utilization.gpu,memory.total,
 * memory.used --format=csv,noheader,nounits` output. One row per GPU;
 * names may contain spaces/quotes. Memory values are MiB and are scaled
 * to bytes. nvidia-smi's own device indices are kept. Malformed rows are
 * skipped; output with content but zero valid rows yields [] (parse
 * failure), which the caller turns into an empty GPU section.
 */
export function parseNvidiaSmiCsv(stdout: string): GPUInfo[] {
    const gpus: GPUInfo[] = [];
    let sawContent = false;
    for (const rawLine of stdout.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line.length === 0) continue;
        sawContent = true;
        const fields = splitCsvLine(line);
        if (fields.length !== 5) continue;
        const index = Number(fields[0]);
        const utilization = Number(fields[2]);
        const memoryTotalMiB = Number(fields[3]);
        const memoryUsedMiB = Number(fields[4]);
        if (
            !Number.isFinite(index) ||
            !Number.isFinite(utilization) ||
            !Number.isFinite(memoryTotalMiB) ||
            !Number.isFinite(memoryUsedMiB)
        ) {
            continue;
        }
        const memoryTotal = memoryTotalMiB * MIB;
        const memoryUsed = memoryUsedMiB * MIB;
        gpus.push({
            index,
            name: fields[1].trim(),
            utilization: clampPct(utilization),
            memoryTotal,
            memoryUsed,
            memoryUtilization: memoryTotal > 0 ? clampPct((memoryUsed / memoryTotal) * 100) : 0
        });
    }
    return sawContent || gpus.length > 0 ? gpus : [];
}

/**
 * NVIDIA GPU probe. Spawns nvidia-smi once per poll (~50–150 ms) and
 * never throws: a missing binary, nonzero exit, timeout or unparseable
 * output degrades to an empty GPU section (AGENTS.md non-goal: AMD/Intel
 * adapters are not probed).
 */
export class GpuProbe {
    private readonly binaryPath: string;
    private readonly timeoutMs: number;
    private readonly onState?: (ok: boolean, detail?: string) => void;

    constructor(options: GpuProbeOptions = {}) {
        this.binaryPath = options.binaryPath ?? 'nvidia-smi';
        this.timeoutMs = options.timeoutMs ?? 3000;
        this.onState = options.onState;
    }

    async getGPUs(): Promise<GPUInfo[]> {
        let stdout: string;
        try {
            stdout = await this.query();
        } catch (err) {
            this.onState?.(false, err instanceof Error ? err.message : String(err));
            return [];
        }
        const gpus = parseNvidiaSmiCsv(stdout);
        if (gpus.length === 0) {
            this.onState?.(false, 'unparseable or empty nvidia-smi output');
            return [];
        }
        this.onState?.(true);
        return gpus;
    }

    private query(): Promise<string> {
        return new Promise((resolve, reject) => {
            const child = spawn(this.binaryPath, [
                '--query-gpu=index,name,utilization.gpu,memory.total,memory.used',
                '--format=csv,noheader,nounits'
            ], { windowsHide: true, timeout: this.timeoutMs, killSignal: 'SIGKILL' });
            let out = '';
            let settled = false;
            const fail = (err: Error): void => {
                if (!settled) {
                    settled = true;
                    reject(err);
                }
            };
            child.on('error', fail); // ENOENT etc.
            child.stdout.on('data', (chunk: Buffer) => {
                out += chunk.toString();
            });
            child.on('close', (code) => {
                if (settled) return;
                settled = true;
                if (code !== 0) {
                    reject(new Error(`nvidia-smi exited with code ${code}`));
                    return;
                }
                resolve(out);
            });
        });
    }
}
