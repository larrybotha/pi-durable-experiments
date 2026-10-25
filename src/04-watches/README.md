# 04 — Watches

Observe one conversation document without creating it. `session.watchDoc()`
returns `undefined` when the current `Notes` incarnation does not exist, so the
example mutates the doc first. The `DocumentWatch` holds the value at
acquisition, then delivers committed changes one callback at a time.

The example blocks inside the first listener callback. Three later commits queue
their frames, but the second callback resolves `done`; `stop()` then drops every
frame still pending, so the listener runs twice instead of four times.

Entities involved: `Session`, `Conversation`, `Document` (`defineDoc`),
`Commit`, `DocumentWatch` (in-memory `WatchHandle`, not a committed record).

## Model

```mermaid
erDiagram
    SESSION ||--o{ WATCH : "acquires, owns, cancels"
    CONVERSATION |o--o{ DOCUMENT : "scope.conversation"
    DOCUMENT ||--o{ WATCH : "observed incarnation by kind + scope + key"
    COMMIT }o--o{ WATCH : "delivers one frame per touching commit"

    CONVERSATION {
        ConversationId id PK
    }
    DOCUMENT {
        DocumentId id PK "incarnation"
        string kind "example.notes"
        string key "family member; absent: singleton"
        Seq createdAt "creating commit"
        Seq retiredAt "retiring commit; absent while current"
        string scopeKind "conversation"
        ConversationId scope_conversationId FK
        string history "rewindable here"
        string fork "asOf here"
        JsonObject value "materialized StoredDocument content; not a DocumentRecord field"
    }
    WATCH {
        string kind "watched document kind"
        string scopeKind "conversation"
        ConversationId scope_conversationId FK "chat.id"
        string key "family member; absent: singleton"
        JsonObject value "baseline at acquisition, then latest delivered"
        string listener "sole async callback; serialized one at a time"
        int pendingFrames "queued frames; capped at 100"
        string endReason "stopped OR cancelled OR session_closed OR retired OR listener_error OR session_failed"
    }
    COMMIT {
        Seq seq PK "global monotonic sequence"
    }
```

`WATCH` is a live handle: its address (`kind`, scope, `key`) resolves to the
current `DocumentRecord` incarnation, but it is not stored by a commit.
`DOCUMENT` shows the record fields plus its materialized content; `value` comes
from `StoredDocument`, not from `DocumentRecord` itself.

## Watch semantics

- `watchDoc()` is non-creating: absent or retired document → `undefined`.
- `watch.value` is the committed value at acquisition (here
  `{ text: "first" }`), before `start()`.
- `start()` installs the sole listener and never invokes it inline. Frames are
  delivered in commit order, one callback at a time; a slow callback blocks
  later frames.
- At most 100 undelivered frames are kept. When a frame arrives while 100 are
  pending, they are dropped and replaced with one root-replacement frame
  (`ops: [["r", newestValue]]`).
- `stop()` is idempotent; it drops pending frames. A callback already running
  keeps running.
- `closed` / `stop()` resolve with `stopped`, `cancelled`, `session_closed`,
  `retired` (document value became `null`), `listener_error`, or
  `session_failed`.

## Flow

```mermaid
sequenceDiagram
    participant App
    participant Session
    participant Doc as Document (Notes)
    participant Watch as DocumentWatch

    App->>Session: commit(create chat, doc.text = "first")
    App->>Session: watchDoc(Notes, chat.id)
    Session-->>App: Watch, value = { text: "first" }
    App->>Watch: start(listener)
    App->>Session: commit(doc.text = "observed")
    Session->>Doc: write
    Session->>Watch: frame "observed", ops [["s", ["text"], "observed"]]
    Watch->>App: callback 1 logs, awaits busy
    Note over Watch,App: callback 1 blocks delivery
    App->>Session: commit(doc.text += " at 1,")
    App->>Session: commit(doc.text += " at 2,")
    App->>Session: commit(doc.text += " at 3,")
    Session->>Watch: 3 frames queued
    App->>App: busy.resolve()
    Watch->>App: callback 2 gets oldest frame "observed at 1,", resolves done
    App->>App: assert calls == 2
    App->>Watch: stop()
    Note over Watch: pending " at 2," and " at 3," frames dropped
    App->>Session: close(context)
```

## Run

```shell
source .env
node src/04-watches/main.mjs
```
