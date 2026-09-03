import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { APIServer, DEFAULT_PORT } from './api.ts';
import { MetricsWebSocketServer } from './ws.ts';
import { MockMetricsSource } from './mock-source.ts';
import { WindowsMetricsSource } from './windows/windows-metrics-source.ts';
import type { MetricsSource } from '../../spec/metrics.types.ts';

/**
 * Collector service entrypoint. Runs the REST API, the WebSocket
 * transport and the built web viewer on one port (default 11367,
 * loopback-only). Windows uses the real probe-backed producer; every
 * other platform falls back to the deterministic mock.
 */
const source: MetricsSource =
    process.platform === 'win32' ? new WindowsMetricsSource() : new MockMetricsSource();

// the viewer's build output lives at src/viewer/dist; when present the
// collector serves it at / so the browser needs no separate webserver
const distDir = fileURLToPath(new URL('../../viewer/dist', import.meta.url));
const hasViewer = existsSync(distDir + '/index.html');

const api = new APIServer(source, {
    metricsUpdateInterval: 2000,
    // transport policy (AGENTS.md): never expose the port beyond the host
    host: '127.0.0.1',
    staticDir: hasViewer ? distDir : undefined
});
const wsServer = new MetricsWebSocketServer(source, 2000);

api.start();
wsServer.attach(api.getServer()!);
wsServer.start();

// the port is only known once the server is actually listening
api.getServer()?.once('listening', () => {
    const port = api.boundPort ?? DEFAULT_PORT;
    console.log(`collector ready: http://localhost:${port}  (ws://localhost:${port}/ws)`);
    if (hasViewer) {
        console.log(`viewer: http://localhost:${port}/  (built dashboard served from src/viewer/dist)`);
    } else {
        console.log('viewer: not built — run `npm run build` in src/viewer to serve the dashboard here');
    }
});

process.on('SIGINT', () => {
    wsServer.stop();
    void api.stop().then(() => process.exit(0));
});
