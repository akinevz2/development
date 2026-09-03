import type { AllMetrics } from '../../spec/metrics.types.ts';

/**
 * Shared frame renderer — the single source of ASCII graph rendering.
 * Consumed by both the browser pseudo-terminal (xterm.js) and the TUI,
 * guaranteeing both pipelines draw identical graphs from AllMetrics.
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

const fmtRate = (n: number): string => `${fmtBytes(n)}/s`;

/** Pure function: AllMetrics -> ASCII frame (newline-terminated lines). */
export function renderFrame(metrics: AllMetrics, options: FrameOptions = {}): string {
    const width = options.barWidth ?? 24;
    const lines: string[] = [];

    lines.push(`SYSTEM MONITOR  ${new Date(metrics.timestamp).toISOString()}`);
    lines.push('='.repeat(64));

    if (metrics.cpu?.totalUsage) {
        const cpu = metrics.cpu;
        lines.push(`CPU     [${bar(cpu.systemUsage, width)}] ${cpu.systemUsage.toFixed(1)}%`);
        lines.push(
            `        cores=${cpu.coreCount} threads=${cpu.threadCount}` +
                (cpu.loadAverage ? ` load=${cpu.loadAverage.oneMinute.toFixed(2)}` : '')
        );
    }

    if (metrics.memory?.total) {
        const mem = metrics.memory;
        lines.push(`MEM     [${bar(mem.allocationRatio, width)}] ${mem.allocationRatio.toFixed(1)}%`);
        lines.push(
            `        used=${fmtBytes(mem.used)} total=${fmtBytes(mem.total)} swap=${mem.swapAllocationRatio.toFixed(1)}%`
        );
    }

    for (const gpu of metrics.gpu?.gpuUsage ?? []) {
        lines.push(
            `GPU${gpu.index}   [${bar(gpu.utilization, width)}] ${gpu.utilization.toFixed(1)}%` +
                `  VRAM ${fmtBytes(gpu.memoryUsed)}/${fmtBytes(gpu.memoryTotal)}`
        );
    }

    if (metrics.ollama) {
        const om = metrics.ollama;
        if (om.isRunning) {
            const model = om.currentModel ? ` model=${om.currentModel.name}` : '';
            lines.push(`OLLAMA  running${model} loaded=${om.loadedModels.length} available=${om.availableModels.length}`);
            for (const m of om.loadedModels) {
                lines.push(`        ${m.name} (${fmtBytes(m.size)}${m.quantization ? `, ${m.quantization}` : ''})`);
            }
        } else {
            lines.push(`OLLAMA  offline${om.error ? ` (${om.error})` : ''}`);
        }
    }

    for (const [name, iface] of Object.entries(metrics.network?.interfaces ?? {})) {
        lines.push(`NET     ${name} rx=${fmtRate(iface.rxSpeed)} tx=${fmtRate(iface.txSpeed)}`);
    }

    for (const disk of metrics.disks?.disks ?? []) {
        lines.push(`DISK    ${disk.mount} [${bar(disk.usagePercent, 10)}] ${disk.usagePercent.toFixed(0)}%`);
    }

    lines.push('='.repeat(64));

    return lines.map((l) => l + '\n').join('');
}
