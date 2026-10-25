import assert from "node:assert";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import {
  createSession,
  defineDoc,
  MemoryStorage,
} from "@earendil-works/pi-durable";

const log = console.log.bind(console);

const context = BACKGROUND_CONTEXT;
const session = createSession(new MemoryStorage());
const Notes = defineDoc({
  checkpointWhen: () => false,
  kind: "example.notes",
  version: 1,
  scope: "conversation",
  history: "rewindable",
  fork: "asOf",
  initial: () => ({ text: "" }),
});
const chat = await session.commit(async (tx) => {
  const chat = await tx.createConversation({
    ownership: { kind: "ownerless" },
  });
  const notes = await tx.doc(Notes, chat.id);
  notes.text = "first";

  return chat;
}, context);

// create a DocumentWatcher for our Notes doc
const notesWatch = await session.watchDoc(Notes, chat.id, context);

// Notes needs to be initialised before watching...
if (notesWatch === undefined) {
  throw new Error("notes are absent");
}

log("watch baseline:", notesWatch.value);

// create a 'busy' resolve that can be used to resolve/reject later
const busy = Promise.withResolvers();
// create a 'done' resolve that can be used to resolve/reject later
const done = Promise.withResolvers();
let watcherCalls = 0;

// start watching
notesWatch.start(async (value, ops, _deliveryContext) => {
  log("watched notes update:", value, JSON.stringify(ops));

  watcherCalls++;

  // block on the first watch
  if (watcherCalls === 1) {
    log("waiting on 'busy' in watch...");
    // await on 'busy' here until it resolves
    // this blocks subsequent callbacks until resolution
    await busy.promise;
  } else {
    log("resolving 'done' in watch...");
    // otherwise, resolve 'done'
    done.resolve();
  }
});

// write to our doc
await session.commit(async (tx) => {
  const notes = await tx.doc(Notes, chat.id);
  notes.text = "observed";
}, context);

for (const more of Array(3)
  .fill(null)
  .map((_, i) => ` at ${i + 1},`)) {
  // append to the doc
  await session.commit(async (tx) => {
    log(`appending to doc: '${more}'`);
    const notes = await tx.doc(Notes, chat.id);
    notes.text += more;
  }, context);
}

// resolve busy here - 1 watcherCall so far
log("resolving 'busy'...");
busy.resolve(); // watcher no longer blocked on 'busy'
log("'busy' resolved externally");

// wait on 'done'
log("awaiting 'done'...");
await done.promise; // done blocks here until resolved via watcher
log("'done' resolved via watcher");

// stop watching... drops any pending frames
await notesWatch.stop();

assert.equal(watcherCalls, 2); // as opposed to 4
log("listener calls:", watcherCalls);

await session.close(context);
