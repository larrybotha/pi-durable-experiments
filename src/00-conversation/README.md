# 00 — Conversation

Create a `Session` over `MemoryStorage` and commit five ownerless conversations
concurrently. Each `session.commit` is a single atomic write to the storage
commit line; the `context` (`BACKGROUND_CONTEXT`) means the operation is never
cancelled.

Entities involved: `Session`, `MemoryStorage`, `Conversation`, `Commit`.

## Model

```mermaid
erDiagram
    SESSION ||--o{ CONVERSATION : "owns (conceptual, no FK)"
    SESSION {
        ConversationId rootConversationId "reserved id"
        Storage storage "MemoryStorage here"
    }
    CONVERSATION {
        ConversationId id PK
        ConversationId owner_conversationId FK "creator; absent = ownerless"
        TaskId owner_taskId FK "creator; absent = ownerless"
    }
```

## Flow

```mermaid
sequenceDiagram
    participant App
    participant Session
    participant Storage as MemoryStorage

    App->>App: createSession(MemoryStorage)
    par 5 concurrent commits
        App->>Session: commit(tx => tx.createConversation({ ownership: ownerless }), context)
        Session->>Storage: write atomic commit
        Session-->>App: Conversation
    end
    App->>Session: close(context)
```

## Run

```shell
source .env
node src/00-conversation/main.mjs
```
