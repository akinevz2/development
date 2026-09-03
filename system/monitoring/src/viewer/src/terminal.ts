import { renderFrame, type FrameOptions } from './graphs.ts';
import type { AllMetrics } from '../../spec/metrics.types.ts';

export type TerminalWriter = (chunk: string) => void;

export interface MetricsTUIOptions extends FrameOptions {
    /** Emit ANSI clear-screen before each frame (disable for tests). */
    clearScreen?: boolean;
}

/**
 * Live TUI renderer for an actual terminal — the secondary rendering
 * pipeline. Writes the shared renderFrame() output to an injectable
 * writer so output is fully assertable in tests.
 */
export class MetricsTUI {
    private readonly barWidth: number;
    private readonly clearScreen: boolean;
    private readonly write: TerminalWriter;

    constructor(write: TerminalWriter, options: MetricsTUIOptions = {}) {
        this.write = write;
        this.barWidth = options.barWidth ?? 24;
        this.clearScreen = options.clearScreen ?? true;
    }

    render(metrics: AllMetrics): void {
        if (this.clearScreen) this.write('\x1b[2J\x1b[H');
        this.write(renderFrame(metrics, { barWidth: this.barWidth }));
    }
}
