import { describe, it, expect, afterAll } from 'vitest';
import { MockMetricsSource } from '../../src/collector/src/mock-source';
import { APIServer } from '../../src/collector/src/api';
import type { AllMetrics } from '../../src/spec/metrics.types';

const source = new MockMetricsSource();

describe('data specification', () => {
    let snapshot: AllMetrics;

    it('producer emits every specified section', async () => {
        snapshot = await source.getAllMetrics();
        expect(Object.keys(snapshot).sort()).toEqual(
            ['cpu', 'disks', 'gpu', 'memory', 'network', 'ollama', 'timestamp'].sort()
        );
    });

    it('cpu: usages are percentages and system + idle = total', async () => {
        const cpu = await source.getCpuMetrics();
        for (const v of [cpu.systemUsage, cpu.userUsage, cpu.idleUsage]) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(100);
        }
        expect(cpu.systemUsage + cpu.idleUsage).toBeCloseTo(cpu.totalUsage, 6);
        expect(cpu.coreCount).toBeGreaterThan(0);
        expect(cpu.threadCount).toBeGreaterThanOrEqual(cpu.coreCount);
    });

    it('memory: used = total − available, ratios within 0–100', async () => {
        const mem = await source.getMemoryMetrics();
        expect(mem.used).toBe(mem.total - mem.available);
        expect(mem.allocationRatio).toBeCloseTo((mem.used / mem.total) * 100, 6);
        expect(mem.swapAllocationRatio).toBeCloseTo((mem.swapUsed / mem.swapTotal) * 100, 6);
    });

    it('gpu: per-device utilisation bounded, indices contiguous', async () => {
        const gpu = await source.getGPUMetrics();
        expect(gpu.totalGPUs).toBe(gpu.gpuUsage.length);
        gpu.gpuUsage.forEach((g, i) => {
            expect(g.index).toBe(i);
            expect(g.utilization).toBeGreaterThanOrEqual(0);
            expect(g.utilization).toBeLessThanOrEqual(100);
            expect(g.memoryUsed).toBeLessThanOrEqual(g.memoryTotal);
            expect(g.memoryUtilization).toBeCloseTo((g.memoryUsed / g.memoryTotal) * 100, 6);
        });
    });

    it('ollama: loaded models are a subset of available models', async () => {
        const om = await source.getOllamaMetrics();
        expect(om.isRunning).toBe(true);
        const names = new Set(om.availableModels.map((m) => m.name));
        for (const loaded of om.loadedModels) expect(names.has(loaded.name)).toBe(true);
        if (om.currentModel) expect(om.loadedModels.map((m) => m.name)).toContain(om.currentModel.name);
    });

    it('disks: usagePercent consistent with used/total', async () => {
        const disks = await source.getDiskMetrics();
        for (const d of disks.disks) {
            expect(d.usagePercent).toBeCloseTo((d.used / d.total) * 100, 6);
            expect(d.used + d.available).toBe(d.total);
        }
    });

    it('network: rates and counters are non-negative', async () => {
        const net = await source.getNetworkMetrics();
        for (const iface of Object.values(net.interfaces)) {
            for (const v of [iface.rxBytes, iface.txBytes, iface.rxSpeed, iface.txSpeed]) {
                expect(v).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it('sections are timestamp-aligned (cohesion of a snapshot)', async () => {
        snapshot = await source.getAllMetrics();
        const stamps = [
            snapshot.cpu.timestamp,
            snapshot.memory.timestamp,
            snapshot.gpu.timestamp,
            snapshot.ollama.timestamp,
            snapshot.network.timestamp,
            snapshot.disks.timestamp
        ];
        for (const t of stamps) expect(Math.abs(t - snapshot.timestamp)).toBeLessThan(1000);
    });

    describe('API contract', () => {
        const server = new APIServer(source, { port: 0, metricsUpdateInterval: 100 });

        afterAll(() => server.stop());

        it('serves snapshots conforming to the specification', async () => {
            server.start();
            await new Promise((r) => setTimeout(r, 150));
            const res = await fetch(`http://127.0.0.1:${server.boundPort}/api/metrics`);
            expect(res.status).toBe(200);
            const body = (await res.json()) as AllMetrics;
            expect(Object.keys(body).sort()).toEqual(
                ['cpu', 'disks', 'gpu', 'memory', 'network', 'ollama', 'timestamp'].sort()
            );
            expect(body.cpu.systemUsage).toBeLessThanOrEqual(100);
            expect(body.memory.used).toBe(body.memory.total - body.memory.available);
            expect(body.gpu.totalGPUs).toBe(body.gpu.gpuUsage.length);
        });
    });
});
