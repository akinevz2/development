import { APIServer } from './api.ts';
import { MetricsWebSocketServer } from './ws.ts';
import { MockMetricsSource } from './mock-source.ts';
import type { MetricsSource } from '../../spec/metrics.types.ts';

/**
 * Collector service entrypoint. Runs the REST API and the WebSocket
 * transport on one port (default 11367, loopback-only for WS).
 * Backed by the mock source until the Windows collector is implemented:
 * swap MockMetricsSource for a WindowsMetricsSource then.
 */
const source: MetricsSource = new MockMetricsSource();
const api = new APIServer(source, { metricsUpdateInterval: 2000 });
const wsServer = new MetricsWebSocketServer(source, 2000);

api.start();
wsServer.attach(api.getServer()!);
wsServer.start();

const port = api.boundPort ?? 11367;
console.log(`collector ready: http://localhost:${port}  (ws://localhost:${port}/ws)`);

process.on('SIGINT', () => {
    wsServer.stop();
    void api.stop().then(() => process.exit(0));
});
