# System Monitoring Solution

Dual-component monitoring system for cross-platform resource tracking:

## Components

### 1. Collector (Windows)
- System metrics (CPU, memory, disks, network)
- Ollama server status (running models, memory usage, GPU)
- Exposes HTTP API for consumption

### 2. Viewer
- Polls collector API
- Real-time graphing of metrics
- Focus: GPU/memory usage for Ollama

## Technology Stack

- **Spec**: `src/spec/metrics.types.ts` — single source of truth for all metric shapes
- **Collector**: Node.js + TypeScript (API server implemented; collection deferred — see AGENTS.md)
- **Viewer (web)**: Vite + React (TSX, functional components + custom hooks) with an xterm.js pseudo-terminal
- **Viewer (TUI)**: plain Node renderer sharing the same `renderFrame()` graphs
- **Tests**: Vitest — `npm test`, `npm run typecheck`

## Project Structure

```
system/monitoring/
├── README.md
├── AGENTS.md                     # Development instructions
├── package.json                  # Root tooling (vitest, tsc)
├── tsconfig.json
├── src/
│   ├── spec/
│   │   └── metrics.types.ts      # Canonical metrics specification (single source of truth)
│   ├── collector/                # Windows-side collector (API implemented; collection deferred)
│   │   └── src/
│   │       ├── api.ts            # REST + SSE server over any MetricsSource
│   │       └── mock-source.ts    # Deterministic mock producer (until Windows collector lands)
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
    ├── spec/data-spec.test.ts    # Specification structure + invariants + API contract
    └── terminal/tui.test.ts      # TUI rendering cohesiveness
```

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
