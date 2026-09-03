import http from 'http';
import type {
    AllMetrics,
    MetricsSource,
    CPUMetrics,
    MemoryMetrics,
    GPUMetrics,
    OllamaMetrics
} from '../../spec/metrics.types.ts';
import { createStaticHandler, type StaticFileHandler } from './static.ts';

export interface APIServerConfig {
    /** 0 picks an ephemeral port. */
    port?: number;
    host?: string;
    enableCors?: boolean;
    /** How often the collector is polled, ms. */
    metricsUpdateInterval?: number;
    /** Built web viewer directory (`dist`); served at `/` and `/assets/*`
     *  so the dashboard lives on the collector's port and origin. Omit to
     *  serve the API only. */
    staticDir?: string;
}

/** Default collector port; the TUI connection popup prefills it. */
export const DEFAULT_PORT = 11367;

const EMPTY: AllMetrics = {
    timestamp: 0,
    cpu: {} as CPUMetrics,
    memory: {} as MemoryMetrics,
    gpu: {} as GPUMetrics,
    ollama: {} as OllamaMetrics
};

export class APIServer {
    private server: http.Server | null = null;
    private readonly port: number;
    private readonly host: string;
    private readonly enableCors: boolean;
    private readonly updateInterval: number;
    private readonly staticHandler: StaticFileHandler | null;
    private metrics: AllMetrics = EMPTY;
    private pollTimer: NodeJS.Timeout | null = null;
    private readonly source: MetricsSource;

    constructor(source: MetricsSource, config: APIServerConfig = {}) {
        this.source = source;
        this.port = config.port ?? DEFAULT_PORT;
        this.host = config.host ?? '0.0.0.0';
        this.enableCors = config.enableCors ?? true;
        this.updateInterval = config.metricsUpdateInterval ?? 5000;
        this.staticHandler = config.staticDir ? createStaticHandler(config.staticDir) : null;
    }

    private applyCors(res: http.ServerResponse): void {
        if (!this.enableCors) return;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    private respondJSON(res: http.ServerResponse, data: unknown): void {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify(data));
    }

    private handleStream(req: http.IncomingMessage, res: http.ServerResponse): void {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive'
        });
        const send = () => res.write(`data: ${JSON.stringify(this.metrics)}\n\n`);
        send();
        const timer = setInterval(send, this.updateInterval);
        req.on('close', () => clearInterval(timer));
    }

    private readonly handler = (req: http.IncomingMessage, res: http.ServerResponse): void => {
        this.applyCors(res);
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        // the built viewer claims / and /assets/* before the API router
        if (this.staticHandler && this.staticHandler(req, res)) return;
        switch (req.url) {
            case '/':
                this.respondJSON(res, { status: 'ok', timestamp: Date.now() });
                break;
            case '/api/metrics':
            case '/api/metrics/latest':
                this.respondJSON(res, this.metrics);
                break;
            case '/api/cpu':
                this.respondJSON(res, this.metrics.cpu);
                break;
            case '/api/memory':
                this.respondJSON(res, this.metrics.memory);
                break;
            case '/api/gpu':
                this.respondJSON(res, this.metrics.gpu);
                break;
            case '/api/ollama':
                this.respondJSON(res, this.metrics.ollama);
                break;
            case '/api/stream':
                this.handleStream(req, res);
                break;
            default:
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
        }
    };

    private poll = async (): Promise<void> => {
        try {
            this.metrics = await this.source.getAllMetrics();
        } catch (error) {
            console.error('[APIServer] metrics update failed:', error);
        }
    };

    start(): void {
        if (this.server) throw new Error('Server is already running');
        this.server = http.createServer(this.handler);
        this.server.listen(this.port, this.host);
        void this.poll();
        this.pollTimer = setInterval(this.poll, this.updateInterval);
    }

    stop(): Promise<void> {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        return new Promise((resolve) => {
            if (!this.server) return resolve();
            this.server.close(() => {
                this.server = null;
                resolve();
            });
        });
    }

    /** Actual bound port (useful when configured with port 0). */
    get boundPort(): number | null {
        if (!this.server) return null;
        const addr = this.server.address();
        return typeof addr === 'object' && addr !== null ? addr.port : Number(addr);
    }

    /** Underlying HTTP server (e.g. to attach the WebSocket transport). */
    getServer(): http.Server | null {
        return this.server;
    }

    getMetrics(): AllMetrics {
        return this.metrics;
    }
}
