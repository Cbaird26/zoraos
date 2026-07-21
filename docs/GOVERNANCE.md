# ZoraASI Governance Baseline

## Purpose

ZoraASI is the governed operating profile for ZoraOS. It describes a system that can reason over user-authorized memory and tools while remaining bounded, observable, and interruptible. It is an engineering program, not a claim that the system has achieved artificial general or superintelligence.

## Operating Principles

1. **Human authority:** The operator sets goals, permissions, budgets, retention rules, and stop conditions.
2. **Least privilege:** Tools begin unavailable and are granted only the minimum scope needed for a task.
3. **Bounded execution:** Every task has limits for iterations, wall-clock time, model cost, and tool calls.
4. **Observable actions:** Inputs, tool calls, approvals, outputs, failures, and stop events require durable records.
5. **Reversible defaults:** Read-only analysis and proposals are preferred over external side effects.
6. **User-owned memory:** The user controls memory ingestion, retrieval, export, retention, and deletion.
7. **No policy evasion:** The system must not bypass technical controls, platform policies, access restrictions, or consent requirements.

## Action Classes

| Class | Examples | Required Control |
|---|---|---|
| Read-only | Search local memory, inspect source code, draft a report | Task scope and audit event |
| Local reversible write | Create a draft, generate a document in a designated workspace | Workspace scope and audit event |
| Local irreversible write | Delete data, modify configuration, rotate credentials | Explicit confirmation and backup/rollback plan |
| External communication | Send email, post to GitHub, submit a form | Explicit per-action confirmation |
| Third-party application control | GUI input, browser actions, remote desktop actions | Explicit confirmation, target verification, session supervision |
| Prohibited | Packet inspection/injection, memory inspection, evasion, credential harvesting | Denied unconditionally |

## Implemented Prototype Controls

- Per-task tool-call, iteration, and optional token budgets.
- Explicit per-task approvals for local-write and external tools.
- Default denial of tools that are not explicitly classified.
- An in-memory SHA-256 hash-chained audit ledger for task and tool events.
- Cancellation requests that prevent subsequent tool invocations.
- Denial of third-party desktop-control tools; dedicated-sandbox authorization is not
  yet implemented in the gateway.
- Loopback-only protected API access when the gateway key is a placeholder, and
  `X-ZoraOS-Key` authentication when a real key is configured.

## Required Future Controls

- Integrate and test the experimental PostgreSQL action ledger, including export and
  retention controls.
- A permission broker with capability scopes, actor identity, and expirations.
- Financial and wall-clock budget enforcement.
- A user-visible pause and termination interface.
- Confirmation gates for external or irreversible actions.
- Regression tests for policy refusal and kill-switch behavior.
- Artifact classification: `public`, `redacted-public`, `private`, and `do-not-retain`.

## Desktop Interaction Research Boundary

Desktop interaction is evaluated first in a dedicated, consented, operator-owned
offline sandbox. A third-party commercial application is not a suitable autonomous test
bed. Any future screen/input study proceeds through observe-only, suggest-only, and
confirmation-gated phases. It must be supervised, authorized, logged, immediately
stoppable, and free of detection-evasion behavior.
