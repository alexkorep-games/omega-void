// Events emitted by the core game logic that the QuestEngine listens to
export type GameEvent =
  | { type: "CREDITS_CHANGE"; delta: number; total: number }
  | { type: "DOCK_FINISH"; stationId: string }
  | { type: "PURCHASE"; commodity: string; qty: number; stationId: string } // Added stationId
  | { type: "SELL"; commodity: string; qty: number; stationId: string }; // Added SELL event
