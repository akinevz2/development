import type { AllMetrics } from '../../spec/metrics.types.ts';

/**
 * Shared frame renderer — the single source of ASCII graph rendering.
 * Consumed by both the browser pseudo-terminal (xterm.js) and the TUI,
 * guaranteeing both pipelines draw identical graphs from AllMetrics.
 *
 * Graph restriction: frontends graph ONLY cpu, mem, gpu0 and gpu1.
 * The collector/API may still serve the full specification (ollama,
 * network, disks) — those sections are intentionally not graphed here.
 */

export interface FrameOptions {
    /** Width of the usage bars, in cells. */
    barWidth?: number;
}

const bar = (pct: number, width: number): string => {
    const clamped = Math.min(100, Math.max(0, pct));
    const filled = Math.round((clamped / 100) * width);
    return '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
};

const fmtBytes = (n: number): string => {
    if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)}GiB`;
    if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)}MiB`;
    if (n >= 1024) return `${(n / 1024).toFixed(0)}KiB`;
    return `${n}B`;
};

/** Pure function: AllMetrics -> ASCII frame (newline-terminated lines).
 *  Renders the fixed graph set CPU, MEM, GPU0, GPU1 — empty bars when
 *  data is missing (disconnected state). */
export function renderFrame(metrics: AllMetrics, options: FrameOptions = {}): string {
    const width = options.barWidth ?? 24;
    const lines: string[] = [];

    lines.push(`SYSTEM MONITOR  ${new Date(metrics.timestamp).toISOString()}`);
    lines.push('='.repeat(64));

    const cpu = metrics.cpu;
    lines.push(`CPU     [${bar(cpu?.systemUsage ?? 0, width)}] ${(cpu?.systemUsage ?? 0).toFixed(1)}%`);
    lines.push(
        `        cores=${cpu?.coreCount ?? 0} threads=${cpu?.threadCount ?? 0}` +
            (cpu?.loadAverage ? ` load=${cpu.loadAverage.oneMinute.toFixed(2)}` : '')
    );

    const mem = metrics.memory;
    lines.push(`MEM     [${bar(mem?.allocationRatio ?? 0, width)}] ${(mem?.allocationRatio ?? 0).toFixed(1)}%`);
    lines.push(
        `        used=${fmtBytes(mem?.used ?? 0)} total=${fmtBytes(mem?.total ?? 0)} swap=${(mem?.swapAllocationRatio ?? 0).toFixed(1)}%`
    );

    const gpus = metrics.gpu?.gpuUsage ?? [];
    for (const index of [0, 1]) {
        const gpu = gpus.find((g) => g.index === index);
        lines.push(
            `GPU${index}   [${bar(gpu?.utilization ?? 0, width)}] ${(gpu?.utilization ?? 0).toFixed(1)}%` +
                `  VRAM ${fmtBytes(gpu?.memoryUsed ?? 0)}/${fmtBytes(gpu?.memoryTotal ?? 0)}`
        );
    }

    lines.push('='.repeat(64));

    return lines.map((l) => l + '\n').join('');
}
