import type { OllamaMetrics, OllamaModel } from '../../../spec/metrics.types.ts';

export interface OllamaProbeOptions {
    /** Base URL of the Ollama HTTP API. */
    baseUrl?: string;
    /** Abort timeout per request in ms (AGENTS.md: ~1.5 s). */
    timeoutMs?: number;
    /** State sink: ok=false only when the service is unreachable. */
    onState?: (ok: boolean, detail?: string) => void;
}

/** Wire shape of GET /api/tags (only the fields we consume). */
interface TagsResponse {
    models?: { name?: unknown; size?: unknown; details?: { quantization_level?: unknown } }[];
}

/** Wire shape of GET /api/ps (only the fields we consume). */
interface PsResponse {
    models?: { name?: unknown }[];
}

const toModel = (raw: { name?: unknown; size?: unknown; details?: { quantization_level?: unknown } }): OllamaModel | null => {
    if (typeof raw.name !== 'string' || raw.name.length === 0) return null;
    const model: OllamaModel = {
        name: raw.name,
        size: typeof raw.size === 'number' && Number.isFinite(raw.size) ? raw.size : 0
    };
    const quantization = raw.details?.quantization_level;
    if (typeof quantization === 'string' && quantization.length > 0) model.quantization = quantization;
    return model;
};

/**
 * Ollama HTTP probe (127.0.0.1:11434). /api/tags yields the available
 * models; /api/ps the resident ones. Offline or timeout degrades to
 * `isRunning: false` with empty arrays and an `error` message; loaded
 * models are filtered against the tag list so the invariant
 * `loadedModels ⊆ availableModels` always holds. Never throws.
 */
export class OllamaProbe {
    private readonly baseUrl: string;
    private readonly timeoutMs: number;
    private readonly onState?: (ok: boolean, detail?: string) => void;

    constructor(options: OllamaProbeOptions = {}) {
        this.baseUrl = options.baseUrl ?? 'http://127.0.0.1:11434';
        this.timeoutMs = options.timeoutMs ?? 1500;
        this.onState = options.onState;
    }

    async getMetrics(): Promise<OllamaMetrics> {
        let available: OllamaModel[];
        let loadedNames: string[];
        try {
            const [tags, ps] = await Promise.all([this.fetchJson('/api/tags'), this.fetchJson('/api/ps')]);
            available = (tags as TagsResponse).models?.map(toModel).filter((m): m is OllamaModel => m !== null) ?? [];
            loadedNames = (ps as PsResponse).models
                ?.map((m) => (typeof m.name === 'string' ? m.name : null))
                .filter((n): n is string => n !== null) ?? [];
        } catch (err) {
            this.onState?.(false, err instanceof Error ? err.message : String(err));
            return {
                timestamp: Date.now(),
                isRunning: false,
                loadedModels: [],
                availableModels: [],
                error: `Ollama offline or timed out (${this.baseUrl})`
            };
        }
        this.onState?.(true);
        // preserve loadedModels ⊆ availableModels by filtering names against the tag list
        const loaded = loadedNames
            .map((name) => available.find((m) => m.name === name))
            .filter((m): m is OllamaModel => m !== undefined);
        return {
            timestamp: Date.now(),
            isRunning: true,
            currentModel: loaded.length > 0 ? loaded[0] : undefined,
            loadedModels: loaded,
            availableModels: available
        };
    }

    private async fetchJson(path: string): Promise<unknown> {
        const res = await fetch(`${this.baseUrl}${path}`, { signal: AbortSignal.timeout(this.timeoutMs) });
        if (!res.ok) throw new Error(`${path} responded ${res.status}`);
        return res.json();
    }
}
