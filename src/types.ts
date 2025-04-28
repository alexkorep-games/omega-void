// src/types.ts

// --- Base ---
export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface GameObject extends Point {
  id: string;
  size: number;
  radius: number;
  angle: number;
}

// --- Game Entities ---
export interface PlayerState extends GameObject {
  vx: number;
  vy: number;
}

export interface EnemyState extends GameObject {
  // Inherits id, x, y, size, radius, angle from GameObject
}

export interface ProjectileState extends Point {
  id: string;
  vx: number;
  vy: number;
  radius: number;
  life: number; // Remaining frames
}

// --- World Objects ---
export interface StarData extends Point {
  id: string;
  type: 'star';
  size: number;
  color: number;
}

export interface StationData extends GameObject {
  type: 'station';
  name: string;
  stationType: string;
  color: number;
  initialAngle: number; // Store initial for consistent rotation calc
  rotationSpeed: number;
  // Inherits id, x, y, size, radius, angle
}

export type WorldObjectData = StarData | StationData;

// --- Game State ---
export interface CameraState extends Point {}

export interface TouchControlState {
  active: boolean;
  id: number | null; // Touch identifier
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface TouchShootState {
  active: boolean;
  id: number | null;
  x: number;
  y: number;
}

export interface TouchState {
  move: TouchControlState;
  shoot: TouchShootState;
}

export interface GameState {
  player: PlayerState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  visibleBackgroundObjects: WorldObjectData[];
  camera: CameraState;
  touchState: TouchState;
  lastEnemySpawnTime: number;
  lastShotTime: number;
  isRunning: boolean; // To potentially pause the game
}

// --- Utility ---
export interface Vector2D extends Point {}

// --- Config Interfaces (for World Manager) ---
export interface WorldManagerConfig {
  cellSize?: number;
  seedPrime1?: number;
  seedPrime2?: number;
  seedPrime3?: number;
  starBaseDensity?: number;
  minStarSize?: number;
  maxStarSize?: number;
  starColor?: number; // Use number for color
  stationProbability?: number;
  minStationSize?: number;
  maxStationSize?: number;
  stationColor?: number; // Use number for color
  stationTypes?: string[];
  viewBufferFactor?: number;
}