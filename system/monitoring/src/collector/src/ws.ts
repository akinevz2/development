import type { Server as HTTPServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { createEmptyMetrics, type AllMetrics, type MetricsSource } from '../../spec/metrics.types.ts';

/**
 * WebSocket transport for the collector.
 *
 * - Streams AllMetrics JSON snapshots to ws://<host>:<port>/ws
 * - SINGLE-CLIENT POLICY: only the first connection on the port is
 *   accepted; further attempts are closed with code 1013 while one is
 *   active; listening resumes automatically after disconnect.
 * - LOCALHOST-ONLY: connections from any non-loopback peer are rejected
 *   before the handshake completes. The Windows service must never
 *   expose this port beyond the host.
 */
const LOCAL_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function isLocalPeer(remoteAddress: string | undefined): boolean {
    return remoteAddress !== undefined && LOCAL_ADDRESSES.has(remoteAddress);
}

export class MetricsWebSocketServer {
    private readonly wss = new WebSocketServer({ noServer: true });
    private readonly source: MetricsSource;
    private readonly intervalMs: number;
    private timer: NodeJS.Timeout | null = null;
    private client: WebSocket | null = null;
    private latest: AllMetrics = createEmptyMetrics();

    constructor(source: MetricsSource, intervalMs: number = 2000) {
        this.source = source;
        this.intervalMs = intervalMs;
    }

    /** Handles upgrade requests for path /ws on the given HTTP server. */
    attach(server: HTTPServer): void {
        server.on('upgrade', (req, socket, head) => {
            const { pathname } = new URL(req.url ?? '/', 'http://localhost');
            if (pathname !== '/ws') {
                socket.destroy();
                return;
            }
            if (!isLocalPeer(req.socket.remoteAddress)) {
                socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
                socket.destroy();
                return;
            }
            if (this.client) {
                this.wss.handleUpgrade(req, socket, head, (ws) => {
                    ws.close(1013, 'collector busy: single-client policy');
                });
                return;
            }
            this.wss.handleUpgrade(req, socket, head, (ws) => {
                this.client = ws;
                ws.send(JSON.stringify(this.latest));
                ws.on('close', () => {
                    this.client = null; // listening resumes for the next client
                });
            });
        });
    }

    start(): void {
        if (this.timer) return;
        void this.poll();
        this.timer = setInterval(() => void this.poll(), this.intervalMs);
    }

    private async poll(): Promise<void> {
        try {
            this.latest = await this.source.getAllMetrics();
            if (this.client && this.client.readyState === WebSocket.OPEN) {
                this.client.send(JSON.stringify(this.latest));
            }
        } catch (error) {
            console.error('[ws] metrics poll failed:', error);
        }
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.client) {
            this.client.close();
            this.client = null;
        }
    }
}
