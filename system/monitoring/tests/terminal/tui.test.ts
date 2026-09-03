import { describe, it, expect } from 'vitest';
import { MetricsTUI } from '../../src/viewer/src/terminal';
import { MetricsGraphRenderer, geometryFor, paintFrame } from '../../src/viewer/src/graphs';
import { createEmptyMetrics } from '../../src/spec/metrics.types';
import { MockMetricsSource } from '../../src/collector/src/mock-source';
import type { AllMetrics } from '../../src/spec/metrics.types';

const renderToString = (metrics: AllMetrics): string => {
    let out = '';
    new MetricsTUI((chunk) => (out += chunk), { clearScreen: false }).render(metrics);
    return out;
};

const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, '');

const blockOf = (frame: string, name: string): string => {
    const start = frame.indexOf(`╭ ${name} `);
    const end = frame.indexOf('╰', start);
    return frame.slice(start, end + 1);
};

const withUsage = (usage: Partial<Record<'cpu' | 'mem' | 'gpu0' | 'gpu1', number>>): AllMetrics => ({
    timestamp: Date.now(),
    cpu: { timestamp: 0, systemUsage: usage.cpu ?? 0, userUsage: 0, idleUsage: 100 - (usage.cpu ?? 0), totalUsage: 100, threadCount: 8, coreCount: 4 },
    memory: { timestamp: 0, total: 100, used: usage.mem ?? 0, available: 100 - (usage.mem ?? 0), free: 0, allocationRatio: usage.mem ?? 0 },
    gpu: {
        timestamp: 0,
        totalGPUs: 2,
        gpuUsage: [
            { index: 0, name: 'g0', utilization: usage.gpu0 ?? 0, memoryTotal: 1, memoryUsed: 0, memoryUtilization: 0 },
            { index: 1, name: 'g1', utilization: usage.gpu1 ?? 0, memoryTotal: 1, memoryUsed: 0, memoryUtilization: 0 }
        ]
    },
    ollama: { timestamp: 0, isRunning: false, loadedModels: [], availableModels: [] }
});

const source = new MockMetricsSource();

describe('TUI rendering pipeline', () => {
    it('places CPU and MEM side by side, both GPUs as four graphs on one row below', async () => {
        const out = renderToString(await source.getAllMetrics());
        const lines = out.split('\n');
        const cpuMemRow = lines.find((l) => l.includes('╭ CPU ') && l.includes('╭ MEM '));
        const gpuRow = lines.find((l) =>
            l.includes('╭ GPU0 UTIL ') &&
            l.includes('╭ GPU0 VRAM ') &&
            l.includes('╭ GPU1 UTIL ') &&
            l.includes('╭ GPU1 VRAM ')
        );
        expect(cpuMemRow).toBeDefined(); // row 1: CPU | MEM
        expect(gpuRow).toBeDefined(); // row 2: all four GPU graphs on ONE line
        expect(lines.indexOf(cpuMemRow!)).toBeLessThan(lines.indexOf(gpuRow!)); // gpus below
        expect(out).toMatch(/OLLAMA  llama3:8b \(Q4_K_M\) · 1\/3 loaded/); // info row under the graphs
        for (const absent of ['NET', 'DISK']) {
            expect(out).not.toContain(absent);
        }
    });

    it('renders the newest sample in the rightmost column, pushing older data left', () => {
        const r = new MetricsGraphRenderer();
        for (let i = 0; i < 60; i++) r.push(withUsage({ cpu: 0 }));
        expect((stripAnsi(blockOf(r.renderFrame(), 'CPU')).match(/⣿/g) ?? []).length).toBe(0);

        for (let i = 0; i < 60; i++) r.push(withUsage({ cpu: 100 })); // sustained 100%
        // CPU is a two-box row: 27 cells x 6 rows filled solid
        expect((stripAnsi(blockOf(r.renderFrame(), 'CPU')).match(/⣿/g) ?? []).length).toBe(162);

        r.push(withUsage({ cpu: 0 })); // one sample later it is pushed left
        const top = stripAnsi(blockOf(r.renderFrame(), 'CPU').split('\n')[1]);
        expect(top).toContain('⡇│ '); // CPU box: filled column drops to the new baseline
        // the transition + rightmost cells are no longer fully filled (26 cells x 6 rows remain solid)
        expect((stripAnsi(blockOf(r.renderFrame(), 'CPU')).match(/⣿/g) ?? []).length).toBe(156);
    });

    it('shows empty boxes before any data arrives', () => {
        const empty = new MetricsGraphRenderer().renderFrame();
        expect(empty).toContain('--'); // no timestamp yet
        expect(empty).toContain('\u2800'.repeat(27)); // fully blank two-box-row graph row

        const zeros = renderToString(createEmptyMetrics()); // a pushed all-zero snapshot
        expect(zeros).toContain('⣀'); // baseline: bottom dot row lit across the bar
    });

    it('draws aligned boxes: every box borders and graph rows share one width', () => {
        // width 80: half boxes get 40 cells, quarter boxes (2 GPUs) get 20
        const r = new MetricsGraphRenderer({ width: 80, height: 4 });
        r.push(withUsage({ cpu: 50, mem: 50, gpu0: 50, gpu1: 50 }));
        const lines = stripAnsi(r.renderFrame()).split('\n');
        // group lines into row blocks: each ╭ line through its ╰ line
        const rows: string[][] = [];
        let current: string[] | null = null;
        for (const line of lines) {
            if (line.startsWith('╭')) {
                current = [line];
            } else if (current) {
                current.push(line);
                if (line.startsWith('╰')) {
                    rows.push(current);
                    current = null;
                }
            }
        }
        expect(rows.length).toBe(2); // CPU|MEM row + the four-GPU row
        // side-by-side boxes share lines, so every line in a row block
        // must have the same length iff every box is internally aligned
        expect(rows[0].every((l) => l.length === rows[0][0].length)).toBe(true);
        expect(rows[1].every((l) => l.length === rows[1][0].length)).toBe(true);
        // THE alignment invariant: the 2-box row and the 4-box row span
        // the same width (pair cells = 2q+3 makes 2·(c+2)+1 = 4·(q+2)+3)
        expect(rows[0][0].length).toBe(91);
        expect(rows[1][0].length).toBe(91);
        expect(rows[0][0].length).toBe(rows[1][0].length);
    });

    it('sizes the framebuffer to fill the renderable area', () => {
        const { width, height } = geometryFor(80, 24);
        expect(width).toBe(68); // 80 minus the left frame pad and 4-box row borders/gaps
        const frame = new MetricsGraphRenderer({ width, height }).renderFrame();
        const lines = frame.split('\n').filter((l) => l.length > 0);
        expect(lines.length).toBeLessThanOrEqual(24);
        expect(Math.max(...lines.map((l) => l.length))).toBeLessThanOrEqual(80);
    });

    it('paints frames in place: no full clear, no scroll', () => {
        const painted = paintFrame('abc\ndef\n');
        expect(painted.startsWith('\x1b[?2026h\x1b[H')).toBe(true); // synchronized + home
        expect(painted).not.toContain('\x1b[2J'); // no full clear -> no flash
        expect(painted).toContain('\x1b[K'); // erase to EOL repaints in place
        expect(painted.endsWith('\x1b[J\x1b[?2026l')).toBe(true);
        expect((painted.match(/\r\n/g) ?? []).length).toBe(1); // no trailing newline -> no scroll
    });

    it('renders the identical frame as the web pseudo-terminal (shared pipeline)', async () => {
        const metrics = await source.getAllMetrics();
        const r = new MetricsGraphRenderer();
        r.push(metrics);
        expect(renderToString(metrics)).toBe(r.renderFrame());
    });
});
