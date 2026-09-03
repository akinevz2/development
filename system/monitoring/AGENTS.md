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
│   │   └── mock-source.ts        # Mock producer; real Windows collector is deferred
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
    ├── terminal/tui.test.ts        # Restricted graph set + empty-state rendering
    └── terminal/tui-connect.test.ts # Connection popup, editing, live end-to-end
```

## STATUS — Deferred: Windows resource collection

Metric **collection is not implemented yet**. Everything downstream of the
`MetricsSource` contract is done and tested: the API server, the WebSocket
transport, the mock producer, the TUI, and the web viewer. To resume work
on the Windows partition:

1. Implement a `WindowsMetricsCollector` satisfying the `MetricsSource`
   contract from `src/spec/metrics.types.ts` — system-scope CPU, memory,
   GPU (gpu0/gpu1), Ollama loaded/available models, network, and disks.
   System-scope collection covers total utilisation including the WSL VM.
2. Wire it into `src/collector/src/index.ts` (replacing `MockMetricsSource`)
   — the REST API and WebSocket transport attach to whatever producer is
   configured there.
3. Everything runs through Node on either side of the partition:
   `npm install`, `npm test`, `npm run typecheck` at the repo root,
   `npm run collector` for the service, `npm run tui` for the terminal
   frontend (`npm run dev` in `src/viewer` for the web frontend).

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
- **Graph restriction**: the TUI and the web viewer graph ONLY cpu, mem,
  gpu0 and gpu1 (fixed four-graph layout, empty bars while disconnected).
  The collector/API may still serve the full specification — ollama,
  network and disks are data-level only and intentionally not graphed.
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

- **Collector**: Node.js with TypeScript
- **Viewer**: Node.js with TypeScript
- **Cross-platform**: All code in monorepo, built separately per environment

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
   - GPU memory usage per model
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
