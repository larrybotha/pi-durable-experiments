# 02 — Forks

Fork a conversation at a prior entry with `tx.forkConversation(chat.id,
firstEntry.id)`. The fork inherits the document value as of the fork point
(`fork: "asOf"`); subsequent edits on the branch do not touch the parent.

Entities involved: `Session`, `Conversation` (parent + branch), `Entry`,
`Document` (`defineDoc`), `Commit`.

## Model

```mermaid
erDiagram
    CONVERSATION ||--o{ ENTRY : "conversationId"
    CONVERSATION |o--o{ CONVERSATION : "parent.conversationId fork source"
    ENTRY |o--o{ CONVERSATION : "parent.at inclusive cutoff"
    CONVERSATION |o--o{ DOCUMENT : "scope.conversation"

    CONVERSATION {
        ConversationId id PK
        ConversationId parent_conversationId FK "fork source"
        EntryId parent_at FK "inclusive cutoff entry"
    }
    ENTRY {
        EntryId id PK "immutable"
        ConversationId conversationId FK
        string kind "note here"
    }
    DOCUMENT {
        DocumentId id PK "incarnation; never reused"
        string kind "example.notes"
        string scopeKind "conversation"
        string history "rewindable here"
        string fork "asOf here"
        JsonObject value
    }
```

## Flow

```mermaid
sequenceDiagram
    participant App
    participant Session
    participant Parent as Conversation (parent)
    participant Branch as Conversation (branch)

    App->>Parent: appendEntry "hello", doc.text = ...
    App->>Parent: appendEntry "goodbye", doc.text = ...
    App->>Session: commit(tx => tx.forkConversation(chat.id, firstEntry.id), context)
    Session->>Branch: create branch, doc = value as of firstEntry
    App->>Branch: appendEntry "I'm a branched entry!"
    App->>Branch: doc.text = "changed!"
    Note over Parent,Branch: parent snapshot unchanged, branch snapshot diverges
```

## Run

```shell
source .env
node src/02-forks/main.mjs
```
