import { ObjectiveProgress } from "./QuestState";
import { IGameState } from "../game/types"; // Import IGameState

export type Condition =
  | { kind: "credits"; amount: number }
  | { kind: "dockAt"; stationId: string }
  | { kind: "collectItem"; item: string; count: number }
  | { kind: "deliverItem"; item: string; count: number; stationId: string }
  | { kind: "reachWaypoint"; waypointId: string } // Matches beacon ID
  | { kind: "killEnemy"; count: number; role?: string; type?: string }
  | { kind: "haveCargo"; commodity: string; count: number }
  | {
      kind: "custom";
      test: (
        objectiveProgress: ObjectiveProgress,
        gameState: IGameState
      ) => boolean;
    }; // Pass full gameState

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
