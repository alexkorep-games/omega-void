// src/game/types.ts
import { MarketSnapshot } from "./Market"; // Import MarketSnapshot

// Basic position
export interface IPosition {
  x: number;
  y: number;
}

// Base for game objects
export interface IGameObject extends IPosition {
  id: string; // Ensure all objects have a unique ID
  size: number;
  radius: number;
  color: string;
}

// Player specific
export interface IPlayer extends IGameObject {
  angle: number;
  vx: number;
  vy: number;
}

// Enemy specific
export interface IEnemy extends IGameObject {
  angle: number; // Usually facing direction
}

// Projectile specific
export interface IProjectile extends IGameObject {
  vx: number;
  vy: number;
  life: number; // Lifespan counter
}

// --- Market & Station Data ---
// Copied/Adapted from Game 1
export type EconomyType =
  | "Poor Agricultural"
  | "Agricultural"
  | "Rich Agricultural"
  | "Poor Industrial"
  | "Industrial"
  | "Rich Industrial"
  | "High Tech";
// Removed: "Tourism", "Refinery", "Extraction", "Anarchy", etc. for simplicity

export type TechLevel =
  | "TL0" // Pre-industrial
  | "TL1" // Basic Industrial
  | "TL2" // Mass Production
  | "TL3" // Early Spaceflight
  | "TL4" // Common Interstellar
  | "TL5" // Advanced Interstellar
  | "TL6" // Exotic/Experimental Tech
  | "TL7"; // Theoretical/Hyper Tech

// Background objects from World Manager
export interface IStar extends IPosition {
  id: string; // e.g., `star_${cellX}_${cellY}_${index}`
  type: "star";
  size: number;
  color: string;
}

export interface IStation extends IPosition {
  id: string; // e.g., `station_${cellX}_${cellY}`
  type: "station";
  name: string;
  size: number;
  radius: number;
  color: string;
  stationType: string; // e.g., 'coriolis'
  angle: number; // Current rotation angle
  initialAngle: number; // Starting rotation
  rotationSpeed: number; // Speed of rotation
  // --- Added properties for Market ---
  economyType: EconomyType;
  techLevel: TechLevel;
  coordinates: IPosition; // Store world coordinates for market seed generation
}

export type BackgroundObject = IStar | IStation;

// Camera
export type ICamera = IPosition;

// Touch Input State
export interface ITouchControlState {
  active: boolean;
  id: number | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface IShootControlState {
  active: boolean;
  id: number | null;
  x: number; // Position of the shooting touch indicator
  y: number;
}

export interface ITouchState {
  move: ITouchControlState;
  shoot: IShootControlState;
}

// Game View State
export type GameView =
  | "playing"
  | "docking"
  | "undocking"
  | "buy_cargo"
  | "sell_cargo"
  | "station_info"
  | "trade_select";

// Animation State
export interface IAnimationState {
  type: "docking" | "undocking" | null;
  progress: number; // ms elapsed
  duration: number; // ms total duration
}

// Game State
export interface IGameState {
  player: IPlayer;
  enemies: IEnemy[];
  projectiles: IProjectile[];
  visibleBackgroundObjects: BackgroundObject[];
  camera: ICamera;
  lastEnemySpawnTime: number;
  lastShotTime: number;
  enemyIdCounter: number; // Keep track of unique IDs
  isInitialized: boolean; // Flag to check if initial load is done
  // New properties for docking/station interaction
  gameView: GameView;
  dockingStationId: string | null; // ID of the station the player is docking/docked with
  animationState: IAnimationState; // State for docking/undocking animations
  // --- Added properties for Trading ---
  cash: number;
  cargoHold: Map<string, number>; // Commodity Key -> Quantity Held
  cargoCapacity: number; // Max tonnes
  market: MarketSnapshot | null; // Current market data when docked
}

// World Manager Config (matches the class constructor)
export interface IWorldManagerConfig {
  cellSize?: number;
  seedPrime1?: number;
  seedPrime2?: number;
  seedPrime3?: number;
  starBaseDensity?: number;
  minStarSize?: number;
  maxStarSize?: number;
  starColor?: string;
  stationProbability?: number;
  minStationSize?: number;
  maxStationSize?: number;
  stationColor?: string;
  stationTypes?: string[];
  viewBufferFactor?: number;
  // Added for station generation
  economyTypes?: EconomyType[];
  techLevels?: TechLevel[];
}

// Update function signature used in useGameLoop
export type UpdateCallback = (deltaTime: number, now: number) => void;
