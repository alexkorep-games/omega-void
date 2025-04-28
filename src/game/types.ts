// src/game/types.ts

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
}

export type BackgroundObject = IStar | IStation;

// Camera
export interface ICamera extends IPosition {}

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
}

// Update function signature used in useGameLoop
export type UpdateCallback = (deltaTime: number, now: number) => void;
