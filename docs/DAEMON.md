# Bounded Research Daemon

`scripts/zora_daemon.py` is an operator-started client for recurring local research. It
is separate from the unfinished cron scheduler and never starts as part of API startup.

## Safety defaults

- Requires an exact `--goal`; there is no generic self-directed objective.
- Uses OpenRouter `tencent/hy3` for the preferred quality route, with low reasoning
  effort and a single automatic retry through local `ollama`/`zora:core` if the remote
  request is unavailable.
- Approves only `memory_search`, `memory_read`, and `pdf_reader` by default.
- Does not approve filesystem writes, memory writes, Git, desktop control, or external
  communication. `web_search` requires the explicit `--allow-web` flag.
- Runs once unless `--continuous` is supplied. Continuous intervals cannot be shorter
  than 15 minutes and default to six hours.
- Defaults to three tasks, twelve tool calls, and 12,000 observed tokens per UTC day.
  A task is additionally limited to four tool calls, three iterations, 4,000 requested
  tokens, and five minutes wall time.
- Persists counters across restarts and prevents duplicate daemon processes.
- Writes heartbeat, state, and private result artifacts under ignored `data/daemon/`.

Token counts come from provider usage reports and can exceed a requested ceiling when
prompt tokens are reported only after a call. Wall-clock cancellation is cooperative;
it is not a process-level provider kill.

## Commands

One bounded local cycle:

```bash
python scripts/zora_daemon.py \
  --goal "Which claims in A Theory of Everything are independently testable?"
```

Continuous bounded mode:

```bash
python scripts/zora_daemon.py \
  --goal "Which claims in A Theory of Everything are independently testable?" \
  --continuous \
  --interval-minutes 360
```

Inspect or stop it:

```bash
python scripts/zora_daemon.py --status
python scripts/zora_daemon.py --stop
```

Use `--provider ollama --model zora:core` for an entirely local cycle, or
`--no-local-fallback` to disable the automatic retry. `--no-memory` creates a zero-tool
cycle that can only transform facts supplied directly in `--goal`. Camera, microphone, filesystem
writes, memory writes, Git, desktop control, and external communications remain
unapproved in every daemon mode.

The protected API exposes the same heartbeat at `GET /api/v1/system/daemon` and accepts
a local stop request at `POST /api/v1/system/daemon/stop`.
Durable events for a known task remain available after an API restart at
`GET /api/v1/agents/tasks/{task_id}/audit`.

## Current activation

The 2026-07-20 evening update started a quiet zero-tool show cycle on
OpenRouter `tencent/hy3`. It completed in one model turn with no tool calls, then entered
a 12-hour sleep cadence. The heartbeat keeps the local fallback visible while web,
memory tools, writes, desktop control, camera, and microphone access remain disabled.
Daily and task limits persist across restarts and reset on the UTC boundary.
