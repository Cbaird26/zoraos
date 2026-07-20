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
```

## Core Components

- **Gateway** — API entry point, authentication, routing
- **Planner** — Breaks goals into tasks, tracks completion
- **Router** — Selects model/provider based on task type
- **Agents** — Research, Developer, Writer, Knowledge
- **Tools** — Filesystem, Git, Web Search, Python, PDF
- **Memory** — Vector store, knowledge graph, document store
- **Scheduler** — Background automation, recurring workflows
- **UI** — React dashboard for monitoring and control

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

## Philosophy

Models are interchangeable. The operating system, memory, and orchestration layer are the enduring assets.
