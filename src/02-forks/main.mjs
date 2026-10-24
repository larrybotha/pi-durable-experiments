import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import {
  createSession,
  defineDoc,
  MemoryStorage,
} from "@earendil-works/pi-durable";

const context = BACKGROUND_CONTEXT;
// new in-memory session
const session = createSession(new MemoryStorage());

session.subscribeCommits((pub, _context) => {
  //const { changes } = pub;
  //changes.map((x) => console.log(x, "\n"));
});

const log = console.log.bind(console);
function tabs(depth = 0) {
  let tabs = Array(depth * 3)
    .fill(" ")
    .join("");

  return depth > 0 ? tabs.replace(" ", "│") : tabs;
}
function logTree(...args) {
  const depth = typeof args.at(-1) === "number" ? args.pop() : 0;

  log(`${tabs(depth)}├┄`, ...args);
}
function logBranch(...args) {
  const depth = typeof args.at(-1) === "number" ? args.pop() : 0;

  log(`${tabs(depth)}├┄┄┐`, ...args);
}

// create a doc type to write to
const Notes = defineDoc({
  checkpointWhen: () => false,
  kind: "example.notes",
  version: 1,
  scope: "conversation", // only 1 conversation-level at a time
  history: "rewindable",
  fork: "asOf",
  initial: () => ({ text: "" }),
});

// commit a message to the session
const chat = await session.commit(
  (tx) => tx.createConversation({ ownership: { kind: "ownerless" } }),
  context,
);
logTree("create conversation");

// add entry to session with doc
const firstEntry = await session.commit(async (tx) => {
  const entry = await tx.appendEntry(chat.id, { kind: "note", data: "hello" });
  const doc = await tx.doc(Notes, chat.id);
  doc.text = `doc with entry: '${entry.data}'`;

  logTree("append entry to session", entry, doc.text);

  return entry;
}, context);

await session.commit(async (tx) => {
  const entry = await tx.appendEntry(chat.id, {
    kind: "note",
    data: "goodbye",
  });
  const doc = await tx.doc(Notes, chat.id);
  doc.text = `doc with entry: '${entry.data}'`;

  logTree("append entry to session", entry, doc.text);

  return entry;
}, context);

const branch = await session.commit(async (tx) => {
  const fork = await tx.forkConversation(chat.id, firstEntry.id, {
    ownership: { kind: "ownerless" },
  });

  logBranch("conversation forked at first entry", firstEntry);

  return fork;
}, context);

await session.commit(async (tx) => {
  const entries = await tx.scanEntries({ conversationId: branch.id }, 10);

  logTree("num entries in branch", entries.items.length, 1);

  return entries;
}, context);

logTree(
  "notes in branch: ",
  await session.snapshot(Notes, branch.id, context),
  1,
);

await session.commit(async (tx) => {
  const entry = await tx.appendEntry(branch.id, {
    kind: "note",
    data: "I'm a   branched entry!",
  });
  const doc = await tx.doc(Notes, branch.id);
  doc.text = `doc added in branch: '${entry.data}'`;

  logTree("append entry to branch", entry, doc.text, 1);

  return entry;
}, context);

await session.commit(async (tx) => {
  const doc = await tx.doc(Notes, branch.id);
  doc.text = "changed!";

  logTree("change branch note text", 1);
}, context);

logTree(
  "branch notes after edit: ",

  await session.snapshot(Notes, branch.id, context),
  1,
);
logTree(
  "parent notes after edit: ",
  await session.snapshot(Notes, chat.id, context),
);

await session.close(context);
