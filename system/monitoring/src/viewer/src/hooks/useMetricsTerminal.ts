import { useEffect, useRef, type RefObject } from 'react';
import { WebMetricsTerminal } from '../terminal-web.ts';
import { useElementSize, type ElementSize } from './useElementSize.ts';
import type { AllMetrics } from '../../../spec/metrics.types.ts';

/**
 * Custom hook: owns the xterm.js pseudo-terminal lifecycle for a
 * container element, keeps the graph framebuffer sized to the
 * renderable area (via useElementSize), and renders a frame whenever
 * metrics change. Renders EMPTY graphs until data arrives.
 */
export function useMetricsTerminal(
    container: RefObject<HTMLDivElement | null>,
    metrics: AllMetrics | null
): void {
    const terminalRef = useRef<WebMetricsTerminal | null>(null);
    const size: ElementSize | null = useElementSize(container);

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
        if (size) terminalRef.current?.resizeToFit();
    }, [size]);

    useEffect(() => {
        terminalRef.current?.render(metrics);
    }, [metrics]);
}
