import type {
    MetricsSource,
    CPUMetrics,
    MemoryMetrics,
    GPUMetrics,
    OllamaMetrics,
    AllMetrics
} from '../../spec/metrics.types.ts';

/** MetricsSource backed by the collector's REST API. */
export class ApiMetricsSource implements MetricsSource {
    constructor(private readonly baseUrl: string) {}

    private async get<T>(path: string): Promise<T> {
        const res = await fetch(`${this.baseUrl}${path}`);
        if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
        return (await res.json()) as T;
    }

    getCpuMetrics(): Promise<CPUMetrics> {
        return this.get<CPUMetrics>('/api/cpu');
    }

    getMemoryMetrics(): Promise<MemoryMetrics> {
        return this.get<MemoryMetrics>('/api/memory');
    }

    getGPUMetrics(): Promise<GPUMetrics> {
        return this.get<GPUMetrics>('/api/gpu');
    }

    getOllamaMetrics(): Promise<OllamaMetrics> {
        return this.get<OllamaMetrics>('/api/ollama');
    }

    getAllMetrics(): Promise<AllMetrics> {
        return this.get<AllMetrics>('/api/metrics');
    }
}
