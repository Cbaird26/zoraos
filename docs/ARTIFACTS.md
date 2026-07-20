# Research Artifact Handling

## Classification

| Classification | Storage | Publication Rule |
|---|---|---|
| `public` | Public repository | May be committed after review |
| `redacted-public` | Private evidence repository plus derivative public artifact | Remove identifiers, credentials, third-party text, and sensitive metadata |
| `private` | Private evidence repository or encrypted local storage | Never publish without a separate review |
| `do-not-retain` | Do not store beyond the immediate session | Delete securely when no longer needed |

## Artifact Manifest

Every retained experimental artifact should have:

- opaque artifact identifier;
- SHA-256 digest;
- capture timestamp and time zone;
- source system and collection method;
- classification;
- consent/scope note;
- redaction status;
- relationship to a manuscript figure, table, or result.

## Game and Third-Party Service Records

Logs and screenshots from third-party applications are private by default. They may contain account identifiers, personal messages, UI metadata, or information belonging to other people. Store raw copies only in the private evidence repository or local encrypted storage. Public manuscripts must use aggregate results or carefully redacted excerpts.
