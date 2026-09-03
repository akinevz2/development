# System Monitoring Solution

Dual-component monitoring system for cross-platform resource tracking:

## Components

### 1. Collector (Windows)
- System metrics (CPU, RAM, GPU)
- Ollama server status (running models, memory usage, GPU)
- Exposes HTTP API and hosts the built dashboard (same port, same origin)

### 2. Viewer
- Polls collector API
- Real-time graphing of metrics
- Focus: GPU/memory usage for Ollama

## Technology Stack

- **Spec**: `src/spec/metrics.types.ts` — single source of truth for all metric shapes
- **Collector**: Node.js (≥ 22.4) + TypeScript (API + WS transport + Windows producer via nvidia-smi/Ollama/WMI probes)
- **Viewer (web)**: Vite + React (TSX, functional components + custom hooks) with an xterm.js pseudo-terminal, skinned with the vendored Windows XP theme (`src/viewer/src/vendor/xp/` — no npm dependency)
- **Viewer (TUI)**: plain Node renderer sharing the same `renderFrame()` graphs
- **Tests**: Vitest — `npm test`, `npm run typecheck`

## Project Structure

```
system/monitoring/
├── README.md
├── AGENTS.md                     # Development instructions
├── package.json                  # Root tooling (vitest, tsc)
├── tsconfig.json
├── scripts/
│   ├── install-service.ps1       # Register collector as a per-user logon task (Task Scheduler)
│   └── uninstall-service.ps1     # Stop + remove the task
├── src/
│   ├── spec/
│   │   └── metrics.types.ts      # Canonical metrics specification (single source of truth)
│   ├── collector/                # Windows-side collector (API + WS + Windows producer)
│   │   └── src/
│   │       ├── index.ts            # Entrypoint: REST + WS + viewer on port 11367
│   │       ├── api.ts              # REST + SSE server over any MetricsSource
│   │       ├── static.ts           # Serves the built viewer (dist) at / and /assets/*
│   │       ├── ws.ts               # WebSocket transport (single-client, localhost-only)
│   │       ├── mock-source.ts      # Deterministic mock producer (non-Windows fallback)
│   │       └── windows/            # Windows producer (probe-backed MetricsSource)
│   │           ├── windows-metrics-source.ts  # MetricsSource for Windows (assembles probes)
│   │           ├── gpu-probe.ts               # nvidia-smi query + CSV parsing
│   │           ├── ollama-probe.ts            # Ollama HTTP probe
│   │           └── sys-probes.ts              # CPU deltas + plain-RAM memory
│   └── viewer/
│       ├── package.json           # Vite + React + xterm.js (web build)
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── index.html
│       └── src/
│           ├── index.ts           # TUI entrypoint (npm run tui)
│           ├── terminal.ts        # MetricsTUI renderer (injectable writer, testable)
│           ├── graphs.ts          # Shared renderFrame — ONE source of ASCII graphs
│           ├── terminal-web.ts    # xterm.js pseudo-terminal (browser pipeline)
│           ├── api-source.ts      # API-backed MetricsSource (switch in when collector lands)
│           ├── App.tsx            # Stateless root component
│           ├── main.tsx           # React entry (Vite)
│           ├── hooks/             # useMetricsSource, useMetricsTerminal (custom hooks)
│           └── types.ts           # Re-exports the canonical spec
└── tests/
    ├── spec/data-spec.test.ts      # Specification structure + invariants + API contract
    ├── collector/ws-server.test.ts # WS transport: single-client + localhost policies
    ├── collector/windows-collector.test.ts # DEFERRED — fixture-driven probe/parsing tests
    ├── terminal/tui.test.ts        # Five-graph layout (CPU, MEM, GPU0–GPU2 row) + empty-state
    └── terminal/tui-connect.test.ts # Connection popup, editing, live end-to-end
```

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
GET  /                      # The built web viewer (dashboard)
GET  /api/metrics          # All metrics at once
GET  /api/cpu              # CPU metrics
GET  /api/memory           # Memory metrics
GET  /api/gpu              # GPU metrics
GET  /api/ollama          # Ollama-specific metrics
```

Response format: JSON with timestamped data for historical queries.

The collector hosts the built dashboard itself: build the viewer once
(`npm run build` in `src/viewer`), then open `http://localhost:11367/` —
the page is served on the collector's port and origin, and afterwards
communicates only with the collector (REST). No separate webserver is
needed.

The collector also streams snapshots over **WebSocket** at `ws://<host>:11367/ws`:
single-client (first connection wins; others are closed with code 1013 until it
disconnects), **localhost-only**, pushed on the metrics interval. Frontends
render CPU + MEM side by side, GPU graph(s) below (only reported GPUs, up to
3+), and an OLLAMA information row with the current model and loaded/available
counts.

### Windows Service Registration

Implemented via the Task Scheduler (per-user logon task, no admin
required) in `scripts/`:

- `scripts\install-service.ps1` — registers the collector as a hidden
  logon task (`-StartNow` to start immediately)
- `scripts\uninstall-service.ps1` — stops and removes the task

Because it is a logon task, the collector starts at sign-in and stops
when the session ends; a real Windows service (`node-windows`,
boot-time and session-independent) remains the long-term alternative.

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
3. Test downstream (WSL) → upstream (Windows) flow
4. Verify metrics accuracy vs. direct system queries

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
