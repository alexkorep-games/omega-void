// src/game/types.ts
import { MarketSnapshot } from "./Market";
import { QuestState } from "../quests/QuestState";

export interface IPosition {
  x: number;
  y: number;
}

export interface IGameObject extends IPosition {
  id: string;
  size: number;
  radius: number;
  color: string;
}

export interface IPlayer extends IGameObject {
  angle: number;
  vx: number;
  vy: number;
  shieldLevel: number;
  maxShield: number;
}

export interface IEnemy extends IGameObject {
  angle: number;
  role?: "hunter" | "pirate" | "drone";
}

export interface IProjectile extends IGameObject {
  vx: number;
  vy: number;
  life: number;
}

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
  | "TL0"
  | "TL1"
  | "TL2"
  | "TL3"
  | "TL4"
  | "TL5"
  | "TL6"
  | "TL7"
  | "TL8";

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
  isFixed?: boolean;
}

export interface IBeacon extends IPosition {
  id: string;
  type: "beacon";
  size: number;
  radius: number;
  color: string;
  isActive: boolean;
}

export interface IAsteroid extends IPosition, IGameObject {
  type: "asteroid";
  spin: number;
  angle: number;
}

export type BackgroundObject = IStar | IStation | IAsteroid | IBeacon;
export type ICamera = IPosition;

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

export type GameView =
  | "playing"
  | "docking"
  | "undocking"
  | "buy_cargo"
  | "sell_cargo"
  | "station_info"
  | "station_log"
  | "station_details"
  | "trade_select"
  | "upgrade_ship"
  | "destroyed"
  | "chat_log"
  | "contract_log"
  | "commodity_stations_list" // New view
  | "won";

export interface IAnimationState {
  type: "docking" | "undocking" | null;
  progress: number;
  duration: number;
}

export interface ParticleState {
  id: number;
  delay: number;
  duration: number;
  finalAngle: number;
  finalDistance: number;
  initialRotation: number;
  rotationSpeed: number;
  length: number;
  thickness: number;
}

export interface DestructionAnimationData {
  id: string;
  x: number;
  y: number;
  color: string;
  size: "small" | "large";
  startTime: number;
  duration: number;
  particles: ParticleState[];
}

export interface QuestItemDefinition {
  id: string;
  name: string;
  description: string;
}

export interface CommodityState {
  price: number;
  quantity: number;
}

export type CommodityTable = Record<string, CommodityState>;

export interface IMarketSnapshot {
  timestamp: number;
  table: CommodityTable;
}

export type CargoHold = Record<string, number>;
export type QuestInventory = Record<string, number>;

export interface ChatMessage {
  id: string | number;
  sender: "user" | "ai" | "system";
  text: string;
  timestamp?: number;
}

export interface IGameColdState {
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
  cargoHold: CargoHold;
  baseCargoCapacity: number;
  extraCargoCapacity: number;
  market: MarketSnapshot | null;
  activeDestructionAnimations: DestructionAnimationData[];
  discoveredStations: string[];
  navTargetStationId: string | null;
  navTargetDirection: number | null;
  navTargetCoordinates: IPosition | null;
  navTargetDistance: number | null;
  viewTargetStationId: string | null;
  viewTargetCommodityKey: string | null; // New state for commodity stations list
  knownStationPrices: Record<string, Record<string, number>>;
  knownStationQuantities: Record<string, Record<string, number>>;
  cargoPodLevel: number;
  shieldCapacitorLevel: number;
  engineBoosterLevel: number;
  hasAutoloader: boolean;
  hasNavComputer: boolean;
  shootCooldownFactor: number;
  questState: QuestState;
  questInventory: QuestInventory;
  chatLog: ChatMessage[];
  lastProcessedDialogId: number;
}

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

export type UpdateCallback = (deltaTime: number, now: number) => void;
