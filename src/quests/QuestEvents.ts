import { IPosition } from "../game/types";

// Events emitted by the core game logic that the QuestEngine listens to
export type GameEvent =
  | { type: "CREDITS_CHANGE"; delta: number; total: number }
  | { type: "DOCK_FINISH"; stationId: string }
  | { type: "PURCHASE"; commodity: string; qty: number; stationId: string } // Added stationId
  | { type: "SELL"; commodity: string; qty: number; stationId: string } // Added SELL event
  | { type: "ENEMY_KILL"; enemyId: string; enemyType?: string; role?: string } // Added enemyType and role
  | { type: "WAYPOINT_REACHED"; waypointId: string; coord: IPosition } // Added waypointId (beacon ID will be used)
  | {
      type: "ITEM_ACQUIRED";
      itemId: string;
      quantity: number;
      method: "buy" | "reward" | "pickup" | "barter";
    } // Specific event for items
  | {
      type: "ITEM_REMOVED";
      itemId: string;
      quantity: number;
      method: "sell" | "consumed" | "barter";
    } // Specific event for removing items
  | { type: "SHIP_UPGRADED"; upgradeId: string; level?: number }
  | {
      type: "FACTION_REP_CHANGE";
      factionId: string;
      delta: number;
      total: number;
    }
  | { type: "GAME_TICK"; deltaTime: number; now: number }; // Generic tick for time-based or custom checks
