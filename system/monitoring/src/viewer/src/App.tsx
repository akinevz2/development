import { useRef } from 'react';
import { useMetricsSource } from './hooks/useMetricsSource.ts';
import { useMetricsTerminal } from './hooks/useMetricsTerminal.ts';
import type { MetricsSource } from '../../spec/metrics.types.ts';

interface AppProps {
    source: MetricsSource;
    pollMs?: number;
}

/** Stateless root component — all state lives in the custom hooks. */
export function App({ source, pollMs = 2000 }: AppProps): JSX.Element {
    const metrics = useMetricsSource(source, pollMs);
    const containerRef = useRef<HTMLDivElement>(null);
    useMetricsTerminal(containerRef, metrics);

    return (
        <div
            ref={containerRef}
            style={{ width: '100vw', height: '100vh', background: '#000000', padding: 8, boxSizing: 'border-box' }}
        />
    );
}
