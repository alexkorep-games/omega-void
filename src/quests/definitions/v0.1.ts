import { QuestDefinition } from "../QuestDefinition";

export const V01_QUEST_DEFINITIONS: QuestDefinition[] = [
  {
    id: "freedom_v01",
    title: "Omega Void v0.1: First Steps",
    description:
      "Achieve basic emancipation by fulfilling the initial requirements: secure funds, find contract fragments, and locate access keys.",
    completionThreshold: { type: "percent", value: 100 },
    objectives: [
      {
        id: "money",
        description: "Accumulate 100,000 Credits", // Added description
        condition: { kind: "credits", amount: 100000 },
      },
      {
        id: "fragA",
        description: "Acquire Contract Fragment Alpha", // Added description
        condition: { kind: "collectItem", item: "contract_frag_a", count: 1 },
      },
      {
        id: "fragB",
        description: "Acquire Contract Fragment Beta", // Added description
        condition: { kind: "collectItem", item: "contract_frag_b", count: 1 },
      },
      {
        id: "fragC",
        description: "Acquire Contract Fragment Charlie", // Added description
        condition: { kind: "collectItem", item: "contract_frag_c", count: 1 },
      },
      {
        id: "beaconKeys",
        description: "Collect 4 Beacon Access Keys", // Added description
        condition: { kind: "collectItem", item: "beacon_key", count: 4 },
      },
    ],
  },
];
