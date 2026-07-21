# Security Policy

## Scope

ZoraOS is an experimental, local-first agent orchestration system. Its safety model is under active development. Treat all model outputs and tool calls as untrusted until reviewed.

## Supported Use

Use ZoraOS in environments where the operator has authorization to access the data, applications, and services involved. External side effects should require explicit operator approval.

## Explicitly Out of Scope

The project must not be used to:

- intercept, modify, replay, or inject network traffic;
- read or write another application's memory;
- bypass anti-cheat, access-control, or platform enforcement;
- automate activity on third-party services without their permission;
- collect or publish third-party personal data without consent;
- expose credentials, private logs, screenshots, or account data.

## Reporting a Vulnerability

Do not open public issues containing secrets, exploits, personal data, or reproduction steps that create harm. Report privately to the repository owner with:

- a concise description of the issue;
- affected component and version or commit;
- minimal, non-destructive reproduction steps;
- impact and suggested mitigation.

## Current Safeguards and Gaps

The prototype includes bounded agent iterations, optional token budgets, tool-call
budgets, task cancellation flags, explicit per-task approval for classified side-effect
tools, default denial of unknown tools, a basic local kill-switch convention, and an
in-memory SHA-256 hash-chained audit ledger. The API permits unauthenticated development
access only from loopback while the gateway key is a placeholder; a configured key is
required for every protected API request.

The PostgreSQL audit implementation is experimental and is not yet the gateway's active
ledger. The system does not yet provide a complete permission broker, durable task
state, a universal confirmation gate, reliable wall-clock cancellation, or production
authentication/authorization. These are open requirements, not completed guarantees.
