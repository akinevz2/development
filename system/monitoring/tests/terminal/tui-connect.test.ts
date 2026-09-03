import { describe, it, expect, afterAll } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import { ConnectTUI, decodeKeys, toWsUrl, buildPopup, DEFAULT_DESTINATION, type KeyEvent } from '../../src/viewer/src/tui-app';
import { MetricsWebSocketServer } from '../../src/collector/src/ws';
import { MockMetricsSource } from '../../src/collector/src/mock-source';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class FakeIO {
    writes: string[] = [];
    keyHandler: ((key: KeyEvent) => void) | null = null;
    raw = false;
    closed = false;
    cols = 80;
    rows = 24;

    write = (chunk: string): void => {
        this.writes.push(chunk);
    };
    getSize = (): { cols: number; rows: number } => ({ cols: this.cols, rows: this.rows });
    onKey = (handler: (key: KeyEvent) => void): void => {
        this.keyHandler = handler;
    };
    setRaw = (on: boolean): void => {
        this.raw = on;
    };
    close = (): void => {
        this.closed = true;
    };

    press(key: KeyEvent): void {
        this.keyHandler?.(key);
    }
    type(text: string): void {
        for (const ch of text) this.press({ sequence: ch });
    }
    output(): string {
        return this.writes.join('');
    }
    lastWrite(): string {
        return this.writes[this.writes.length - 1] ?? '';
    }
}

describe('TUI connection popup', () => {
    it('popup is centered and prefilled with localhost:11367', () => {
        const io = new FakeIO();
        new ConnectTUI(io).start();
        const out = io.lastWrite();
        expect(out).toContain(DEFAULT_DESTINATION);
        expect(out).toContain('COLLECTOR CONNECTION');
        expect(out).toContain('┌');
        expect(out).toMatch(/\x1b\[\d+;\d+H/); // centered via cursor positioning
        expect(io.raw).toBe(true);
    });

    it('typing edits the destination; backspace deletes', () => {
        const io = new FakeIO();
        new ConnectTUI(io).start();
        io.type('a');
        expect(io.lastWrite()).toContain('localhost:11367a_');
        io.press({ name: 'backspace' });
        expect(io.lastWrite()).toContain('localhost:11367_');
    });

    it('failed connection: empty graphs plus the popup again', async () => {
        const io = new FakeIO();
        const tui = new ConnectTUI(io, 'localhost:1'); // nothing listens there
        tui.start();
        io.press({ name: 'enter' });
        await sleep(500);
        const out = io.output();
        expect(out).toContain('connection failed');
        expect(out).toMatch(/CPU\s+\[░{24}\]/); // empty graph fallback
    });

    it('escape quits and releases the terminal', () => {
        const io = new FakeIO();
        new ConnectTUI(io).start();
        io.press({ name: 'escape' });
        expect(io.closed).toBe(true);
        expect(io.raw).toBe(false);
    });
});

describe('TUI <-> collector end-to-end', () => {
    const server = http.createServer();
    const wss = new MetricsWebSocketServer(new MockMetricsSource(), 40);
    let port = 0;

    afterAll(async () => {
        wss.stop();
        await new Promise<void>((r) => server.close(() => r()));
    });

    it('renders live graphs after connecting through the popup', async () => {
        wss.attach(server);
        wss.start();
        await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
        port = (server.address() as AddressInfo).port;

        const io = new FakeIO();
        const tui = new ConnectTUI(io, `127.0.0.1:${port}`);
        tui.start();
        io.press({ name: 'enter' });
        await sleep(400);

        expect(io.output()).not.toContain('connection failed');
        expect(io.lastWrite()).not.toContain('COLLECTOR CONNECTION'); // popup hidden
        const frame = io.lastWrite();
        for (const header of ['CPU', 'MEM', 'GPU0', 'GPU1']) {
            expect(frame).toContain(header);
        }
        for (const absent of ['OLLAMA', 'NET', 'DISK']) {
            expect(frame).not.toContain(absent);
        }
    });
});

describe('input/url primitives', () => {
    it('decodeKeys parses printable, enter, backspace, escape and quit', () => {
        expect(decodeKeys('ab\r\x7f\x1b\x03')).toEqual([
            { sequence: 'a' },
            { sequence: 'b' },
            { name: 'enter' },
            { name: 'backspace' },
            { name: 'escape' },
            { name: 'quit' }
        ]);
        expect(decodeKeys('\x1b[A')).toEqual([]); // arrow keys ignored
    });

    it('toWsUrl appends the /ws path', () => {
        expect(toWsUrl('localhost:11367')).toBe('ws://localhost:11367/ws');
        expect(toWsUrl('ws://host:1/base')).toBe('ws://host:1/base');
    });

    it('buildPopup clamps to small terminals without throwing', () => {
        expect(() => buildPopup('localhost:11367', '', 10, 4)).not.toThrow();
    });
});
