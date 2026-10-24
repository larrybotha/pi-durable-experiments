# 000 — Quickstart

End-to-end smoke test: wire up models + provider, open a `Harness` over
`MemoryStorage`, create a root conversation, submit a user input, wait for the
agent to settle, then commit the answer as an `AssistantEntry`.

Entities involved: `Harness`, `MemoryStorage`, `Conversation` (root),
`Submission`, `AssistantEntry`, `Models`/`opencodeProvider`.

## Flow

```mermaid
sequenceDiagram
    participant App
    participant Harness
    participant Storage as MemoryStorage
    participant Conv as Conversation (root)
    participant Sub as Submission

    App->>Harness: open(MemoryStorage, { models, registry }, context)
    Harness->>Storage: attach atomic commit line
    App->>Harness: root(context, { agent.model })
    Harness->>Conv: create root conversation
    App->>Conv: submit({ type: "input", content }, context)
    Conv->>Sub: create submission
    App->>Sub: wait(context)
    Sub-->>App: settled
    alt status == "done" && type == "input"
        App->>Conv: commit(AssistantEntry, settled.answer, context)
        App-->>App: log answer.model
    else otherwise
        App-->>App: log settled
    end
    App->>Harness: close(context)
```

## Run

```shell
source .env
node src/000-quickstart/main.mjs
```
