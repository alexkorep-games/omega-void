import { QuestDefinition } from "../QuestDefinition";

export const V01_QUEST_DEFINITIONS: QuestDefinition[] = [
  {
    id: "freedom_v01",
    title: "Omega Void v0.1: First Steps",
    description:
      "Achieve basic emancipation by fulfilling the initial requirements: secure funds.", // Simplified description
    completionThreshold: { type: "percent", value: 100 },
    objectives: [
      {
        id: "money",
        description: "Accumulate 100,000 Credits",
        condition: { kind: "credits", amount: 100000 },
      },
    ],
  },
];
