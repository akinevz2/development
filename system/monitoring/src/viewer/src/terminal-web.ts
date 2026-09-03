import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { renderFrame } from './graphs.ts';
import type { AllMetrics } from '../../spec/metrics.types.ts';

/**
 * Browser pseudo-terminal (xterm.js) — the primary rendering pipeline.
 * Writes the shared renderFrame() output, so the browser draws exactly
 * the same ASCII graphs as the TUI.
 */
export class WebMetricsTerminal {
    private readonly term: Terminal;
    private readonly fitAddon: FitAddon;

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

    render(metrics: AllMetrics): void {
        this.term.write('\x1b[2J\x1b[H');
        this.term.write(renderFrame(metrics));
    }

    fit(): void {
        this.fitAddon.fit();
    }

    dispose(): void {
        this.term.dispose();
    }
}
