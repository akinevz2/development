import type { AllMetrics } from '../../spec/metrics.types.ts';

/**
 * Shared btop-style graph renderer — the single source of graph drawing,
 * consumed identically by the TUI and the browser pseudo-terminal.
 *
 * Layout: CPU and MEM side by side on the first row; each reported GPU
 * gets its own row of two half-width graphs side by side — utilisation
 * and VRAM usage. Graphs are FILLED braille time-series (newest sample
 * in the rightmost column, older samples pushed left, area under the
 * curve solid). An OLLAMA information row follows the graphs: current
 * model, quantization and loaded/available counts. Only cpu, mem and
 * reported GPUs are graphed; the ollama section is displayed as text,
 * not drawn.
 */

export interface GraphGeometry {
    /** Full frame width in graph cells (half-width boxes use floor/2). */
    width: number;
    /** Text rows per graph box (each row = 4 braille dot rows). */
    height: number;
}

export const DEFAULT_GRAPH: GraphGeometry = { width: 50, height: 6 };

/** Columns of left padding on every painted frame line; geometryFor
 *  reserves this budget so padded lines never wrap. */
export const FRAME_PAD = 1;

/**
 * Framebuffer sizing: derives graph geometry from a renderable area
 * (cols x rows) so a frame fills it exactly. Assumes the standard
 * layout: 1 header line + `boxRows` box rows (each `height` graph rows
 * plus 2 border lines) separated by blank lines. `boxesPerRow` is the
 * widest row (default 4 = CPU|MEM plus a two-GPU row packing four
 * quarter-width graphs); the width leaves room for the left frame pad
 * (FRAME_PAD), 2 border characters per box plus 1 gap per extra box.
 */
export function geometryFor(
    cols: number,
    rows: number,
    boxRows: number = 2,
    boxesPerRow: number = 4
): GraphGeometry {
    const usable = Math.max(6, rows - 2);
    const height = Math.max(2, Math.floor((usable - (boxRows - 1)) / boxRows) - 2);
    const width = Math.max(20, cols - FRAME_PAD - (2 * boxesPerRow + boxesPerRow - 1));
    return { width, height };
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Braille dot bitmask per [dot row 0..3][dot col 0=left, 1=right]. */
const DOT_BITS = [
    [0x01, 0x08],
    [0x02, 0x10],
    [0x04, 0x20],
    [0x40, 0x80]
];
const BRAILLE_BLANK = '\u2800';

const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

/**
 * One-line Ollama summary for the information row under the graphs:
 * current model (with quantization) plus loaded/available counts, or
 * `offline` when the service is unreachable.
 */
function ollamaInfoLine(ollama: AllMetrics['ollama'] | undefined): string {
    if (!ollama || !ollama.isRunning) return 'OLLAMA  offline';
    const loaded = ollama.loadedModels.length;
    const available = ollama.availableModels.length;
    const current = ollama.currentModel
        ? `${ollama.currentModel.name}${ollama.currentModel.quantization ? ` (${ollama.currentModel.quantization})` : ''}`
        : 'none loaded';
    return `OLLAMA  ${current} · ${loaded}/${available} loaded`;
}

/**
 * Builds a flicker-free, scroll-free repaint sequence for a rendered
 * frame:
 *  - wrapped in synchronized-output markers (DEC 2026) so supporting
 *    terminals swap the frame atomically — no flashing; ignored elsewhere
 *  - homes the cursor and repaints each line in place, erasing to end
 *    of line (`\x1b[K`) instead of clearing the screen; a line that
 *    already fills the terminal is painted WITHOUT the erase: writing
 *    its last cell leaves the cursor in the deferred-wrap state, where
 *    EL erases that cell (the right border) instead of nothing
 *  - never writes a trailing newline, so the terminal never scrolls and
 *    the scrollback buffer stays fixed; `\x1b[J` clears leftovers below
 *
 * The entire sequence must be written in a single write() call.
 */
export function paintFrame(frame: string, cols?: number): string {
    const lines = (frame.endsWith('\n') ? frame.slice(0, -1) : frame).split('\n');
    const pad = ' '.repeat(FRAME_PAD);
    let out = '\x1b[?2026h\x1b[H';
    out += lines.map((l) => {
        const text = pad + l;
        const erase = cols !== undefined && text.length >= cols ? '' : '\x1b[K';
        return text + erase;
    }).join('\r\n');
    out += '\x1b[J\x1b[?2026l';
    return out;
}

export class MetricsGraphRenderer {
    private width: number;
    private height: number;
    private readonly cpu: number[] = [];
    private readonly mem: number[] = [];
    private readonly gpuUtil = new Map<number, number[]>();
    private readonly gpuVram = new Map<number, number[]>();
    private ollama: string | null = null;
    private timestamp: number | null = null;

    constructor(geometry: Partial<GraphGeometry> = {}) {
        this.width = geometry.width ?? DEFAULT_GRAPH.width;
        this.height = geometry.height ?? DEFAULT_GRAPH.height;
    }

    /** Resizes the framebuffer and re-trims history to the new boxes. */
    resize(geometry: Partial<GraphGeometry>): void {
        if (geometry.width !== undefined) this.width = geometry.width;
        if (geometry.height !== undefined) this.height = geometry.height;
        this.retrim();
    }

    private retrim(): void {
        const pair = this.pairCells();
        const cells = this.cellsFor(this.gpuUtil.size >= 2 ? 2 : 0, false);
        this.trimTo(this.cpu, pair);
        this.trimTo(this.mem, pair);
        for (const series of this.gpuUtil.values()) this.trimTo(series, cells);
        for (const series of this.gpuVram.values()) this.trimTo(series, cells);
    }

    private trimTo(series: number[], cap: number): void {
        while (series.length > cap + 1) series.shift();
    }

    /** Appends one snapshot to every series (history capped to its box). */
    push(metrics: AllMetrics): void {
        this.timestamp = metrics.timestamp;
        const pair = this.pairCells();
        const gpus = metrics.gpu?.gpuUsage ?? [];
        const cells = this.cellsFor(gpus.length, false);

        this.pushTo(this.cpu, (metrics.cpu?.systemUsage ?? 0) / 100, pair);
        this.pushTo(this.mem, (metrics.memory?.allocationRatio ?? 0) / 100, pair);
        for (const g of gpus) {
            let util = this.gpuUtil.get(g.index);
            if (!util) {
                util = [];
                this.gpuUtil.set(g.index, util);
                this.gpuVram.set(g.index, []);
            }
            this.pushTo(util, clamp01(g.utilization / 100), cells);
            this.pushTo(this.gpuVram.get(g.index)!, clamp01((g.memoryUtilization ?? 0) / 100), cells);
        }
        this.ollama = ollamaInfoLine(metrics.ollama);
    }

    /** Drops all history — graphs render empty until the next push. */
    clear(): void {
        this.cpu.length = 0;
        this.mem.length = 0;
        this.gpuUtil.clear();
        this.gpuVram.clear();
        this.ollama = null;
        this.timestamp = null;
    }

    renderFrame(): string {
        const header = `SYSTEM MONITOR  ${this.timestamp === null ? '--' : new Date(this.timestamp).toISOString()}`;
        const lines = [header];

        const pair = this.pairCells();
        lines.push(...this.rowOf([
            this.boxLines('CPU', this.cpu, pair),
            this.boxLines('MEM', this.mem, pair)
        ]));

        const indices = [...this.gpuUtil.keys()].sort((a, b) => a - b);
        const cells = this.cellsFor(indices.length, false);
        for (let i = 0; i < indices.length; i += 2) {
            const chunk = indices.slice(i, i + 2);
            const boxes = chunk.flatMap((idx) => [
                this.boxLines(`GPU${idx} UTIL`, this.gpuUtil.get(idx) ?? [], cells),
                this.boxLines(`GPU${idx} VRAM`, this.gpuVram.get(idx) ?? [], cells)
            ]);
            lines.push('', ...this.rowOf(boxes));
        }

        // information row (not a graph): Ollama model status; placeholder
        // keeps the layout stable while disconnected
        lines.push('', this.ollama ?? 'OLLAMA  —');
        return lines.map((l) => l + '\n').join('');
    }

    /** Cells for a two-box row (CPU|MEM, single-GPU pairs) sized so the
     *  row spans exactly the same width as a four-box row:
     *  2·(2q+3)+5 = 4·q+11. */
    private pairCells(): number {
        return 2 * this.quarterWidth() + 3;
    }

    private quarterWidth(): number {
        return Math.floor(this.width / 4);
    }

    private cellsFor(gpuCount: number, _forGPU: boolean): number {
        return gpuCount >= 2 ? this.quarterWidth() : this.pairCells();
    }

    private pushTo(series: number[], value: number, cap: number): void {
        series.push(clamp01(value));
        this.trimTo(series, cap);
    }

    /** Zips any number of boxes' lines into one row, separated by one
     *  space; boxes in a row share one cell width. */
    private rowOf(boxes: string[][]): string[] {
        const width = boxes[0]?.[0]?.length ?? 0;
        const rows = Math.max(...boxes.map((b) => b.length));
        const out: string[] = [];
        for (let i = 0; i < rows; i++) {
            out.push(boxes.map((b) => (b[i] ?? '').padEnd(width)).join(' '));
        }
        return out;
    }

    private boxLines(name: string, series: number[], cells: number): string[] {
        const title = ` ${name} `;
        const current = series.length > 0 ? series[series.length - 1] : 0;
        let value = ` ${pct(current)} `;
        if (title.length + value.length > cells) value = ` ${Math.round(current * 100)}% `;
        // top border overlays title/value ON the `cells` dashes so the box
        // is exactly `cells + 2` wide — matching the graph rows below it
        const fill = Math.max(0, cells - title.length - value.length);
        const lines = [`╭${title}${'─'.repeat(fill)}${value}╮`];

        // right-aligned history: newest sample in the rightmost cell
        const offset = cells - series.length;
        for (let row = 0; row < this.height; row++) {
            let line = '│';
            for (let cell = 0; cell < cells; cell++) {
                line += this.cell(series, row, cell - offset);
            }
            lines.push(line + '│');
        }
        lines.push(`╰${'─'.repeat(cells)}╯`);
        return lines;
    }

    /**
     * One braille character = one time sample, FILLED bar style: both dot
     * columns are lit from the bottom up to the curve (left column up to
     * the previous sample, right column up to this sample), so the area
     * under the graph is solid and only the top edge follows the data.
     */
    private cell(series: number[], row: number, t: number): string {
        if (t < 0) return BRAILLE_BLANK;
        const dotY = (v: number): number => (1 - v) * (this.height * 4 - 1);
        const yCur = Math.round(dotY(series[t]));
        const yLeftEdge = t >= 1 ? Math.round(dotY(series[t - 1])) : yCur;

        let mask = 0;
        for (let d = 0; d < 4; d++) {
            const yy = row * 4 + d;
            if (yy >= yLeftEdge) mask |= DOT_BITS[d][0];
            if (yy >= yCur) mask |= DOT_BITS[d][1];
        }
        if (mask === 0) return BRAILLE_BLANK;

        const color = series[t] > 0.8 ? '\x1b[31m' : series[t] > 0.5 ? '\x1b[33m' : '\x1b[32m';
        return `${color}${String.fromCharCode(0x2800 + mask)}\x1b[0m`;
    }
}
