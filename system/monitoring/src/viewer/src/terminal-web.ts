import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { MetricsGraphRenderer, geometryFor, paintFrame } from './graphs.ts';
import type { AllMetrics } from '../../spec/metrics.types.ts';

/**
 * Browser pseudo-terminal (xterm.js) — the primary rendering pipeline.
 * Draws the shared btop-style braille graphs; the graph framebuffer is
 * resized to fill the terminal grid whenever the container changes.
 */
export class WebMetricsTerminal {
    private readonly term: Terminal;
    private readonly fitAddon: FitAddon;
    private readonly renderer = new MetricsGraphRenderer();
    private last: AllMetrics | null = null;

    constructor(container: HTMLElement) {
        this.term = new Terminal({
            fontSize: 13,
            fontFamily: '"Fira Code", Menlo, Consolas, monospace',
            convertEol: true,
            theme: { background: '#000000', foreground: '#d0d0d0' }
        });
        this.fitAddon = new FitAddon();
        this.term.loadAddon(this.fitAddon);
        this.term.open(container);
        this.fitAddon.fit();
    }

    /** Re-fits the terminal to its container, resizes the graph
     *  framebuffer to fill the new grid, and redraws the last frame. */
    resizeToFit(): void {
        this.fitAddon.fit();
        this.renderer.resize(geometryFor(this.term.cols, this.term.rows));
        this.render(this.last);
    }

    render(metrics: AllMetrics | null): void {
        this.last = metrics;
        if (metrics) {
            this.renderer.push(metrics);
        } else {
            this.renderer.clear();
        }
        // single write, in-place repaint: no flicker, no scrollback growth
        this.term.write(paintFrame(this.renderer.renderFrame(), this.term.cols));
    }

    fit(): void {
        this.fitAddon.fit();
    }

    dispose(): void {
        this.term.dispose();
    }
}
