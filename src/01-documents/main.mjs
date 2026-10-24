// Stores document state with transcript entries

import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import {
  createSession,
  defineDoc,
  MemoryStorage,
} from "@earendil-works/pi-durable";

const context = BACKGROUND_CONTEXT;
const session = createSession(new MemoryStorage());

// Document: JSON object
const Notes = defineDoc({
  checkpointWhen: () => false,
  kind: "example.notes",
  version: 1,
  scope: "conversation", // document is attached to conversation
  history: "rewindable", // keep old values readable - see what doc looked like when entry was written
  fork: "asOf", // starts with the value of the doc at the time it was forked
  initial: () => ({ text: "" }),
});

const chat = await session.commit(
  (tx) => tx.createConversation({ ownership: { kind: "ownerless" } }),
  context,
);

const firstEntry = await session.commit(async (tx) => {
  const entry = await tx.appendEntry(chat.id, { kind: "note", data: "hello" });
  const doc = await tx.doc(Notes, chat.id);
  doc.text = "after hello";

  return entry;
}, context);

const secondEntry = await session.commit(async (tx) => {
  const entry = await tx.appendEntry(chat.id, {
    kind: "note",
    data: "goodbye",
  });
  const doc = await tx.doc(Notes, chat.id);
  doc.text = "after goodbye";

  return entry;
}, context);

// snapshot reads the latest value
// snapshotAsOf reads the value when entry was created
console.log("latest notes:", await session.snapshot(Notes, chat.id, context));
console.log(
  "notes at first entry:",

  await session.snapshotAsOf(Notes, chat.id, firstEntry.id, context),
);
console.log(
  "notes at second entry:",
  await session.snapshotAsOf(Notes, chat.id, secondEntry.id, context),
);

await session.close(context);
