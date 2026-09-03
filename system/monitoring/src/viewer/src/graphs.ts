import type { AllMetrics } from '../../spec/metrics.types.ts';

/**
 * Shared btop-style graph renderer — the single source of graph drawing,
 * consumed identically by the TUI and the browser pseudo-terminal.
 *
 * Layout: CPU and MEM side by side on the first row; GPU graph(s) below —
 * full width with one GPU, side by side with two, otherwise stacked
 * full width. Graphs are FILLED braille time-series (newest sample in
 * the rightmost column, older samples pushed left, area under the curve
 * solid). Only cpu, mem and reported GPUs are graphed; the collector/API
 * may still serve the full specification.
 */

export interface GraphGeometry {
    /** Full frame width in graph cells (half-width boxes use floor/2). */
    width: number;
    /** Text rows per graph box (each row = 4 braille dot rows). */
    height: number;
}

export const DEFAULT_GRAPH: GraphGeometry = { width: 50, height: 6 };

/**
 * Framebuffer sizing: derives graph geometry from a renderable area
 * (cols x rows) so a frame fills it exactly. Assumes the standard
 * layout: 1 header line + `boxRows` box rows (each `height` graph rows
 * plus 2 border lines) separated by blank lines, and side-by-side rows
 * spanning width + 5 columns (two boxes, their borders, one gap).
 */
export function geometryFor(cols: number, rows: number, boxRows: number = 2): GraphGeometry {
    const usable = Math.max(6, rows - 2);
    const height = Math.max(2, Math.floor((usable - (boxRows - 1)) / boxRows) - 2);
    const width = Math.max(20, cols - 5);
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
 * Builds a flicker-free, scroll-free repaint sequence for a rendered
 * frame:
 *  - wrapped in synchronized-output markers (DEC 2026) so supporting
 *    terminals swap the frame atomically — no flashing; ignored elsewhere
 *  - homes the cursor and repaints each line in place, erasing to end
 *    of line (`\x1b[K`) instead of clearing the screen
 *  - never writes a trailing newline, so the terminal never scrolls and
 *    the scrollback buffer stays fixed; `\x1b[J` clears leftovers below
 *
 * The entire sequence must be written in a single write() call.
 */
export function paintFrame(frame: string): string {
    const lines = (frame.endsWith('\n') ? frame.slice(0, -1) : frame).split('\n');
    let out = '\x1b[?2026h\x1b[H';
    out += lines.map((l) => l + '\x1b[K').join('\r\n');
    out += '\x1b[J\x1b[?2026l';
    return out;
}

export class MetricsGraphRenderer {
    private width: number;
    private height: number;
    private readonly cpu: number[] = [];
    private readonly mem: number[] = [];
    private readonly gpuSeries = new Map<number, number[]>();
    private gpuCount = 0;
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
        const half = this.halfWidth();
        const gpuCap = this.gpuCount === 2 ? half : this.width;
        this.trimTo(this.cpu, half);
        this.trimTo(this.mem, half);
        for (const series of this.gpuSeries.values()) this.trimTo(series, gpuCap);
    }

    private trimTo(series: number[], cap: number): void {
        while (series.length > cap + 1) series.shift();
    }

    /** Appends one snapshot to every series (history capped to its box). */
    push(metrics: AllMetrics): void {
        this.timestamp = metrics.timestamp;
        const half = this.halfWidth();
        this.gpuCount = metrics.gpu?.totalGPUs ?? metrics.gpu?.gpuUsage?.length ?? 0;
        const gpuCap = this.gpuCount === 2 ? half : this.width;

        this.pushTo(this.cpu, (metrics.cpu?.systemUsage ?? 0) / 100, half);
        this.pushTo(this.mem, (metrics.memory?.allocationRatio ?? 0) / 100, half);
        for (const g of metrics.gpu?.gpuUsage ?? []) {
            let series = this.gpuSeries.get(g.index);
            if (!series) {
                series = [];
                this.gpuSeries.set(g.index, series);
            }
            this.pushTo(series, clamp01(g.utilization / 100), gpuCap);
        }
    }

    /** Drops all history — graphs render empty until the next push. */
    clear(): void {
        this.cpu.length = 0;
        this.mem.length = 0;
        this.gpuSeries.clear();
        this.gpuCount = 0;
        this.timestamp = null;
    }

    renderFrame(): string {
        const header = `SYSTEM MONITOR  ${this.timestamp === null ? '--' : new Date(this.timestamp).toISOString()}`;
        const lines = [header];

        const half = this.halfWidth();
        lines.push(...this.sideBySide(
            this.boxLines('CPU', this.cpu, half),
            this.boxLines('MEM', this.mem, half)
        ));

        if (this.gpuCount === 1) {
            lines.push('', ...this.boxLines('GPU0', this.gpuSeries.get(0) ?? [], this.width));
        } else if (this.gpuCount === 2) {
            lines.push('', ...this.sideBySide(
                this.boxLines('GPU0', this.gpuSeries.get(0) ?? [], half),
                this.boxLines('GPU1', this.gpuSeries.get(1) ?? [], half)
            ));
        } else if (this.gpuCount >= 3) {
            lines.push('');
            for (let i = 0; i < this.gpuCount; i++) {
                lines.push(...this.boxLines(`GPU${i}`, this.gpuSeries.get(i) ?? [], this.width));
            }
        }

        return lines.map((l) => l + '\n').join('');
    }

    private halfWidth(): number {
        return Math.floor(this.width / 2);
    }

    private pushTo(series: number[], value: number, cap: number): void {
        series.push(clamp01(value));
        this.trimTo(series, cap);
    }

    /** Zips two boxes' lines side by side, separated by one space. */
    private sideBySide(left: string[], right: string[]): string[] {
        const leftWidth = left[0]?.length ?? 0;
        const rows = Math.max(left.length, right.length);
        const out: string[] = [];
        for (let i = 0; i < rows; i++) {
            out.push((left[i] ?? '').padEnd(leftWidth) + ' ' + (right[i] ?? ''));
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
