# Zenodo v2 Upload Instructions

## Record to update: 21464562

Review the revised ZoraASI OS prototype paper and, if approved by the account owner,
upload it as a new version of this record.

The public Zenodo API check on 2026-07-20 returned the generic record title *A Theory
of Everything*, resource type *Journal article*, and one file. Confirm the desired title
and resource type before publishing a new version.

### Files to upload

| File | Description |
|------|-------------|
| `paper/zoraasi_complete.pdf` | Compiled ZoraASI OS prototype paper |
| `paper/zoraasi_complete.tex` | LaTeX source (accepted by Zenodo) |
| `paper/references.bib` | BibTeX references |

### Upload form fields

**Title:**
`A Theory of Everything - ZoraASI OS -- C.M. Baird (2026)`

**Authors:**
- Christopher Michael Baird

**Description:**
```
This paper presents ZoraASI, the experimental governed operating profile of ZoraOS — a local-first, model-agnostic prototype for bounded AI-agent workflows. The prototype treats orchestration, user-owned memory, governed tool execution, and audit provenance as durable infrastructure while keeping model providers replaceable.

The implementation includes a bounded tool-use loop, per-task budgets, default denial for unclassified tools, an in-memory SHA-256 hash-chained audit ledger, local/API-key access control, and REST endpoints for task submission, cancellation, monitoring, and audit retrieval. A four-machine topology is documented as a deployment design; live distributed operation has not yet been verified.

The accompanying test suite exercises core models, routing, memory, bounded execution, policy enforcement, API access decisions, and audit-chain verification. The companion dissertation (Zenodo record 21313827) was used as the prototype retrieval corpus. The work does not claim consciousness, AGI/ASI, scientific validation of the corpus, or safe unattended autonomy.
```

**Keywords:**
`AI agents, local-first AI, retrieval augmented generation, tool use, AI safety, governance, audit, ZoraOS, ZoraASI`

**License:**
Creative Commons Attribution 4.0 International

**Related identifiers:**
- `21313827` (dissertation corpus, is cited by this record)
- `https://github.com/Cbaird26/zoraos` (source code)

**Version:** 2.0

**Resource type:**
Review whether `Software` or `Technical report` more accurately describes the revised
artifact than the record's current `Journal article` classification.

### Direct upload URL

https://zenodo.org/deposit/21464562

Do not publish until the revised PDF, metadata, authorship, license, and related
identifiers have been reviewed by the account owner.
