// src/game/state.ts
import { IGameState, IPlayer, ITouchState } from "./types";
import { Player } from "./entities/Player";
import { GAME_WIDTH, GAME_VIEW_HEIGHT } from "./config";

export const initialPlayerState: IPlayer = new Player(0, 0); // Position will be loaded

export const initialTouchState: ITouchState = {
  move: {
    active: false,
    id: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  },
  shoot: { active: false, id: null, x: 0, y: 0 },
};

export const initialGameState: IGameState = {
  player: initialPlayerState,
  enemies: [],
  projectiles: [],
  visibleBackgroundObjects: [],
  camera: { x: 0, y: 0 },
  lastEnemySpawnTime: 0,
  lastShotTime: 0,
  enemyIdCounter: 0,
  isInitialized: false,
  // New state properties
  gameView: "playing", // Start in playing mode
  dockingStationId: null, // No station docked initially
  animationState: {
    type: null, // 'docking' or 'undocking'
    progress: 0, // Milliseconds elapsed
    duration: 1500, // Total duration in ms
  },
  // --- Initialize Trading State ---
  cash: 1000.0, // Starting cash
  cargoHold: new Map<string, number>(), // Start with empty cargo
  cargoCapacity: 10, // Start with 10t capacity
  market: null, // No market data initially
};

// updateCamera function remains the same
export function updateCamera(state: IGameState): IGameState {
  // Only update camera if playing or animating (avoids jump when undocking finishes)
  if (
    state.gameView === "playing" ||
    state.gameView === "docking" ||
    state.gameView === "undocking"
  ) {
    // Ensure player position is considered
    const playerX = state.player?.x ?? 0;
    const playerY = state.player?.y ?? 0;
    return {
      ...state,
      camera: {
        x: playerX - GAME_WIDTH / 2,
        y: playerY - GAME_VIEW_HEIGHT / 2,
      },
    };
  }
  return state; // No camera change when docked or in other UI screens
}
