# 03 — Owned conversations

Create an ownerless `main` conversation, then inside one commit create a
background supervisor `Task` scoped to it and a child `Conversation` owned by
that task. An `AgentRegistry` document on `main` records the child conversation
and the request id used to address it.

Ownership rules (pi-durable 1.4.0):

- `tx.createConversation({ ownership })` has 2 ownership kinds
  - `{kind: "ownerless"}` - top-level conversation; `ConversationRecord.owner`
    is absent
  - `{kind: "task", taskId}` - owned by a task; the record stores a composite
    `owner: {conversationId, taskId}` creator edge. Aborting that task aborts
    the work it owns, including this conversation.
- `tx.createTask(definition, input, { ownership, conversationId, background })`
  - `{kind: "conversation"}` - top-level task of a conversation; `TaskRecord.owner`
    is absent and `conversationId` is required when the commit is not bound to a
    conversation
  - `{kind: "task", taskId}` - child task; it must live in its owner task's
    conversation and cannot set `background: true`
- `background: true` is conversation-owned only. It excludes the task from
  ordinary conversation idle waits, conversation aborts, and cascades. An
  ordinary `abort()` leaves it running; `abort(context, { background: true })`
  aborts it too.

Entities involved: `Session`, `Conversation` (`main` + child), `Task`
(`defineTask` supervisor), `Document` (`defineDoc` `AgentRegistry`), `Commit`.

## Model

```mermaid
erDiagram
    SESSION ||--o{ CONVERSATION : "owns (conceptual, no FK)"
    CONVERSATION ||--o{ TASK : "conversationId belongs to"
    TASK |o--o{ TASK : "owner child to parent"
    TASK |o--o{ CONVERSATION : "ownerTaskId creator"
    CONVERSATION |o--o{ DOCUMENT : "scope.conversation"
    COMMIT ||--o{ DOCUMENT : "createdAt"
    COMMIT |o--o{ DOCUMENT : "retiredAt"

    SESSION {
        ConversationId rootConversationId "reserved id"
        Storage storage "MemoryStorage here"
    }
    CONVERSATION {
        ConversationId id PK
        ConversationId owner_conversationId FK "owner.conversationId; both owner fields absent = ownerless"
        TaskId owner_taskId FK "owner.taskId; both owner fields absent = ownerless"
    }
    TASK {
        TaskId id PK
        ConversationId conversationId FK "task belongs to conversation"
        TaskId owner FK "absent for conversation-owned task"
        string kind "example.supervisor"
        bool background "conversation-owned only; excluded from idle waits and aborts"
        string state "pending OR running OR waiting OR sleeping OR completing OR terminal"
    }
    DOCUMENT {
        DocumentId id PK "incarnation; never reused"
        string kind "example.agenty-registry"
        string key "absent: singleton"
        Seq createdAt FK "creating commit"
        Seq retiredAt FK "retiring commit; absent while current"
        string scopeKind "conversation"
        ConversationId scope_conversationId FK "main.id"
        string history "latest here"
        string fork "initial here"
        JsonObject value "agents map: conversationId + requestId"
    }
    COMMIT {
        Seq seq PK "global monotonic sequence"
    }
```

ERD flattening: `ConversationRecord.owner` is a nested `{conversationId, taskId}`
object (absent for ownerless conversations) and `DocumentRecord.scope` is a
nested `{kind, conversationId}` object; the columns above show the equivalent
flattened/indexed fields.

`AgentRegistry` here uses `checkpointWhen: () => false` (record changes as
deltas), `history: "latest"` and `fork: "initial"`.

## Flow

```mermaid
sequenceDiagram
    participant App
    participant Session
    participant Main as Conversation (main)
    participant Task as Task (supervisor)
    participant Child as Conversation (child)

    App->>Session: commit(tx => tx.createConversation({ ownership: ownerless }))
    Session-->>App: Main
    App->>Session: commit(async tx => ...)
    Note over Session,Child: one atomic commit
    Session->>Task: createTask(Supervisor, null, { ownership: conversation, conversationId: main.id, background: true })
    Note over Task,Main: conversation-owned + background => survives main abort
    Session->>Child: createConversation({ ownership: { kind: task, taskId: supervisorId } })
    Session->>Session: tx.doc(AgentRegistry, main.id)
    Session->>Session: agents.researcher = { conversationId: child.id, requestId }
    Session-->>App: { supervisorId, child }
    App->>Session: snapshot(AgentRegistry, main.id)
    Session-->>App: registry value
    App->>Session: close(context)
    Session-->>App: closed
```

## Run

```shell
source .env
node src/03-owned-conversations/main.mjs
```
