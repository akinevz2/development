import { createRoot } from 'react-dom/client';
import './vendor/xp/XP.css';
import './styles.css';
import { App } from './App.tsx';
import { ApiMetricsSource } from './api-source.ts';
import type { MetricsSource } from '../../spec/metrics.types.ts';

// Real collector endpoint; while it is offline the frontend shows the
// empty-graphs state. Swap in MockMetricsSource for a standalone demo:
// import { MockMetricsSource } from '../../collector/src/mock-source.ts';
// const source: MetricsSource = new MockMetricsSource();
const source: MetricsSource = new ApiMetricsSource('http://localhost:11367');

createRoot(document.getElementById('root')!).render(<App source={source} pollMs={2000} />);
