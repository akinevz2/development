import { useRef } from 'react';
import { useMetricsSource } from './hooks/useMetricsSource.ts';
import { useMetricsTerminal } from './hooks/useMetricsTerminal.ts';
import type { MetricsSource } from '../../spec/metrics.types.ts';

interface AppProps {
    source: MetricsSource;
    pollMs?: number;
}

/** Stateless root component — XP-chrome around the terminal pipeline. */
export function App({ source, pollMs = 2000 }: AppProps): JSX.Element {
    const metrics = useMetricsSource(source, pollMs);
    const containerRef = useRef<HTMLDivElement>(null);
    useMetricsTerminal(containerRef, metrics);
    const live = metrics !== null && Date.now() - metrics.timestamp < pollMs * 2;
    const clock = new Date(metrics?.timestamp ?? Date.now()).toLocaleTimeString();

    return (
        <div className="desktop">
            <div className="window monitor-window">
                <div className="title-bar">
                    <div className="title-bar-text">System Monitor — cpu / mem / gpu0 / gpu1</div>
                    <div className="title-bar-controls">
                        <button aria-label="Minimize" />
                        <button aria-label="Maximize" />
                        <button aria-label="Close" />
                    </div>
                </div>
                <div className="window-body">
                    <div className="terminal-field" ref={containerRef} />
                </div>
                <div className="status-bar">
                    <div className="status-bar-field">Destination: ws://localhost:11367/ws</div>
                    <div className="status-bar-field">{live ? 'Receiving data' : 'No data'}</div>
                    <div className="status-bar-field">Graphs: cpu, mem, gpu0, gpu1</div>
                </div>
            </div>
            <div className="taskbar">
                <div className="taskbar-item">System Monitor</div>
                <div className="taskbar-clock">{clock}</div>
            </div>
        </div>
    );
}
