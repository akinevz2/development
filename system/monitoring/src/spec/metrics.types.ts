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

/**
 * Zero-value snapshot: every section present, every usage at 0.
 * Rendered as "empty graphs" by the frontends while disconnected.
 */
export function createEmptyMetrics(): AllMetrics {
    return {
        timestamp: 0,
        cpu: {
            timestamp: 0,
            systemUsage: 0,
            userUsage: 0,
            idleUsage: 100,
            totalUsage: 100,
            threadCount: 0,
            coreCount: 0
        },
        memory: {
            timestamp: 0,
            total: 0,
            used: 0,
            available: 0,
            free: 0,
            swapTotal: 0,
            swapUsed: 0,
            cached: 0,
            buffers: 0,
            allocationRatio: 0,
            swapAllocationRatio: 0
        },
        gpu: { timestamp: 0, totalGPUs: 0, gpuUsage: [] },
        ollama: { timestamp: 0, isRunning: false, loadedModels: [], availableModels: [] },
        network: { timestamp: 0, interfaces: {} },
        disks: { timestamp: 0, disks: [] }
    };
}
