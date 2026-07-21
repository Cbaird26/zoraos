# ZoraOS Workflows

These are proposed workflow specifications. The cron scheduler is still a scaffold and
does not execute these definitions. The separate `scripts/zora_daemon.py` can perform
one exact operator-supplied research question once or at a bounded interval; it does not
activate any workflow below automatically. Each proposed workflow still requires source
authorization, retention rules, budgets, and a reviewed output destination.

## Morning Briefing

Proposed trigger: Daily at 7 AM
Agent: Research
Tasks:
1. Read AI news from web
2. Read arXiv papers (quantum physics, AI)
3. Read GitHub notifications
4. Check calendar
5. Generate briefing document
6. Store in memory

## Evening Summary

Proposed trigger: Daily at 9 PM
Agent: Knowledge
Tasks:
1. Backup knowledge graph
2. Summarize today's work
3. Index new documents
4. Suggest tomorrow's priorities
5. Generate daily report

## Paper Analysis

Proposed trigger: On-demand
Agent: Research
Tasks:
1. Download paper from arXiv/Zenodo
2. Extract text
3. Summarize abstract and findings
4. Compare with existing knowledge
5. Identify contradictions
6. Store summary in memory
7. Update knowledge graph

## Code Review

Proposed trigger: On-demand
Agent: Developer
Tasks:
1. Read repository
2. Analyze changes
3. Run tests
4. Generate review comments
5. Suggest improvements

## Literature Review

Proposed trigger: On-demand
Agent: Research + Writer
Tasks:
1. Search for papers on topic
2. Download and read each paper
3. Extract key findings
4. Cluster by theme
5. Compare and contrast
6. Identify gaps
7. Write review document
8. Generate bibliography
