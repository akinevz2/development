import { MetricsGraphRenderer, geometryFor, paintFrame } from './graphs.ts';
import type { AllMetrics } from '../../spec/metrics.types.ts';

/** Destination prefill for the connection popup. */
export const DEFAULT_DESTINATION = 'localhost:11367';

export interface KeyEvent {
    name?: 'enter' | 'backspace' | 'escape' | 'quit';
    sequence?: string;
}

export interface TUIIO {
    write: (chunk: string) => void;
    getSize: () => { cols: number; rows: number };
    onKey: (handler: (key: KeyEvent) => void) => void;
    setRaw?: (on: boolean) => void;
    close?: () => void;
}

/** Raw stdin key decoder for the interactive popup. */
export function decodeKeys(data: string): KeyEvent[] {
    const keys: KeyEvent[] = [];
    for (let i = 0; i < data.length; i++) {
        const ch = data[i];
        if (ch === '\x1b') {
            if (data[i + 1] === '[') {
                i += 2; // skip CSI escape sequences (arrows etc.)
                while (i < data.length && !/[a-zA-Z~]/.test(data[i])) i++;
                continue;
            }
            keys.push({ name: 'escape' });
            continue;
        }
        if (ch === '\r' || ch === '\n') { keys.push({ name: 'enter' }); continue; }
        if (ch === '\x7f' || ch === '\b') { keys.push({ name: 'backspace' }); continue; }
        if (ch === '\x03') { keys.push({ name: 'quit' }); continue; }
        if (ch >= ' ') keys.push({ sequence: ch });
    }
    return keys;
}

/** Normalises "localhost:11367" (or a ws:// URL) to ws://host:port/ws. */
export function toWsUrl(destination: string): string {
    const withScheme = /^wss?:\/\//.test(destination) ? destination : `ws://${destination}`;
    const url = new URL(withScheme);
    if (url.pathname === '/' || url.pathname === '') url.pathname = '/ws';
    return url.toString();
}

const POPUP_WIDTH = 52;

/** Centered connection popup overlay, prefilled with the destination. */
export function buildPopup(destination: string, status: string, cols: number, rows: number): string {
    const inner = POPUP_WIDTH - 2;
    const center = (text: string): string => {
        const t = text.length > inner ? text.slice(0, inner) : text;
        const left = Math.floor((inner - t.length) / 2);
        return ' '.repeat(left) + t + ' '.repeat(inner - t.length - left);
    };
    const lines = [
        '┌' + '─'.repeat(inner) + '┐',
        '│' + center('COLLECTOR CONNECTION') + '│',
        '│' + center('') + '│',
        '│' + center(`Destination: ${destination}_`) + '│',
        '│' + center(status) + '│',
        '│' + center('Enter = connect    Esc = quit') + '│',
        '└' + '─'.repeat(inner) + '┘'
    ];
    const top = Math.max(1, Math.floor((rows - lines.length) / 2));
    const left = Math.max(1, Math.floor((cols - POPUP_WIDTH) / 2));
    let out = '';
    for (let i = 0; i < lines.length; i++) {
        out += `\x1b[${top + i};${left}H${lines[i]}`;
    }
    return out;
}

/**
 * Interactive TUI: opens a centered popup (prefilled with the collector
 * destination) to connect over WebSocket. While disconnected it renders
 * EMPTY graphs; every received snapshot is pushed to the shared
 * time-series renderer; on disconnect it falls back to empty graphs
 * plus popup again.
 */
export class ConnectTUI {
    private readonly io: TUIIO;
    private readonly renderer: MetricsGraphRenderer;
    private destination: string;
    private status = '';
    private popupOpen = true;
    private ws: WebSocket | null = null;
    private stopped = false;

    constructor(io: TUIIO, defaultDestination: string = DEFAULT_DESTINATION) {
        this.io = io;
        this.destination = defaultDestination;
        // size the framebuffer so the frame fills the terminal
        const { cols, rows } = io.getSize();
        this.renderer = new MetricsGraphRenderer(geometryFor(cols, rows));
    }

    start(): void {
        this.io.setRaw?.(true);
        // alternate screen buffer: TUI never touches the scrollback and
        // the shell is restored on exit; hide the cursor while running
        this.io.write('\x1b[?1049h\x1b[H\x1b[?25l');
        this.io.onKey((key) => this.handleKey(key));
        this.draw();
    }

    private draw(): void {
        // single write: flicker-free in-place repaint (no clear, no scroll)
        let out = paintFrame(this.renderer.renderFrame());
        if (this.popupOpen) {
            const { cols, rows } = this.io.getSize();
            out += buildPopup(this.destination, this.status, cols, rows);
        }
        this.io.write(out);
    }

    private handleKey(key: KeyEvent): void {
        if (key.name === 'quit' || key.name === 'escape') {
            this.shutdown();
            return;
        }
        if (!this.popupOpen) return;
        if (key.name === 'enter') {
            this.connect();
            return;
        }
        if (key.name === 'backspace') {
            this.destination = this.destination.slice(0, -1);
            this.draw();
            return;
        }
        if (key.sequence && key.sequence >= ' ') {
            this.destination += key.sequence;
            this.draw();
        }
    }

    private connect(): void {
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }
        this.status = 'connecting...';
        this.draw();

        const ws = new WebSocket(toWsUrl(this.destination));
        this.ws = ws;

        ws.onopen = () => {
            this.status = 'connected';
            this.popupOpen = false;
            this.draw();
        };
        ws.onmessage = (event) => {
            let metrics: AllMetrics;
            try {
                metrics = JSON.parse(String(event.data)) as AllMetrics;
            } catch {
                return; // ignore malformed frames
            }
            this.renderer.push(metrics);
            this.draw();
        };
        ws.onclose = () => {
            this.ws = null;
            if (this.stopped) return;
            this.renderer.clear(); // disconnected -> empty graphs
            this.popupOpen = true;
            this.status = 'connection failed - check destination';
            this.draw();
        };
    }

    private shutdown(): void {
        this.stopped = true;
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }
        // restore the terminal: cursor back, leave the alternate screen
        this.io.write('\x1b[?25h\x1b[?1049l');
        this.io.setRaw?.(false);
        this.io.close?.();
    }
}
