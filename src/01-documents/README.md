# 01 — Documents

Attach a `Notes` document to a conversation and mutate it inside the same commit
as a transcript `Entry`. Because the doc is `history: "rewindable"`, the value it
held when each entry was written stays readable via `snapshotAsOf`.

Entities involved: `Session`, `Conversation`, `Entry`, `Document` (`defineDoc`),
`Commit`.

## Model

```mermaid
erDiagram
    CONVERSATION ||--o{ ENTRY : "conversationId"
    CONVERSATION |o--o{ DOCUMENT : "scope.conversation"
    COMMIT ||--o{ DOCUMENT : "createdAt"
    COMMIT |o--o{ DOCUMENT : "retiredAt"

    CONVERSATION {
        ConversationId id PK
    }
    ENTRY {
        EntryId id PK "immutable"
        ConversationId conversationId FK
        string kind "note here"
    }
    DOCUMENT {
        DocumentId id PK "incarnation"
        string kind "example.notes"
        string scopeKind "conversation"
        string history "rewindable here"
        string fork "asOf here"
        JsonObject value "checkpoint base or Chord delta batch"
    }
    COMMIT {
        Seq seq PK "global monotonic sequence"
    }
```

## Snapshot semantics

- `session.snapshot(Notes, id)` — latest value.
- `session.snapshotAsOf(Notes, id, entryId)` — value when that entry was created.

## Run

```shell
source .env
node src/01-documents/main.mjs
```
