import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import { opencodeProvider } from "@earendil-works/pi-ai/providers/opencode";
import {
  AssistantEntry,
  createRegistry,
  Harness,
  MemoryStorage,
} from "@earendil-works/pi-durable";

const context = BACKGROUND_CONTEXT;

const models = createModels();
models.setProvider(opencodeProvider());

// storage + machinery that agents run on
const harness = await Harness.open(
  new MemoryStorage(),
  { models, registry: createRegistry() },
  context,
);
// root conversation
const root = await harness.root(context, {
  agent: {
    model: { provider: "opencode", modelId: "deepseek-v4.1-flash" },
  },
});

// user submission
const submission = await root.submit(
  { type: "input", content: "What is the capital of France?" },
  context,
);
// wait for agent response
const settled = await submission.wait(context);

if (settled.status == "done" && settled.type == "input") {
  const answer = await root.commit(
    (tx) => tx.entry(AssistantEntry, settled.answer),
    context,
  );

  console.log(answer?.model?.[0]);
} else {
  console.log(settled);
}

await harness.close(context);
