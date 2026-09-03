import type {
    AllMetrics,
    MetricsSource,
    CPUMetrics,
    MemoryMetrics,
    GPUMetrics,
    OllamaMetrics
} from '../../../spec/metrics.types.ts';
import { createEmptyMetrics } from '../../../spec/metrics.types.ts';
import { GpuProbe } from './gpu-probe.ts';
import { OllamaProbe } from './ollama-probe.ts';
import { CpuProbe, MemoryProbe } from './sys-probes.ts';

/**
 * Logs a probe the moment its health state changes (degraded ⇄ recovered)
 * and stays silent otherwise — "log once per state change" per AGENTS.md.
 */
class ProbeStateLogger {
    private readonly last = new Map<string, string>();

    report(probe: string, ok: boolean, detail?: string): void {
        const state = ok ? 'ok' : `error:${detail ?? 'unknown'}`;
        const previous = this.last.get(probe);
        if (previous === state) return;
        this.last.set(probe, state);
        if (!ok) {
            console.error(`[collector] probe '${probe}' degraded: ${detail ?? 'unknown error'}`);
        } else if (previous !== undefined) {
            console.error(`[collector] probe '${probe}' recovered`);
        }
    }
}

export interface WindowsMetricsSourceOptions {
    gpu?: GpuProbe;
    ollama?: OllamaProbe;
    cpu?: CpuProbe;
    memory?: MemoryProbe;
}

/**
 * MetricsSource for Windows, composing the independently testable probes
 * (nvidia-smi GPU, Ollama HTTP, CPU deltas, plain-RAM memory). Probes
 * never throw out of any getter: a failing probe degrades its section to
 * zeros/empty and logs once per state change. The first poll returns
 * valid data — CPU usage is 0 before a delta window exists. Where no
 * NVIDIA adapter is present the GPU section degrades to
 * `{ totalGPUs: 0, gpuUsage: [] }`.
 */
export class WindowsMetricsSource implements MetricsSource {
    private readonly gpu: GpuProbe;
    private readonly ollama: OllamaProbe;
    private readonly cpu: CpuProbe;
    private readonly memory: MemoryProbe;
    private readonly log = new ProbeStateLogger();

    constructor(options: WindowsMetricsSourceOptions = {}) {
        this.gpu = options.gpu ?? new GpuProbe({ onState: (ok, d) => this.log.report('gpu', ok, d) });
        this.ollama = options.ollama ?? new OllamaProbe({ onState: (ok, d) => this.log.report('ollama', ok, d) });
        this.cpu = options.cpu ?? new CpuProbe();
        this.memory = options.memory ?? new MemoryProbe();
    }

    async getCpuMetrics(): Promise<CPUMetrics> {
        try {
            return await this.cpu.getMetrics();
        } catch (err) {
            this.log.report('cpu', false, err instanceof Error ? err.message : String(err));
            return { ...createEmptyMetrics().cpu, timestamp: Date.now() };
        }
    }

    async getMemoryMetrics(): Promise<MemoryMetrics> {
        try {
            return await this.memory.getMetrics();
        } catch (err) {
            this.log.report('memory', false, err instanceof Error ? err.message : String(err));
            return { ...createEmptyMetrics().memory, timestamp: Date.now() };
        }
    }

    async getGPUMetrics(): Promise<GPUMetrics> {
        try {
            const gpuUsage = await this.gpu.getGPUs();
            return { timestamp: Date.now(), totalGPUs: gpuUsage.length, gpuUsage };
        } catch (err) {
            this.log.report('gpu', false, err instanceof Error ? err.message : String(err));
            return { timestamp: Date.now(), totalGPUs: 0, gpuUsage: [] };
        }
    }

    async getOllamaMetrics(): Promise<OllamaMetrics> {
        try {
            return await this.ollama.getMetrics();
        } catch (err) {
            this.log.report('ollama', false, err instanceof Error ? err.message : String(err));
            return {
                timestamp: Date.now(),
                isRunning: false,
                loadedModels: [],
                availableModels: [],
                error: err instanceof Error ? err.message : String(err)
            };
        }
    }

    /** All sections in parallel — one slow probe never stalls the others. */
    async getAllMetrics(): Promise<AllMetrics> {
        const [cpu, memory, gpu, ollama] = await Promise.all([
            this.getCpuMetrics(),
            this.getMemoryMetrics(),
            this.getGPUMetrics(),
            this.getOllamaMetrics()
        ]);
        return { timestamp: Date.now(), cpu, memory, gpu, ollama };
    }
}
