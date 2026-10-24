# pi-durable experiments

https://github.com/earendil-works/pi/tree/main/packages/durable

## Usage

````shell
source .env
watchexec -c -w src "node src/[module]"


## Datamodel

```mermaid
erDiagram
    SESSION ||--o{ CONVERSATION : owns
    SESSION ||--o{ DOCUMENT : "session scope"
    SESSION ||--o{ COMMIT : "publishes in seq order"
    CONVERSATION ||--o{ ENTRY : contains
    CONVERSATION ||--o{ DOCUMENT : "conversation scope"
    CONVERSATION |o--o{ CONVERSATION : "fork parent via entry cutoff"
    COMMIT ||--o{ ENTRY : writes
    COMMIT ||--o{ DOCUMENT : writes
    TASK ||--o{ DOCUMENT : "task scope"

    SESSION {
        ConversationId rootConversationId "reserved id"
        Storage storage "atomic commit line"
    }

    CONVERSATION {
        ConversationId id PK
        ConversationId parent_conversationId FK "fork source"
        EntryId parent_at FK "inclusive cutoff entry"
        ConversationId owner_conversationId FK "creator edge"
        TaskId owner_taskId FK "creator task"
    }

    ENTRY {
        EntryId id PK "immutable"
        ConversationId conversationId FK
        string kind "protocol discriminator"
        MessageList model "model-facing messages; may be absent"
        JsonValue data "application payload; may be absent"
        EntryId head FK "starts active model context"
        ContextEditList edits "omit or replace earlier entries"
        TaskId byTaskId FK "producer task; may be absent"
    }

    DOCUMENT {
        DocumentId id PK "incarnation; never reused"
        string kind "stable definition kind"
        string key "family member; absent for singleton"
        Seq createdAt "creating commit"
        Seq retiredAt "retiring commit; absent while current"
        string scopeKind "session OR conversation OR task"
        ConversationId scope_conversationId FK
        TaskId scope_taskId FK
        string history "latest OR rewindable (conversation only)"
        string fork "current OR initial OR asOf"
        int version "value shape version"
        JsonObject value "checkpoint base or Chord delta batch"
    }

    COMMIT {
        Seq seq PK "global monotonic sequence"
        CommitChangeList changes "entries, docs, tasks, conversations"
    }

    TASK {
        TaskId id PK
        ConversationId ownerConversationId FK
        TaskId ownerTaskId FK
    }
````
