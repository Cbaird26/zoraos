# ZoraOS Multi-Machine Cluster

Status: **proposed topology, not verified as a live distributed deployment**. The setup
script records node configuration; dynamic capability advertisement, authenticated
node transport, dispatch, failure recovery, and integration tests remain future work.

## Architecture

```
                    M5 (Orchestrator)
                 UI · API · Planner
                        |
       ┌────────────────┼────────────────┐
       │                │                │
  M4 (Inference)   M2 (Automation)   M1 (Memory)
  Ollama · Embed    Research Jobs     PostgreSQL
  OCR · Index       Browser · GitHub   Vector DB · Redis
```

## Machine Roles

### M5 — Primary Orchestrator
- Web UI (Next.js)
- API Gateway (FastAPI)
- Planner & Router
- Model routing
- Development workstation

### M4 — Inference Worker
- Ollama (local models)
- Embeddings generation
- Document OCR
- Content indexing

### M2 — Automation Worker
- Scheduled research jobs
- Web crawling
- Browser automation
- GitHub tasks
- Daily reports

### M1 — Memory & Services
- PostgreSQL
- Vector database (pgvector)
- Redis cache
- Object storage
- Backups

## Setup

```bash
# On each machine:
bash scripts/cluster_setup.sh <node-name> <role>

# Example:
# On M5:
bash scripts/cluster_setup.sh m5-orchestrator orchestrator

# On M4:
bash scripts/cluster_setup.sh m4-inference worker

# On M2:
bash scripts/cluster_setup.sh m2-automation worker

# On M1:
bash scripts/cluster_setup.sh m1-memory worker
```

## Proposed Dynamic Scheduling

Nodes advertise capabilities:
- "I can run local models"
- "I have idle CPU"
- "I have GPU/Neural Engine capacity"
- "I'm currently busy"

Orchestrator dispatches work based on availability.
