import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { MockMetricsSource } from '../../collector/src/mock-source.ts';
// Swap in the API-backed source once the Windows collector is running:
// import { ApiMetricsSource } from './api-source.ts';
// const source = new ApiMetricsSource('http://localhost:3000');

const source = new MockMetricsSource();

createRoot(document.getElementById('root')!).render(<App source={source} pollMs={2000} />);
