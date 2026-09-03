import { describe, it, expect } from 'vitest';
import { MetricsTUI } from '../../src/viewer/src/terminal';
import { renderFrame } from '../../src/viewer/src/graphs';
import { MockMetricsSource } from '../../src/collector/src/mock-source';
import type { AllMetrics } from '../../src/spec/metrics.types';

const renderToString = (metrics: AllMetrics, options = {}): string => {
    let out = '';
    new MetricsTUI((chunk) => (out += chunk), { clearScreen: false, ...options }).render(metrics);
    return out;
};

const source = new MockMetricsSource();

describe('TUI rendering pipeline', () => {
    it('renders every specified section from a single AllMetrics snapshot', async () => {
        const out = renderToString(await source.getAllMetrics());
        for (const header of ['CPU', 'MEM', 'GPU0', 'GPU1', 'OLLAMA', 'NET', 'DISK']) {
            expect(out).toContain(header);
        }
    });

    it('draws bars proportional to utilisation', async () => {
        const out = renderToString(await source.getAllMetrics());
        expect(out).toContain('\u2588'); // filled cells present for busy metrics
        expect(out).toMatch(/CPU\s+\[[█░]{24}\]/);
    });

    it('shows the active ollama model and model counts', async () => {
        const out = renderToString(await source.getAllMetrics());
        expect(out).toContain('model=llama3:8b');
        expect(out).toMatch(/loaded=1 available=3/);
    });

    it('degrades gracefully when sections are absent', () => {
        const empty: AllMetrics = {
            timestamp: Date.now(),
            cpu: { timestamp: 0, systemUsage: 0, userUsage: 0, idleUsage: 100, totalUsage: 100, threadCount: 0, coreCount: 0 },
            memory: { timestamp: 0, total: 0, used: 0, available: 0, free: 0, swapTotal: 0, swapUsed: 0, cached: 0, buffers: 0, allocationRatio: 0, swapAllocationRatio: 0 },
            gpu: { timestamp: 0, totalGPUs: 0, gpuUsage: [] },
            ollama: { timestamp: 0, isRunning: false, loadedModels: [], availableModels: [] },
            network: { timestamp: 0, interfaces: {} },
            disks: { timestamp: 0, disks: [] }
        };
        expect(() => renderToString(empty)).not.toThrow();
        expect(renderToString(empty)).toContain('OLLAMA  offline');
    });

    it('consumes the same specification the API serves (pipeline cohesion)', async () => {
        // The exact object produced by a MetricsSource renders without
        // transformation — proving API -> TUI share one data contract.
        const metrics = await source.getAllMetrics();
        const out = renderToString(metrics);
        expect(out).toContain(new Date(metrics.timestamp).toISOString());
        expect(out).toContain(metrics.ollama.currentModel!.name);
    });

    it('renders the identical frame as the web pseudo-terminal (shared pipeline)', async () => {
        const metrics = await source.getAllMetrics();
        expect(renderToString(metrics)).toBe(renderFrame(metrics));
    });
});
