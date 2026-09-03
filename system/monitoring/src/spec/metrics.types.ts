/**
 * Canonical metrics specification — single source of truth.
 * All producers (collector API) and consumers (web viewer, TUI) must
 * import types from this module. Do not redeclare metric shapes elsewhere.
 *
 * Units:
 *  - timestamps .......... unix epoch milliseconds
 *  - byte quantities ..... bytes
 *  - rates ............... bytes/second
 *  - percentages ......... 0–100 (floating point)
 */

export interface CPUMetrics {
    timestamp: number;
    /** Total busy percentage across all cores. */
    systemUsage: number;
    userUsage: number;
    idleUsage: number;
    /** Always 100; reference scale for usage percentages. */
    totalUsage: number;
    loadAverage?: {
        oneMinute: number;
        fiveMinutes: number;
        fifteenMinutes: number;
    };
    threadCount: number;
    coreCount: number;
}

export interface MemoryMetrics {
    timestamp: number;
    /** bytes */
    total: number;
    used: number;
    available: number;
    free: number;
    swapTotal: number;
    swapUsed: number;
    cached: number;
    buffers: number;
    /** used / total * 100 */
    allocationRatio: number;
    /** swapUsed / swapTotal * 100 */
    swapAllocationRatio: number;
}

export interface GPUInfo {
    /** Zero-based device index (gpu0, gpu1, ...). */
    index: number;
    name: string;
    utilization: number;
    /** bytes */
    memoryTotal: number;
    memoryUsed: number;
    memoryUtilization: number;
}

export interface GPUMetrics {
    timestamp: number;
    totalGPUs: number;
    gpuUsage: GPUInfo[];
}

export interface OllamaModel {
    name: string;
    /** bytes on disk */
    size: number;
    quantization?: string;
}

export interface OllamaMetrics {
    timestamp: number;
    isRunning: boolean;
    /** Model currently serving requests, if any. */
    currentModel?: OllamaModel;
    /** Models resident in memory right now. */
    loadedModels: OllamaModel[];
    /** Models present on disk and available to load. */
    availableModels: OllamaModel[];
    error?: string;
}

export interface NetworkMetrics {
    timestamp: number;
    interfaces: {
        [name: string]: {
            /** bytes since boot */
            rxBytes: number;
            txBytes: number;
            /** bytes/second */
            rxSpeed: number;
            txSpeed: number;
        };
    };
}

export interface DiskMetrics {
    timestamp: number;
    disks: {
        mount: string;
        total: number;
        used: number;
        available: number;
        usagePercent: number;
    }[];
}

export interface AllMetrics {
    timestamp: number;
    cpu: CPUMetrics;
    memory: MemoryMetrics;
    gpu: GPUMetrics;
    ollama: OllamaMetrics;
    network: NetworkMetrics;
    disks: DiskMetrics;
}

/** Contract every metrics producer must satisfy (real collector or mock). */
export interface MetricsSource {
    getCpuMetrics(): Promise<CPUMetrics>;
    getMemoryMetrics(): Promise<MemoryMetrics>;
    getGPUMetrics(): Promise<GPUMetrics>;
    getOllamaMetrics(): Promise<OllamaMetrics>;
    getNetworkMetrics(): Promise<NetworkMetrics>;
    getDiskMetrics(): Promise<DiskMetrics>;
    getAllMetrics(): Promise<AllMetrics>;
}
