import { MetricsTUI } from './terminal.ts';
import { MockMetricsSource } from '../../collector/src/mock-source.ts';
import type { MetricsSource } from '../../spec/metrics.types.ts';

/**
 * TUI entrypoint: renders live metrics to the actual terminal.
 * Uses the mock source until the Windows-side collector is implemented;
 * swap in an API-backed MetricsSource then.
 */
const TICK_MS = 2000;

async function run(): Promise<void> {
    const source: MetricsSource = new MockMetricsSource();
    const tui = new MetricsTUI((chunk) => process.stdout.write(chunk));

    const frame = async (): Promise<void> => {
        const metrics = await source.getAllMetrics();
        tui.render(metrics);
    };

    process.on('SIGINT', () => process.exit(0));
    await frame();
    setInterval(() => void frame(), TICK_MS);
}

void run();
