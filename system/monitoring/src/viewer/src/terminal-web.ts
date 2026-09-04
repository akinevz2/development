import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { CanvasAddon } from '@xterm/addon-canvas';
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
    private gpu: WebglAddon | CanvasAddon | null = null;
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
        this.loadGpuRenderer();
        this.fitAddon.fit();
    }

    /**
     * Grid renderer: WebGL when the context comes up, 2D canvas as the
     * durable fallback. Both draw every cell at fixed grid offsets, so
     * odd-advance fallback glyphs can never shift the right border the
     * way the DOM renderer does. Swaps to canvas automatically if the
     * WebGL context is lost.
     */
    private loadGpuRenderer(): void {
        try {
            const webgl = new WebglAddon();
            webgl.onContextLoss(() => this.swapToCanvas());
            this.term.loadAddon(webgl);
            this.gpu = webgl;
        } catch {
            this.swapToCanvas();
        }
    }

    private swapToCanvas(): void {
        this.gpu?.dispose();
        this.gpu = new CanvasAddon();
        this.term.loadAddon(this.gpu);
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
        this.gpu?.dispose();
        this.term.dispose();
    }
}
