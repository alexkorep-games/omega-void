// src/game/state.ts
import { IGameState, IPlayer, ITouchState } from "./types"; // Added IPosition
import { Player } from "./entities/Player";
import {
  GAME_WIDTH,
  GAME_VIEW_HEIGHT,
  DEFAULT_STARTING_CASH,
  DEFAULT_STARTING_SHIELD,
} from "./config";

// Create default player instance
export const initialPlayerState: IPlayer = new Player(0, 0);
initialPlayerState.maxShield = DEFAULT_STARTING_SHIELD; // Initialize maxShield

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
  // Game Flow properties
  gameView: "playing", // Start in playing mode
  dockingStationId: null, // No station docked initially
  animationState: {
    type: null, // 'docking' or 'undocking'
    progress: 0, // Milliseconds elapsed
    duration: 1500, // Total duration in ms
  },
  // Player Resource properties
  cash: DEFAULT_STARTING_CASH, // Starting cash
  cargoHold: new Map<string, number>(), // Start with empty cargo
  baseCargoCapacity: 10, // Base capacity before upgrades
  extraCargoCapacity: 0, // Capacity added by upgrades
  lastDockedStationId: null, // Track last station for respawn
  respawnTimer: 0, // Timer for respawn delay
  isInitialized: false,
  market: null, // No market data initially
  // Destruction animations
  activeDestructionAnimations: [], // Initialize as empty array
  // Station Log & Navigation
  discoveredStations: [], // List of discovered station IDs in order
  navTargetStationId: null, // ID of the station to navigate towards
  navTargetDirection: null, // Calculated angle to nav target
  navTargetCoordinates: null, // Coordinates of nav target
  navTargetDistance: null, // Distance to nav target
  viewTargetStationId: null, // Station ID to view in details screen
  knownStationPrices: new Map<string, Map<string, number>>(),
  // --- Upgrades ---
  cargoPodLevel: 0,
  shieldCapacitorLevel: 0,
  engineBoosterLevel: 0,
  hasAutoloader: false,
  hasNavComputer: false,
  shootCooldownFactor: 1.0,
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
