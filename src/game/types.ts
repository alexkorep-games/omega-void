// src/game/types.ts
import { MarketSnapshot } from "./Market"; // Import MarketSnapshot
import { QuestState } from "../quests/QuestState"; // Import QuestState

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
  shieldLevel: number; // Player shield percentage (0-100)
  maxShield: number; // Max shield capacity (can be increased by upgrades)
}

// Enemy specific
export interface IEnemy extends IGameObject {
  angle: number; // Usually facing direction
  role?: "hunter" | "pirate" | "drone"; // Added for potential quest logic
}

// Projectile specific
export interface IProjectile extends IGameObject {
  vx: number;
  vy: number;
  life: number; // Lifespan counter
}

// --- Market & Station Data ---
export type EconomyType =
  | "Poor Agricultural"
  | "Agricultural"
  | "Rich Agricultural"
  | "Poor Industrial"
  | "Industrial"
  | "Rich Industrial"
  | "High Tech"
  | "Pirate";

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
  id: string;
  type: "star";
  size: number;
  color: string;
}

export interface IStation extends IPosition {
  id: string;
  type: "station";
  name: string;
  size: number;
  radius: number;
  color: string;
  stationType: string;
  angle: number;
  initialAngle: number;
  rotationSpeed: number;
  economyType: EconomyType;
  techLevel: TechLevel;
  coordinates: IPosition;
  isFixed?: boolean; // Optional flag for fixed stations
}

// NEW: Beacon type
export interface IBeacon extends IPosition {
  id: string;
  type: "beacon";
  size: number;
  radius: number;
  color: string;
  isActive: boolean; // Whether the player has interacted with it
}

export interface IAsteroid extends IPosition, IGameObject {
  type: "asteroid";
  spin: number; // radians per frame
  angle: number; // Visual rotation angle, updated by spin
}

export type BackgroundObject = IStar | IStation | IAsteroid | IBeacon; // Added IBeacon

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
  x: number;
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
  | "station_info" // Currently docked station info
  | "station_log" // List of discovered stations
  | "station_details" // Details of a specific station from the log
  | "trade_select"
  | "upgrade_ship" // New view for upgrades
  | "destroyed"
  | "chat_log"
  | "contract_log" // New view for quest/contract status
  | "won"; // State after completing the objective

// Animation State
export interface IAnimationState {
  type: "docking" | "undocking" | null;
  progress: number;
  duration: number;
}

// --- Destruction Animation ---
// Structure for individual particle parameters (previously in DestructionAnimation.tsx)
export interface ParticleState {
  id: number;
  delay: number; // ms
  duration: number; // ms (particle's own lifespan within animation)
  finalAngle: number; // degrees
  finalDistance: number;
  initialRotation: number; // degrees
  rotationSpeed: number; // degrees per second
  length: number;
  thickness: number;
}

// Updated data stored in gameState.activeDestructionAnimations
export interface DestructionAnimationData {
  id: string;
  x: number;
  y: number;
  color: string;
  size: "small" | "large"; // Determines which config parameters to use
  startTime: number; // performance.now() timestamp when created
  duration: number; // Total duration of this specific animation instance (ms)
  particles: ParticleState[]; // Pre-calculated particle parameters
}
// --- End Destruction Animation ---

// --- Quest Item ---
export interface QuestItemDefinition {
  id: string;
  name: string;
  description: string;
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
  enemyIdCounter: number;
  gameView: GameView;
  dockingStationId: string | null;
  animationState: IAnimationState;
  cash: number;
  lastDockedStationId: string | null;
  respawnTimer: number;
  isInitialized: boolean;
  cargoHold: Map<string, number>;
  baseCargoCapacity: number; // Base capacity before upgrades
  extraCargoCapacity: number; // Capacity added by upgrades
  market: MarketSnapshot | null;
  activeDestructionAnimations: DestructionAnimationData[]; // Stores data for canvas rendering
  // --- Station Log & Navigation ---
  discoveredStations: string[]; // Array of discovered station IDs, in order
  navTargetStationId: string | null; // ID of station to navigate to
  navTargetDirection: number | null; // Calculated angle from player to nav target (radians)
  navTargetCoordinates: IPosition | null; // Coordinates of nav target
  navTargetDistance: number | null; // Added: Distance to nav target
  viewTargetStationId: string | null; // ID of station to view in details screen
  knownStationPrices: Map<string, Map<string, number>>;
  // --- Upgrades ---
  cargoPodLevel: number; // 0-4
  shieldCapacitorLevel: number; // 0-3
  engineBoosterLevel: number; // 0-3
  hasAutoloader: boolean; // false/true
  hasNavComputer: boolean; // false/true
  shootCooldownFactor: number; // 1.0 or 0.5
  // --- Quest System ---
  questState: QuestState;
  questInventory: Map<string, number>; // Map<QuestItemID, count>
}

// World Manager Config
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
  economyTypes?: EconomyType[];
  techLevels?: TechLevel[];
  fixedStations?: IStation[]; // Added for fixed stations
}

// Update function signature used in useGameLoop
export type UpdateCallback = (deltaTime: number, now: number) => void;

// --- Chat ---
export interface ChatMessage {
  id: string | number;
  sender: "user" | "ai" | "system"; // Added system sender
  text: string;
  timestamp?: number;
}
