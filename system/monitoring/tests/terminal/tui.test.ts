import { describe, it, expect } from 'vitest';
import { MetricsTUI } from '../../src/viewer/src/terminal';
import { renderFrame } from '../../src/viewer/src/graphs';
import { createEmptyMetrics } from '../../src/spec/metrics.types';
import { MockMetricsSource } from '../../src/collector/src/mock-source';

const renderToString = (metrics: Parameters<MetricsTUI['render']>[0], options = {}): string => {
    let out = '';
    new MetricsTUI((chunk) => (out += chunk), { clearScreen: false, ...options }).render(metrics);
    return out;
};

const source = new MockMetricsSource();

describe('TUI rendering pipeline', () => {
    it('graphs ONLY cpu, mem, gpu0 and gpu1', async () => {
        const out = renderToString(await source.getAllMetrics());
        for (const header of ['CPU', 'MEM', 'GPU0', 'GPU1']) {
            expect(out).toContain(header);
        }
        for (const absent of ['OLLAMA', 'NET', 'DISK']) {
            expect(out).not.toContain(absent);
        }
    });

    it('draws bars proportional to utilisation', async () => {
        const out = renderToString(await source.getAllMetrics());
        expect(out).toContain('\u2588'); // filled cells present for busy metrics
        expect(out).toMatch(/CPU\s+\[[█░]{24}\]/);
    });

    it('shows empty graphs for an empty snapshot', () => {
        const out = renderToString(createEmptyMetrics());
        expect(out).toMatch(/CPU\s+\[░{24}\]/);
        expect(out).toMatch(/MEM\s+\[░{24}\]/);
        expect(out).toMatch(/GPU0\s+\[░{24}\]/);
        expect(out).toMatch(/GPU1\s+\[░{24}\]/);
    });

    it('consumes the same specification the API serves (pipeline cohesion)', async () => {
        const metrics = await source.getAllMetrics();
        const out = renderToString(metrics);
        expect(out).toContain(new Date(metrics.timestamp).toISOString());
    });

    it('renders the identical frame as the web pseudo-terminal (shared pipeline)', async () => {
        const metrics = await source.getAllMetrics();
        expect(renderToString(metrics)).toBe(renderFrame(metrics));
    });
});
