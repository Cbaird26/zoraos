# ZoraOS Architecture

## Layers

### Layer 1 — Hardware
Proposed MacBook topology (M5, M4, M2, M1) running Docker, Python,
PostgreSQL, and Ollama. The current handoff verifies local services on one host, not a
live four-node cluster.

### Layer 2 — Models
Interchangeable providers. Configure via environment variables.

### Layer 3 — Brain (Orchestrator)
Receives requests, plans workflows, routes to agents.

### Layer 4 — Memory
Vector store, knowledge graph, document store. Collections: research, books, physics, AI, projects, software, therapy, gaming, journal, ideas, meetings, papers, videos.

### Layer 5 — Skills (Agents)
Research, Developer, Writer, Knowledge, Planner.

### Layer 6 — Tools
Filesystem, Git, GitHub, Python, Terminal, Web, Browser, PDF, OCR, Memory.

### Layer 7 — Planner
Decomposes goals, delegates, tracks completion.

## Data Flow

1. User sends request via UI or API
2. Gateway authenticates and routes
3. Planner decomposes goal into steps
4. Router selects optimal model/provider
5. Agent executes with tool access
6. Results returned with telemetry; explicit workflows may store approved derivatives in memory
7. Response returned to user

## Design Principles

- Local-first whenever practical
- Model-agnostic (interchangeable providers)
- Modular (every component is a plugin)
- Containerized (Docker, portable)
- API-first (everything accessible programmatically)
- Replaceable (no hard dependencies)
