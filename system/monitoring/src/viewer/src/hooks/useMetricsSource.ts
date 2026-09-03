import { useEffect, useState } from 'react';
import type { AllMetrics, MetricsSource } from '../../../spec/metrics.types.ts';

/**
 * Custom hook: polls a MetricsSource on an interval and returns the
 * latest AllMetrics snapshot (null until the first poll completes).
 */
export function useMetricsSource(source: MetricsSource, pollMs: number): AllMetrics | null {
    const [metrics, setMetrics] = useState<AllMetrics | null>(null);

    useEffect(() => {
        let cancelled = false;
        const tick = async (): Promise<void> => {
            try {
                const next = await source.getAllMetrics();
                if (!cancelled) setMetrics(next);
            } catch (error) {
                console.error('[viewer] metrics poll failed:', error);
            }
        };
        void tick();
        const timer = setInterval(() => void tick(), pollMs);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [source, pollMs]);

    return metrics;
}
