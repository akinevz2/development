import type {
    AllMetrics,
    MetricsSource,
    CPUMetrics,
    MemoryMetrics,
    GPUMetrics,
    OllamaMetrics
} from '../../spec/metrics.types.ts';

const GiB = 1024 ** 3;

/**
 * Deterministic mock producer — stands in for the Windows-side collector
 * until it is implemented. Values are constructed so every specification
 * invariant (used = total − available, ratios within 0–100, system + idle = 100)
 * holds by construction.
 */
export class MockMetricsSource implements MetricsSource {
    private readonly gpuCount: number;

    constructor(gpuCount: number = 2) {
        this.gpuCount = gpuCount;
    }

    private base(): number {
        return Math.sin(Date.now() / 60_000); // slow, smooth wobble in [-1, 1]
    }

    private clampPct(v: number): number {
        return Math.min(100, Math.max(0, v));
    }

    async getCpuMetrics(): Promise<CPUMetrics> {
        const usage = this.clampPct(45 + 25 * this.base());
        return {
            timestamp: Date.now(),
            systemUsage: usage,
            userUsage: usage * 0.7,
            idleUsage: 100 - usage,
            totalUsage: 100,
            loadAverage: { oneMinute: 1.2, fiveMinutes: 1.1, fifteenMinutes: 0.9 },
            threadCount: 16,
            coreCount: 8
        };
    }

    async getMemoryMetrics(): Promise<MemoryMetrics> {
        const total = 32 * GiB;
        const used = Math.round(total * (0.5 + 0.15 * this.base()));
        const available = total - used;
        return {
            timestamp: Date.now(),
            total,
            used,
            available,
            free: available,
            allocationRatio: (used / total) * 100
        };
    }

    async getGPUMetrics(): Promise<GPUMetrics> {
        const gpuUsage = Array.from({ length: this.gpuCount }, (_, index) => {
            const memoryTotal = 8 * GiB;
            const memoryUsed = Math.round(memoryTotal * (0.3 + 0.2 * this.base()));
            return {
                index,
                name: `Mock GPU ${index}`,
                utilization: this.clampPct(50 + 30 * this.base()),
                memoryTotal,
                memoryUsed,
                memoryUtilization: (memoryUsed / memoryTotal) * 100
            };
        });
        return { timestamp: Date.now(), totalGPUs: gpuUsage.length, gpuUsage };
    }

    async getOllamaMetrics(): Promise<OllamaMetrics> {
        const currentModel = { name: 'llama3:8b', size: 4.7 * GiB, quantization: 'Q4_K_M' };
        return {
            timestamp: Date.now(),
            isRunning: true,
            currentModel,
            loadedModels: [currentModel],
            availableModels: [
                currentModel,
                { name: 'qwen2.5:14b', size: 9 * GiB, quantization: 'Q4_K_M' },
                { name: 'tinyllama:1.1b', size: 0.64 * GiB, quantization: 'Q4_0' }
            ]
        };
    }

    async getAllMetrics(): Promise<AllMetrics> {
        return {
            timestamp: Date.now(),
            cpu: await this.getCpuMetrics(),
            memory: await this.getMemoryMetrics(),
            gpu: await this.getGPUMetrics(),
            ollama: await this.getOllamaMetrics()
        };
    }
}
