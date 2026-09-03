import { createRoot } from 'react-dom/client';
import './vendor/xp/XP.css';
import './styles.css';
import { App } from './App.tsx';
import { ApiMetricsSource } from './api-source.ts';
import type { MetricsSource } from '../../spec/metrics.types.ts';

// Same origin: the collector serves this page on its own port (11367),
// so the API base is simply the origin the page was loaded from. While
// it is offline the frontend shows the empty-graphs state. For a
// standalone dev session `npm run dev` proxies /api to 11367. Swap in
// MockMetricsSource for an offline demo:
// import { MockMetricsSource } from '../../collector/src/mock-source.ts';
// const source: MetricsSource = new MockMetricsSource();
const source: MetricsSource = new ApiMetricsSource(window.location.origin);

createRoot(document.getElementById('root')!).render(<App source={source} pollMs={2000} />);
