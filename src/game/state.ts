// src/game/state.ts
import { IGameState, IPlayer, ICamera, ITouchState } from "./types";
import { Player } from "./entities/Player";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GAME_VIEW_HEIGHT,
  DEFAULT_STARTING_CASH,
  DEFAULT_STARTING_SHIELD,
  DEFAULT_ANIMATION_DURATION,
  BASE_CARGO_CAPACITY,
} from "./config";
import { initialQuestState } from "../quests/QuestState"; // Import initial quest state

// // Create default player instance
export const initialPlayerState: IPlayer = new Player(0, 0);
initialPlayerState.maxShield = DEFAULT_STARTING_SHIELD; // Initialize maxShield

// TODO refactor this to use the player instance
const initialPlayer: IPlayer = {
  id: "player",
  x: 0,
  y: 0,
  angle: -Math.PI / 2, // Pointing up
  vx: 0,
  vy: 0,
  size: 20,
  radius: 10,
  color: "#00FF00",
  shieldLevel: 100,
  maxShield: 100,
};

// Initial camera position (centered on player initially)
const initialCamera: ICamera = {
  x: initialPlayer.x - GAME_WIDTH / 2,
  y: initialPlayer.y - GAME_HEIGHT / 2,
};

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

// Initial game state
export const initialGameState: IGameState = {
  player: initialPlayerState,
  enemies: [],
  projectiles: [],
  visibleBackgroundObjects: [],
  camera: initialCamera,
  lastEnemySpawnTime: 0,
  lastShotTime: 0,
  enemyIdCounter: 0,
  gameView: "playing", // Start in playing mode
  dockingStationId: null,
  animationState: {
    type: null,
    progress: 0,
    duration: DEFAULT_ANIMATION_DURATION,
  },
  cash: DEFAULT_STARTING_CASH,
  lastDockedStationId: null,
  respawnTimer: 0,
  isInitialized: false,
  cargoHold: {},
  baseCargoCapacity: BASE_CARGO_CAPACITY,
  extraCargoCapacity: 0,
  market: null,
  activeDestructionAnimations: [],
  discoveredStations: [],
  navTargetStationId: null,
  navTargetDirection: null,
  navTargetCoordinates: null,
  navTargetDistance: null,
  viewTargetStationId: null,
  knownStationPrices: {},
  // Upgrade levels
  cargoPodLevel: 0,
  shieldCapacitorLevel: 0,
  engineBoosterLevel: 0,
  hasAutoloader: false,
  hasNavComputer: false,
  shootCooldownFactor: 1.0,
  // --- Quest System ---
  questState: initialQuestState, // Initialize quest state
  questInventory: {}, // Initialize empty quest inventory
};

// updateCamera function remains the same
export function updateCamera(state: IGameState): IGameState {
  // Only update camera if playing or animating (avoids jump when undocking finishes)
  if (
    state.gameView === "playing" ||
    state.gameView === "docking" ||
    state.gameView === "undocking" ||
    state.gameView === "destroyed" // Keep camera potentially updated during destruction/respawn
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
