export type Condition = { kind: "credits"; amount: number };

export interface Reward {
  kind: "flag" | "unlock" | "item" | "credits" | "quest" | "message";
  payload?: unknown;
}

export interface Objective {
  id: string;
  description: string;
  condition: Condition;
  hidden?: boolean;
  optional?: boolean;
}

export interface QuestDefinition {
  id: string;
  title: string;
  description?: string;
  objectives: Objective[];
  completionThreshold?: { type: "count" | "percent"; value: number };
}
