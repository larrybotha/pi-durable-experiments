import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import {
  createSession,
  defineDoc,
  defineTask,
  MemoryStorage,
} from "@earendil-works/pi-durable";

const log = console.log.bind(console);

const context = BACKGROUND_CONTEXT;
const session = createSession(new MemoryStorage());

// create a type of task; Supervisor
const Supervisor = defineTask({
  name: "example.supervisor",
  version: 1,
  initial: () => ({ phase: "ready" }),
  phases: { ready: async () => {} },
  abort: async () => {},
});

// create a doc/storage for holding agents
const AgentRegistry = defineDoc({
  checkpointWhen: () => false, // record changes as deltas
  kind: "example.agenty-registry",
  version: 1,
  // scoped to conversation. Could be session | conversation  | task
  scope: "conversation",
  // history for {scope: 'conversation'}: rewindable | latest
  history: "latest",
  // fork for {history: "latest"}: current | initial
  fork: "initial",
  // when using tx.doc, if no registry, use this as init
  initial: () => ({ agents: {} }),
});

// create conversation
const main = await session.commit(
  (tx) => tx.createConversation({ ownership: { kind: "ownerless" } }),
  context,
);

// create supervisor and child conversation
const setup = await session.commit(async (tx) => {
  // create a task that must outlive a parent's abort
  const supervisorId = await tx.createTask(Supervisor, null, {
    // scope to conversation - i.e. visible by evaluating conversation
    // tasks are always owned, either by conversation, or another task
    ownership: { kind: "conversation" },
    conversationId: main.id, // the conversation to scope it to
    // exclude from conversation idle - i.e. does not block main conversation
    // exclude from conversation abort - i.e. must be aborted separately
    background: true,
  });
  const child = await tx.createConversation({
    // owned by task
    // abort on task -> abort on conversation
    // work done in child -> blocks on task, i.e. background: false
    ownership: { kind: "task", taskId: supervisorId },
  });
  // create agent registry doc
  const agentReg = await tx.doc(AgentRegistry, main.id);

  agentReg.agents.researcher = {
    conversationId: child.id,
    requestId: `researcher:first-message:${supervisorId}`,
  };

  return { supervisorId, child };
}, context);

log("supervisor task:", setup.supervisorId);
log("child conversation:", setup.child);
log("registry:", await session.snapshot(AgentRegistry, main.id, context));

await session.close(context);
