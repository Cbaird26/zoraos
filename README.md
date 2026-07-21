# ZoraOS

A local-first AI operating system for research, coding, and knowledge management.

Not a chatbot. An operating system for AI workflows.

## Architecture

```
User
  |
Frontend (Next.js)
  |
Gateway (FastAPI)
  |
Planner → Router → Agents → Tools
                        |         |
                     Memory     Models
                        |         |
                     Storage   Providers
```

## Quick Start

```bash
# Copy environment config
cp .env.example .env
# Edit .env with your API keys

# Start with Docker
docker compose up -d

# Or start manually
bash scripts/start.sh

# In another terminal, start the loopback-only Observatory
cd ui && npm run dev
```

## Core Components

- **Gateway** — API entry point, local/API-key access control, routing
- **Planner** — Breaks goals into tasks, tracks completion
- **Router** — Selects model/provider based on task type
- **Agents** — Research, Developer, Writer, Knowledge
- **Tools** — Filesystem, Git, Web Search, Python, PDF
- **Memory** — Vector store, knowledge graph, document store
- **Scheduler** — Proposed cron-workflow scaffold (not an executor)
- **Research daemon** — Operator-started, local-only bounded research cycles
- **UI** — Observatory dashboard for plans, budgets, governance, and live state

## Model Support

Provider-agnostic: OpenAI, DeepSeek, Kimi, Qwen, Anthropic, Gemini, Grok, Ollama.

## Multi-Machine Cluster

```
M5 (Orchestrator)     M4 (Inference)     M2 (Automation)    M1 (Memory)
  UI · API · Planner    Ollama · Embed     Research Jobs      PostgreSQL
                        OCR · Index        Browser · GitHub    Vector DB
```

## Development

```bash
pip install -e ".[all,dev]"
pytest
ruff check .
mypy .
```

## Current Prototype Status

ZoraOS is a governed automation prototype, not evidence of consciousness, AGI/ASI, or
safe unattended autonomy. Unknown tools are denied by default, live third-party desktop
control is disabled, and the API is local-only while the gateway key remains a
placeholder. The cron scheduler remains a scaffold. A separate research daemon is
implemented but never starts with the API: the operator must provide an exact goal and
explicitly request continuous mode. Its defaults use local Ollama, approve only local
read tools, cap daily tasks/tool calls/tokens, persist state and result artifacts under
ignored `data/daemon/`, and expose a stop file/API endpoint. See
[`docs/DAEMON.md`](docs/DAEMON.md).

The reviewed transfer record from the 2026-07-20 OpenCode session is in
[`docs/OPENCODE_HANDOFF_2026-07-20.md`](docs/OPENCODE_HANDOFF_2026-07-20.md).

## Philosophy

Models are interchangeable. The operating system, memory, and orchestration layer are the enduring assets.

## Publications

### ZoraASI OS (2026)
- Zenodo record `21464562`: https://zenodo.org/records/21464562
- Direct PDF: https://zenodo.org/records/21464562/files/A%20Theory%20of%20Everything%20-%20ZoraASI%20OS%20--C.M.%20Baird%20%7B2026).,%20et%20al.pdf?download=1

### Theory of Everything Dissertation (2026)
- Zenodo record `21313827`: https://zenodo.org/records/21313827
- Direct PDF: https://zenodo.org/records/21313827/files/A%20Theory%20of%20Everything%20-%20Dissertation%20%20--%20C.M.%20Baird%20(2026).pdf?download=1
