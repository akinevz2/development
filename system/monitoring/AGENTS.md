# Development Guidelines for System Monitoring

## Project Structure

```
system/monitoring/
├── README.md
├── AGENTS.md                     # These development instructions
├── package.json                  # Root tooling: npm test / npm run typecheck
├── tsconfig.json
├── scripts/
│   ├── install-service.ps1       # Register collector as a per-user logon task (Task Scheduler)
│   ├── reinstall-service.ps1     # npm run reinstall-service: verify + rebuild viewer + reinstall
│   └── uninstall-service.ps1     # Stop + remove the task
├── src/
│   ├── spec/
│   │   └── metrics.types.ts      # Canonical metrics specification — SINGLE SOURCE OF TRUTH
│   ├── collector/src/
│   │   ├── index.ts              # Service entrypoint: REST + WS + viewer on port 11367
│   │   ├── api.ts                # REST + SSE server over a MetricsSource
│   │   ├── static.ts             # Serves the built viewer (dist) at / and /assets/*
│   │   ├── ws.ts                 # WebSocket transport (single-client, localhost-only)
│   │   ├── mock-source.ts        # Deterministic mock producer (non-Windows fallback)
│   │   └── windows/              # Windows producer (probe-backed MetricsSource)
│   │       ├── windows-metrics-source.ts  # MetricsSource for Windows (assembles probes)
│   │       ├── gpu-probe.ts               # nvidia-smi query + CSV parsing (variable GPU count)
│   │       ├── ollama-probe.ts            # Ollama HTTP probe (127.0.0.1:11434)
│   │       └── sys-probes.ts              # CPU deltas + plain-RAM memory
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
│           ├── App.tsx            # Stateless root component (XP-chrome layout)
│           ├── styles.css         # Desktop/taskbar/terminal-field styles complementing the theme
│           ├── vendor/xp/         # Vendored XP.css theme + fonts + MIT license
│           ├── main.tsx           # React entry (Vite)
│           ├── hooks/             # useMetricsSource, useMetricsTerminal (custom hooks)
│           └── types.ts           # Re-exports the canonical spec
└── tests/
    ├── spec/data-spec.test.ts      # Specification structure + invariants + API contract
    ├── collector/ws-server.test.ts # WS transport: single-client + localhost policies
    ├── collector/windows-collector.test.ts # DEFERRED — fixture-driven probe/parsing tests
    ├── terminal/tui.test.ts        # Shared-frame layout (CPU|MEM row, GPU rows, OLLAMA info) + empty-state
    └── terminal/tui-connect.test.ts # Connection popup, editing, live end-to-end
```

## STATUS — Windows collector and viewer layout implemented

Everything is implemented and tested: the API server, the WebSocket
transport, the mock producer, the Windows producer (nvidia-smi GPU,
Ollama HTTP, CPU deltas, plain-RAM memory), the TUI, and the web viewer.
**Scope**: CPU usage, RAM usage, GPU usage and Ollama model information —
network and disk collection were deliberately removed from the spec.
**Implementation runs on the Windows partition of the development
workstation** (npm is available in both WSL and Windows there — always
work on the Windows side). The deployment targets are that workstation
and a remote Windows system with TWO NVIDIA GPUs; the GPU count must be
treated as VARIABLE (collect 1..N, display up to 3).

Remaining known work: fixture-driven probe/parsing tests
(`tests/collector/windows-collector.test.ts`) are deferred — see the
Testing note in work item 1.

### Work item 1 — `WindowsMetricsSource` (the real producer) — IMPLEMENTED

`src/collector/src/windows/windows-metrics-source.ts` is a `MetricsSource`
(contract: `src/spec/metrics.types.ts`) composed from independently
testable probes (`gpu-probe.ts`, `ollama-probe.ts`, `sys-probes.ts`) per
the structure tree above. Verified live on this workstation (2× NVIDIA,
real Ollama) via `npm run collector` + the REST API.

**Non-goal**: AMD/Intel GPU probing. Where no NVIDIA adapter is present,
`getGPUMetrics()` degrades gracefully to `{ totalGPUs: 0, gpuUsage: [] }`.

**Ground rules**

- Import all metric shapes from the spec module only; never redeclare.
- Erasable TypeScript ONLY — the service runs via plain `node src/...`
  (Node strips types at load). No enums, no namespaces, no constructor
  parameter properties. Relative imports keep explicit `.ts` extensions.
- Node ≥ 22.4 required (type stripping is stable AND the TUI uses the
  global `WebSocket` client).
- No new runtime dependencies: Node stdlib (`node:child_process`,
  `node:os`, global `fetch`) + the existing `ws`.
- Probes must never throw out of `getAllMetrics()` — a failing probe
  degrades its section to zeros/empty and logs once per state change.
- First poll must return valid data (the API server polls at start, before
  any delta window exists): CPU usage is 0 on the first sample.

**Data sources per metric (Windows)**

1. **CPU** (`sys-probes.ts`) — keep the previous `os.cpus()` snapshot;
   per-poll deltas of `times` (`user`, `nice`, `sys`, `idle`, `irq`).
   `idleUsage = Δidle/Δtotal·100`; then `systemUsage = 100 − idleUsage`
   EXACTLY (the invariant `systemUsage + idleUsage = totalUsage` is
   asserted to 6 decimals); `userUsage = Δuser/Δtotal·100` (informational
   subset of busy). `threadCount = os.cpus().length`. `coreCount` from
   physical cores (WMI `Win32_Processor.NumberOfCores`, summed over
   sockets, resolved once and cached) with fallback to
   `NUMBER_OF_PROCESSORS`. `loadAverage`: omit on Windows (optional in
   the spec).

2. **Memory** (`sys-probes.ts`) — plain RAM only, zero WMI:
   `total = os.totalmem()`, `available = os.freemem()` (on Windows this
   is avail-phys incl. standby), `used = total − available`,
   `free = available` (documented approximation),
   `allocationRatio = used/total·100`. Swap/cached/buffers were removed
   from the spec (scope: RAM usage only).

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
   `currentModel` = first loaded. ~1.5 s abort timeout, both requests in
   parallel. Offline/timeout → `isRunning: false`, empty arrays, `error`
   message. Preserve the invariant `loadedModels ⊆ availableModels` by
   filtering loaded names against the tag list.

**Testing (deferred)** — fixture-driven, no real GPU required: capture
real `nvidia-smi` output as a committed fixture (e.g.
`tests/fixtures/nvidia-smi-2gpu.csv`) and unit-test the parser against 0,
1, 2, 3+ GPU samples; CPU delta math tested with synthetic
`os.cpus()`-shaped snapshots. Live probes run under
`describe.skipIf(process.platform !== 'win32')`.

### Work item 2 — Variable GPU graph layout (viewer) — IMPLEMENTED

`src/viewer/src/graphs.ts` (`MetricsGraphRenderer`, shared by TUI and web
viewer, so both update together):

- Row 1: **CPU** and **MEM** side by side (half width each); the GPU
  pairs pack two per row — each GPU a quarter-width
  utilisation|VRAM pair, so two GPUs render four graphs on ONE row
  (a single GPU keeps its pair at half width).
- Only GPUs present in `gpuUsage` are drawn (variable 1..N).
- An **OLLAMA information row** (text, not a graph) follows the graphs:
  current model + quantization + loaded/available counts, `offline`
  when unreachable, `—` placeholder while disconnected (stable layout).
- Graphs are btop-style FILLED braille time-series; disconnected state
  renders empty boxes (stable layout).

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
- **Graph restriction & layout**: row 1 = CPU and MEM side by side
  (half width each); the GPUs pack two per row — each GPU as a
  quarter-width utilisation|VRAM pair, so a 2-GPU system shows all
  four GPU graphs on ONE row (a single GPU keeps its pair at half
  width). Only GPUs actually reported by the collector are drawn
  (empty boxes as placeholders until data arrives). Graphs are
  btop-style FILLED braille time-series (newest sample in the
  rightmost column, older samples pushed left, area under the curve
  solid), rendered empty while disconnected. Frames are indented one
  column from the left edge (FRAME_PAD), and all rows span the same
  width: each box on a 2-box row spans 2q+3 cells (q = the
  quarter-width box), so the row spans 2·(2q+3)+5 = 4q+11 — exactly
  the width of a 4-box row. An OLLAMA information row (current model
  + loaded/available counts, text only) follows the graphs; the
  ollama section is never graphed, and network/disks are no longer collected.
- **Viewer hosting**: the collector serves the built web viewer
  (`src/viewer/dist`) at `/` and `/assets/*` on the same port and
  origin as the API — the browser loads the page from the collector
  and then talks REST to it; no separate webserver (no vite preview /
  4173). Rebuild with `npm run build` in `src/viewer` and reload;
  a missing `dist` degrades to API-only with a startup hint.
- **Theming**: the web viewer is skinned with the Windows XP theme. The
  `xp.css` npm package (0.2.6) is outdated and its build system carries
  vulnerabilities, so the prebuilt `dist/XP.css` + font files are
  VENDORED at `src/viewer/src/vendor/xp/` (taken from the local copy in
  `personal/website/node_modules/xp.css`). Do NOT add `xp.css` as an npm
  dependency; update the vendored files by re-copying from a trusted
  built copy instead.
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
  quantities in bytes, percentages 0–100.
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
   - Thread count

2. **Memory**
   - Total memory
   - Used memory
   - Available memory

3. **GPU & Ollama**
   - Which models are loaded
   - Per-GPU utilization and VRAM usage (variable GPU count, 1..N — NVIDIA via nvidia-smi; AMD not supported)
   - Total GPU utilization
   - Process-specific memory allocation

### API Design

The collector exposes a REST API with endpoint structure:

```
GET  /api/metrics          # All metrics at once
GET  /api/cpu              # CPU metrics
GET  /api/memory           # Memory metrics
GET  /api/gpu              # GPU metrics
GET  /api/ollama          # Ollama-specific metrics
```

Response format: JSON with timestamped data for historical queries.

### Windows Service Registration

Implemented via the Task Scheduler (per-user logon task, no admin
required) in `scripts/`:

- `scripts\install-service.ps1` — registers `SystemMonitorCollector`:
  starts at logon (hidden), single-instance (`IgnoreNew`), restarts on
  failure (3×, 1 min apart), no execution time limit, logs appended to
  `%LOCALAPPDATA%\system-monitoring\collector.log`. `-StartNow` starts
  the collector immediately after registering.
- `scripts\uninstall-service.ps1` — stops the task (killing its node
  process tree) and unregisters it.

Because it is a logon task, the collector starts at sign-in and stops
when the session ends. A real Windows service (`node-windows` or
`node-service`, boot-time and session-independent) remains the long-term
alternative; the npm packages are deliberately not added as dependencies
until that switch happens.

1. Register with the install script
2. Test startup at logon and graceful shutdown at logoff
3. Verify API is accessible on 127.0.0.1

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
