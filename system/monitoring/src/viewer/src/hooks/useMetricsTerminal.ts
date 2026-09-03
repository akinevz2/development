import { useEffect, useRef, type RefObject } from 'react';
import { WebMetricsTerminal } from '../terminal-web.ts';
import type { AllMetrics } from '../../../spec/metrics.types.ts';

/**
 * Custom hook: owns the xterm.js pseudo-terminal lifecycle for a
 * container element and renders a frame whenever metrics change.
 */
export function useMetricsTerminal(container: RefObject<HTMLDivElement | null>, metrics: AllMetrics | null): void {
    const terminalRef = useRef<WebMetricsTerminal | null>(null);

    useEffect(() => {
        if (!container.current) return;
        const terminal = new WebMetricsTerminal(container.current);
        terminalRef.current = terminal;
        return () => {
            terminal.dispose();
            terminalRef.current = null;
        };
    }, [container]);

    useEffect(() => {
        if (terminalRef.current && metrics) {
            terminalRef.current.render(metrics);
        }
    }, [metrics]);
}
