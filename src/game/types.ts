// src/game/types.ts
import { MarketSnapshot } from "./Market"; // Import MarketSnapshot (ensure Market.ts doesn't import this file)
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
  shieldLevel: number; // Player shield percentage (0-100 based on maxShield)
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
  | "TL7" // Theoretical/Hyper Tech
  | "TL8"; // Transcendent Tech

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
// Structure for individual particle parameters
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

// Data stored in gameState.activeDestructionAnimations
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

// Represents the state of a single commodity in a market
export interface CommodityState {
  price: number;
  quantity: number; // Changed from supply for consistency
}

// Represents the entire market table (commodity -> state) - Use Record
export type CommodityTable = Record<string, CommodityState>;

// Snapshot of market data at a specific time
export interface IMarketSnapshot {
  timestamp: number;
  table: CommodityTable; // Use the Record type
}

// Represents the player's cargo hold (commodity -> quantity) - Use Record
export type CargoHold = Record<string, number>;
// Represents quest items held by player - Use Record
export type QuestInventory = Record<string, number>;

// --- Chat ---
export interface ChatMessage {
  id: string | number; // Can be the numeric ID from DialogEntry
  sender: "user" | "ai" | "system"; // User (Commander), AI (Bot), System
  text: string;
  timestamp?: number;
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
  cargoHold: CargoHold; // Use the Record type alias
  baseCargoCapacity: number; // Base capacity before upgrades
  extraCargoCapacity: number; // Capacity added by upgrades
  market: MarketSnapshot | null; // Use IMarketSnapshot (which uses CommodityTable Record)
  activeDestructionAnimations: DestructionAnimationData[];
  // --- Station Log & Navigation ---
  discoveredStations: string[]; // Array of discovered station IDs, in order
  navTargetStationId: string | null; // ID of station to navigate to
  navTargetDirection: number | null; // Calculated angle from player to nav target (radians)
  navTargetCoordinates: IPosition | null; // Coordinates of nav target
  navTargetDistance: number | null; // Added: Distance to nav target
  viewTargetStationId: string | null; // ID of station to view in details screen
  // Store *just* the price for known stations, consistent with storage/saving logic
  knownStationPrices: Record<string, Record<string, number>>;
  // --- Upgrades ---
  cargoPodLevel: number; // 0-4
  shieldCapacitorLevel: number; // 0-3
  engineBoosterLevel: number; // 0-3
  hasAutoloader: boolean; // false/true
  hasNavComputer: boolean; // false/true
  shootCooldownFactor: number; // 1.0 or 0.5
  // --- Quest System ---
  questState: QuestState;
  questInventory: QuestInventory; // Use the Record type alias
  // --- Chat System ---
  chatLog: ChatMessage[]; // Log of messages to display
  lastProcessedDialogId: number; // Tracks the last dialog entry processed
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
}

// Update function signature used in useGameLoop
export type UpdateCallback = (deltaTime: number, now: number) => void;
