import { QuestItemDefinition } from "../../game/types";

export const QUEST_ITEMS: readonly QuestItemDefinition[] = [
  {
    id: "contract_frag_a",
    name: "Fragment Alpha (Encrypted)",
    description:
      "Part of a legal contract, heavily encrypted. Found in corporate records.",
  },
  {
    id: "contract_frag_b",
    name: "Fragment Beta (Damaged)",
    description:
      "A partial contract segment, recovered from corrupted research logs.",
  },
  {
    id: "contract_frag_c",
    name: "Fragment Charlie (Marked)",
    description:
      "A contract fragment bearing pirate insignia. Likely stolen or traded.",
  },
  {
    id: "beacon_key",
    name: "Beacon Access Key",
    description:
      "A digital key obtained from an old security beacon. Part of a larger sequence.",
  },
] as const;

export function getQuestItemDefinition(
  id: string
): QuestItemDefinition | undefined {
  return QUEST_ITEMS.find((item) => item.id === id);
}

export type QuestItemId = (typeof QUEST_ITEMS)[number]["id"];
