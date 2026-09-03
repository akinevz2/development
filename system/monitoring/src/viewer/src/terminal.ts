import { MetricsGraphRenderer, paintFrame, type GraphGeometry } from './graphs.ts';
import type { AllMetrics } from '../../spec/metrics.types.ts';

export type TerminalWriter = (chunk: string) => void;

export interface MetricsTUIOptions {
    /** Repaint in place (flicker-free, no scroll) instead of writing the
     *  raw frame — enabled by default; tests pass false for raw output. */
    clearScreen?: boolean;
    graph?: Partial<GraphGeometry>;
}

/**
 * Live TUI renderer for an actual terminal — the secondary rendering
 * pipeline. Each render() call appends the snapshot to the shared
 * time-series history and paints the btop-style frame.
 */
export class MetricsTUI {
    private readonly renderer: MetricsGraphRenderer;
    private readonly clearScreen: boolean;
    private readonly write: TerminalWriter;

    constructor(write: TerminalWriter, options: MetricsTUIOptions = {}) {
        this.write = write;
        this.renderer = new MetricsGraphRenderer(options.graph);
        this.clearScreen = options.clearScreen ?? true;
    }

    render(metrics: AllMetrics): void {
        this.renderer.push(metrics);
        const frame = this.renderer.renderFrame();
        this.write(this.clearScreen ? paintFrame(frame) : frame);
    }
}
