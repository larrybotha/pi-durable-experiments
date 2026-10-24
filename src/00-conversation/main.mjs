import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createSession, MemoryStorage } from "@earendil-works/pi-durable";

// store in memory only
const session = createSession(new MemoryStorage());

// Calls in a session take context, used for cancellation (like Go...?)
// BACKGROUND_CONTEXT means "never cancel"
const context = BACKGROUND_CONTEXT;

const conversations = await Promise.all(
  Array(5)
    .fill(null)
    .map(async () => {
      // Write transaction to storage
      const result = await session.commit(
        // "ownerless" means no task created in this conversation
        (tx) => tx.createConversation({ ownership: { kind: "ownerless" } }),
        context,
      );

      return result;
    }),
);

console.log(conversations);

await session.close(context);
