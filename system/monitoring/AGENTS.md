# Development Guidelines for System Monitoring

## Project Structure

```
system/monitoring/
├── README.md
├── AGENTS.md                     # These development instructions
├── package.json                  # Root tooling: npm test / npm run typecheck
├── tsconfig.json
├── src/
│   ├── spec/
│   │   └── metrics.types.ts      # Canonical metrics specification — SINGLE SOURCE OF TRUTH
│   ├── collector/src/
│   │   ├── index.ts              # Service entrypoint: REST + WS on port 11367
│   │   ├── api.ts                # REST + SSE server over a MetricsSource
│   │   ├── ws.ts                 # WebSocket transport (single-client, localhost-only)
│   │   ├── mock-source.ts        # Deterministic mock producer (non-Windows fallback)
│   │   └── windows/              # TO IMPLEMENT — see "Implementation Plan"
│   │       ├── windows-metrics-source.ts  # MetricsSource for Windows (assembles probes)
│   │       ├── gpu-probe.ts               # nvidia-smi query + CSV parsing (variable GPU count)
│   │       ├── ollama-probe.ts            # Ollama HTTP probe (127.0.0.1:11434)
│   │       └── sys-probes.ts              # CPU deltas, memory/swap, network, disks
│   └── viewer/
│       ├── package.json           # Vite + React + xterm.js (web build)
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── index.html
│       └── src/
│           ├── index.ts          # TUI entrypoint (npm run tui)
│           ├── tui-app.ts        # ConnectTUI: connection popup + WS client + key handling
│           ├── terminal.ts       # MetricsTUI renderer (injectable writer, testable)
│           ├── graphs.ts         # Shared renderFrame — ONE source of ASCII graphs
│           ├── terminal-web.ts   # xterm.js pseudo-terminal (browser pipeline)
│           ├── api-source.ts     # API-backed MetricsSource (HTTP polling)
│           ├── App.tsx            # Stateless root component
│           ├── main.tsx           # React entry (Vite)
│           ├── hooks/             # useMetricsSource, useMetricsTerminal (custom hooks)
│           └── types.ts           # Re-exports the canonical spec
└── tests/
    ├── spec/data-spec.test.ts      # Specification structure + invariants + API contract
    ├── collector/ws-server.test.ts # WS transport: single-client + localhost policies
    ├── collector/windows-collector.test.ts # TO IMPLEMENT — fixture-driven probe/parsing tests
    ├── terminal/tui.test.ts        # Five-graph layout (CPU, MEM, GPU0–GPU2 row) + empty-state
    └── terminal/tui-connect.test.ts # Connection popup, editing, live end-to-end
```

## STATUS — Ready for implementation: Windows collector + variable GPU graphs

Everything downstream of the `MetricsSource` contract is done and tested:
the API server, the WebSocket transport, the mock producer, the TUI, and
the web viewer. Two work items remain. **Implementation runs on the
Windows partition of the development workstation** (npm is available in
both WSL and Windows there — always work on the Windows side). The
deployment targets are that workstation and a remote Windows system with
TWO NVIDIA GPUs; the GPU count must be treated as VARIABLE (collect 1..N,
display up to 3).

### Work item 1 — `WindowsMetricsSource` (the real producer)

Implement `src/collector/src/windows/windows-metrics-source.ts` as a
`MetricsSource` (contract: `src/spec/metrics.types.ts`). Compose it from
independently testable probes (`gpu-probe.ts`, `ollama-probe.ts`,
`sys-probes.ts`) per the structure tree above.

**Non-goal**: AMD/Intel GPU probing. Where no NVIDIA adapter is present,
`getGPUMetrics()` degrades gracefully to `{ totalGPUs: 0, gpuUsage: [] }`.

**Ground rules**

- Import all metric shapes from the spec module only; never redeclare.
- Erasable TypeScript ONLY — the service runs via plain `node src/...`
  (Node strips types at load). No enums, no namespaces, no constructor
  parameter properties. Relative imports keep explicit `.ts` extensions.
- Node ≥ 22.4 required (type stripping is stable AND the TUI uses the
  global `WebSocket` client; `fs.promises.statfs` needs ≥ 18.15).
- No new runtime dependencies: Node stdlib (`node:child_process`,
  `node:os`, `node:fs/promises`, global `fetch`) + the existing `ws`.
- Probes must never throw out of `getAllMetrics()` — a failing probe
  degrades its section to zeros/empty and logs once per state change.
- First poll must return valid data (the API server polls at start, before
  any delta window exists): CPU/network speeds are 0 on the first sample.

**Data sources per metric (Windows)**

1. **CPU** (`sys-probes.ts`) — keep the previous `os.cpus()` snapshot;
   per-poll deltas of `times` (`user`, `nice`, `sys`, `idle`, `irq`).
   `idleUsage = Δidle/Δtotal·100`; then `systemUsage = 100 − idleUsage`
   EXACTLY (the invariant `systemUsage + idleUsage = totalUsage` is
   asserted to 6 decimals); `userUsage = Δuser/Δtotal·100` (informational
   subset of busy). `threadCount = os.cpus().length`. `coreCount` from
   physical cores (WMI `Win32_Processor.NumberOfCores`, summed over
   sockets) with fallback to `NUMBER_OF_PROCESSORS`. `loadAverage`:
   omit on Windows (optional in the spec).

2. **Memory** (`sys-probes.ts`) — `total = os.totalmem()`,
   `available = os.freemem()` (on Windows this is avail-phys incl.
   standby), `used = total − available`, `free = available`
   (documented approximation). Swap: `Get-CimInstance Win32_PageFileUsage`
   → sum `AllocatedBaseSize` (MiB→bytes) = `swapTotal`, sum `CurrentUsage`
   = `swapUsed`; no pagefile → 0 and ratios 0 (guard division).
   `cached` from `Win32_PerfRawData_PerfOS_Memory.CacheBytes`; `buffers`
   has no Windows analog → 0.

3. **GPU** (`gpu-probe.ts`) — spawn per poll:

   ```
   nvidia-smi --query-gpu=index,name,utilization.gpu,memory.total,memory.used --format=csv,noheader,nounits
   ```

   One CSV row per GPU, e.g. `0, NVIDIA GeForce RTX 4090, 32, 24564, 11820`.
   Parse CSV-aware (names may contain spaces; quoted fields possible).
   **Memory values are MiB** — multiply by 1048576 for the spec's bytes.
   `utilization` clamp 0–100; `memoryUtilization = used/total·100`
   (guard total = 0); keep nvidia-smi's own indices (contiguous, sorted).
   3 s child-process timeout; missing binary / nonzero exit / parse
   failure → empty GPU section (see non-goal). Spawn cost (~50–150 ms)
   per 2 s tick is acceptable.

4. **Ollama** (`ollama-probe.ts`) — `GET http://127.0.0.1:11434/api/tags`
   → `availableModels` (`name`, `size` bytes, `details.quantization_level`
   → `quantization`); `GET .../api/ps` → `loadedModels` (resident now);
   `currentModel` = first loaded. ~1.5 s abort timeout per request.
   Offline/timeout → `isRunning: false`, empty arrays, `error` message.
   Preserve the invariant `loadedModels ⊆ availableModels` by filtering
   loaded names against the tag list.

5. **Network** (`sys-probes.ts`) —
   `Get-CimInstance Win32_PerfRawData_Tcpip_NetworkInterface` → per
   instance `Name`, `BytesReceivedPersec`, `BytesSentPersec`; despite the
   suffix these are PERF_COUNTER_BULK_COUNT raw values = CUMULATIVE bytes.
   `rxBytes`/`txBytes` = raw values; `rxSpeed`/`txSpeed` = Δraw/Δt against
   the previous poll (0 on first sample). Skip `isatap`/`Loopback`/pseudo
   instances. Each WMI call spawns PowerShell (`-NoProfile -NonInteractive`,
   `ConvertTo-Json -Compress`); consolidate swap+cache into ONE invocation.
   Optional later optimization: one persistent helper process streaming
   JSON lines instead of per-poll spawns.

6. **Disks** (`sys-probes.ts`) — `fs.promises.statfs` per fixed drive
   `A:\`–`Z:\` (skip on ENOENT/EACCES). `total = blocks·bsize`,
   `available = bavail·bsize`, `used = (blocks − bfree)·bsize`,
   `usagePercent = used/total·100`, `mount = "C:\"` form.

**Testing** — fixture-driven, no real GPU required: capture real
`nvidia-smi` output as a committed fixture (e.g.
`tests/fixtures/nvidia-smi-2gpu.csv`) and unit-test the parser against 0,
1, 2, 3+ GPU samples; same pattern for WMI JSON samples. CPU delta math
tested with synthetic `os.cpus()`-shaped snapshots. Live probes run under
`describe.skipIf(process.platform !== 'win32')`.

### Work item 2 — Variable GPU graph layout (viewer)

Rework `renderFrame()` in `src/viewer/src/graphs.ts` (shared by TUI and
web viewer, so both update together):

- Up to FIVE graphs: **CPU** (row 1), **MEM** (row 2), then
  **GPU0 + GPU1 + GPU2 side by side on ONE shared row**.
- The GPU row contains only GPUs present in `gpuUsage` (capped at 3);
  each block shows the utilisation bar, %, and VRAM `used/total`.
- Disconnected/empty snapshot renders all five placeholders with empty
  bars (stable layout).
- Update `tests/terminal/tui.test.ts`: empty-state must assert GPU0, GPU1,
  GPU2 placeholders; add variable-count cases (1-GPU snapshot → no GPU1/
  GPU2 blocks; 2-GPU → both on one row); keep the "no OLLAMA/NET/DISK"
  assertions and the shared-pipeline equality test.

### Wiring & acceptance

- `src/collector/src/index.ts`:
  `const source = process.platform === 'win32' ? new WindowsMetricsSource() : new MockMetricsSource();`
  — nothing else changes; REST + WS attach to whatever producer is set.
- `npm install`, `npm run typecheck`, `npm test` green on the Windows
  partition; then `npm run collector` + `npm run tui` → live graphs.
- Verify: second TUI instance refused (WS 1013); on the 2×NVIDIA remote,
  two GPU blocks render on the shared GPU row.

## Transport & Connection Policy (implemented and tested)

- **Transport**: WebSocket. The collector streams `AllMetrics` JSON
  snapshots to `ws://<host>:11367/ws` — same port as the REST API
  (`DEFAULT_PORT = 11367`), pushed every metrics interval.
- **Single-client policy**: the collector listens for ONLY the first
  connection on the port; further connections are closed with code 1013
  while one is active, and listening resumes automatically once that
  client disconnects. Implemented in `MetricsWebSocketServer`.
- **Localhost-only**: the collector accepts connections ONLY from
  localhost (127.0.0.1 / ::1) — enforced before the WebSocket handshake
  in `MetricsWebSocketServer`. The Windows service must bind to 127.0.0.1
  and must never expose the port beyond the host (Windows Firewall).
- **Graph restriction**: up to FIVE graphs — CPU (row 1), MEM (row 2),
  then GPU0 + GPU1 + GPU2 side by side on ONE shared row (only GPUs
  actually reported by the collector, capped at 3; all five render as
  empty placeholders while disconnected). The collector/API may still
  serve the full specification — ollama, network and disks are data-level
  only and intentionally not graphed.
- **TUI behaviour**: on start (and on every disconnect) the TUI shows
  empty graphs plus a centered connection popup prefilled with
  `localhost:11367`; Enter connects via WebSocket, typing edits the
  destination, Esc quits.

## Specification Rules

- All metric shapes live in `src/spec/metrics.types.ts` only. Never redeclare
  metric interfaces in producers or consumers; import from the spec.
- Producers implement the `MetricsSource` contract; the API server, mock
  source, and any future Windows collector all satisfy it.
- Units are documented in the spec header: timestamps in epoch ms, byte
  quantities in bytes, rates in bytes/s, percentages 0–100.
- Invariants guaranteed by producers and asserted by tests:
  `used = total − available`, `systemUsage + idleUsage = totalUsage`,
  utilisation ratios in 0–100, loaded models ⊆ available models.

## Technology Stack

- **Collector**: Node.js (≥ 22.4) with TypeScript, run via native type stripping
- **Viewer**: Node.js with TypeScript (TUI) and Vite + React (web)
- **Platforms**: implemented and deployed on Windows (NVIDIA GPUs via nvidia-smi);
  the mock source keeps every other platform runnable for tests

## Collector Development

### Metrics to Collect

1. **CPU**
   - Total CPU usage percentage
   - Core-specific usage (if available)
   - Load average
   - Thread count

2. **Memory**
   - Total memory
   - Used memory
   - Available memory
   - Swap usage
   - Memory usage breakdown (cached, buffers)

3. **GPU & Ollama**
   - Which models are loaded
   - Per-GPU utilization and VRAM usage (variable GPU count, 1..N — NVIDIA via nvidia-smi; AMD not supported)
   - Total GPU utilization
   - Process-specific memory allocation

4. **Disks**
   - I/O read/write speeds
   - Storage usage percentages

5. **Network**
   - Upload/download speeds
   - Active interfaces

### API Design

The collector should expose a REST API with endpoint structure:

```
GET  /api/metrics          # All metrics at once
GET  /api/cpu              # CPU metrics
GET  /api/memory           # Memory metrics
GET  /api/gpu              # GPU metrics
GET  /api/ollama          # Ollama-specific metrics
GET  /api/disks           # Disk metrics
GET  /api/network         # Network metrics
```

Response format: JSON with timestamped data for historical queries.

### Windows Service Registration

Use `node-windows` or `node-service`:

1. Create service configuration script
2. Install as Windows service
3. Test startup and graceful shutdown
4. Verify API is accessible

### Error Handling

- Graceful degradation when Ollama is offline
- Retry logic for network/API failures
- Logging to both file and event log
- Startup validation checks

## Viewer Development

### Polling Strategy

- Initial: Fast poll (1 second) to build state
- Normal: Slow poll (2-5 seconds) matching metrics update rate
- Fast refresh mode on user interaction

### Graphing Customization

Rather than using btop directly:
- Build custom visualization using Canvas/Terminal-Kitten
- Highlight Ollama-specific metrics prominently
- Color-code: active models, memory pressure, GPU stress

### Display Approach

Option A: btop integrated
- Use btop's API/hooks if available
- Customize shown_boxes and themes

Option B: Custom visualization
- Live graph overlay on top of raw metrics
- Color-coded status indicators
- Priority view for Ollama-related metrics

## Testing

### Unit Testing

For each component, test:
- Metrics collection returns valid types
- API endpoints return expected structure
- Error cases handle gracefully
- Data aggregation is correct

### Integration Testing

1. Start collector alone, verify API responds
2. Start viewer, verify polling works
3. Verify metrics accuracy vs. direct system queries (Task Manager, nvidia-smi, Get-Counter)
4. Verify on the 2×NVIDIA remote system: both GPUs render on the shared GPU row

### Cross-Platform Testing

- Node path handling for WSL/Windows
- Path separator handling
- Permission handling for reading system metrics
- Service registration/registration per platform

## Development Workflow

1. Implement collector metrics for one area (e.g., CPU)
2. Write tests, verify metrics are accurate
3. Expose via API, test with curl/Postman
4. Implement viewer polling for that endpoint
5. End-to-end test before adding more metrics
6. Add Windows service wrapping
7. Document limits and known issues

## Code Quality

- TypeScript with strict mode
- Docstrings explaining behavior and exceptions
- Consistent naming: camelCase for variables, PascalCase for types
- Modular design: metrics should be independently testable
- Logging at appropriate verbosity levels

## Performance Considerations

### Collector
- Avoid excessive system calls that could impact monitored system
- Batch related metrics into single API responses
- Compress JSON output when possible
- Consider streaming vs. request/response

### Viewer
- Don't poll more frequently than metrics are available
- Cache locally to reduce network traffic
- Request-only needed metrics rather than full state

## Documentation Per Feature

For each major feature (CPU metrics, Ollama tracking, etc.), maintain:
- What metrics are collected
- How they're aggregated
- API contract
- Accuracy caveats
- Performance impact
- Known issues
