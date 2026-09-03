import { describe, it, expect, afterAll } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import { MetricsWebSocketServer, isLocalPeer } from '../../src/collector/src/ws';
import { MockMetricsSource } from '../../src/collector/src/mock-source';
import type { AllMetrics } from '../../src/spec/metrics.types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Client {
    ws: WebSocket;
    messages: string[];
    closeCode: number | null;
}

const connect = (url: string): Promise<Client> => {
    const ws = new WebSocket(url);
    const client: Client = { ws, messages: [], closeCode: null };
    ws.onmessage = (ev) => client.messages.push(String(ev.data));
    ws.onclose = (ev) => {
        client.closeCode = ev.code;
    };
    return new Promise((resolve) => ws.onopen = () => resolve(client));
};

describe('collector WebSocket transport', () => {
    it('localhost policy: accepts loopback peers only', () => {
        expect(isLocalPeer('127.0.0.1')).toBe(true);
        expect(isLocalPeer('::1')).toBe(true);
        expect(isLocalPeer('::ffff:127.0.0.1')).toBe(true);
        expect(isLocalPeer('::ffff:203.0.113.9')).toBe(false);
        expect(isLocalPeer('10.0.0.5')).toBe(false);
        expect(isLocalPeer(undefined)).toBe(false);
    });

    describe('single-client policy on ws://127.0.0.1:<ephemeral>/ws', () => {
        const server = http.createServer();
        const wss = new MetricsWebSocketServer(new MockMetricsSource(), 40);
        let port = 0;

        afterAll(async () => {
            wss.stop();
            await new Promise<void>((r) => server.close(() => r()));
        });

        it('accepts the first client and streams spec-shaped snapshots', async () => {
            wss.attach(server);
            wss.start();
            await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
            port = (server.address() as AddressInfo).port;

            const a = await connect(`ws://127.0.0.1:${port}/ws`);
            await sleep(150);

            expect(a.messages.length).toBeGreaterThanOrEqual(2); // initial push + interval updates
            const snapshot = JSON.parse(a.messages[0]) as AllMetrics;
            expect(Object.keys(snapshot).sort()).toEqual(
                ['cpu', 'disks', 'gpu', 'memory', 'network', 'ollama', 'timestamp'].sort()
            );
            expect(snapshot.cpu.systemUsage).toBeLessThanOrEqual(100);
            a.ws.close();
            await sleep(50);
        });

        it('rejects a second client while one is connected', async () => {
            const first = await connect(`ws://127.0.0.1:${port}/ws`);
            const second = await connect(`ws://127.0.0.1:${port}/ws`);
            await sleep(100);
            expect(second.closeCode).toBe(1013); // collector busy
            first.ws.close();
            await sleep(50);
        });

        it('resumes listening after disconnect', async () => {
            const next = await connect(`ws://127.0.0.1:${port}/ws`);
            await sleep(100);
            expect(next.closeCode).toBeNull();
            expect(next.messages.length).toBeGreaterThan(0);
            next.ws.close();
        });
    });
});
