// src/game/config.ts
// src/game/config.ts
export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 640;
export const HUD_HEIGHT = 120;
export const GAME_VIEW_HEIGHT = GAME_HEIGHT - HUD_HEIGHT;

// Spawning / Despawning
export const INITIAL_SPAWN_AREA_WIDTH = 1000;
export const INITIAL_SPAWN_AREA_HEIGHT = 1000;
export const WORLD_ORIGIN_STATION_ID = "station_0_0";
export const ENEMY_DESPAWN_RADIUS = GAME_WIDTH * 2.5;
export const PROJECTILE_DESPAWN_RADIUS_FACTOR = 1.5;
export const ENEMY_SPAWN_INTERVAL = 2000; // ms
export const SHOOT_COOLDOWN = 200; // ms

// Colors
export const PLAYER_COLOR = "#FF00FF"; // Magenta
export const ENEMY_COLOR = "#00FFFF"; // Cyan
export const PROJECTILE_COLOR = "#FFFFFF"; // White
export const HUD_COLOR = "#00FFFF";
export const HUD_ACCENT_COLOR = "#FF00FF";
export const HUD_SHIELD_BAR_COLOR = "#006666";
export const HUD_SHIELD_BAR_EMPTY_COLOR = "#333355";
export const STAR_COLOR = "#FFFFFF";
export const STATION_COLOR = "#00FFFF";
export const NAV_TARGET_COLOR = "#FFFF00"; // Yellow for Navigation Target

// Sizes
export const PLAYER_SIZE = 15;
export const ENEMY_SIZE = 18;
export const PROJECTILE_SIZE = 2;
export const MIN_STATION_SIZE = 45;
export const MAX_STATION_SIZE = 90;
export const MIN_STAR_SIZE = 0.5;
export const MAX_STAR_SIZE = 1.8;

// Speeds
export const PLAYER_SPEED = 2.5;
export const ENEMY_SPEED = 1;
export const PROJECTILE_SPEED = 5;

// World Generation
export const WORLD_CELL_SIZE = 350;
export const STAR_BASE_DENSITY = 0.0001;
export const STATION_PROBABILITY = 0.05;

// Input
export const TOUCH_MOVE_MAX_DIST = 50;
export const TOUCH_JOYSTICK_OUTER_RADIUS = 40;
export const TOUCH_JOYSTICK_INNER_RADIUS = 25;
export const TOUCH_SHOOT_INDICATOR_RADIUS = 35;
export const TOUCH_SHOOT_INDICATOR_INNER_RADIUS = 8;

// Saving
export const SAVE_STATE_INTERVAL = 5000;
export const LOCAL_STORAGE_GAME_STATE_KEY = "omegaVoidGameState";

// Drawing
export const SCANNER_MAX_DIST = 800;

export const DEFAULT_STARTING_CASH = 100.0;
export const DEFAULT_STARTING_SHIELD = 100;

// Gameplay Tuning
export const ENEMY_SHIELD_DAMAGE = 10;
export const RESPAWN_DELAY_MS = 3000;
export const ENEMY_SPAWN_NEAR_STATION_THRESHOLD = 600;

// *** NEW: Destruction Animation Config ***
export const DESTRUCTION_ANIMATION_DURATION_BASE = 1000; // Base duration in ms

// -- Small Explosion (Enemies) --
export const SMALL_EXPLOSION_PARTICLE_COUNT = 25;
export const SMALL_EXPLOSION_MAX_DISTANCE = 50;
export const SMALL_EXPLOSION_PARTICLE_LENGTH = 6;
export const SMALL_EXPLOSION_PARTICLE_THICKNESS = 1.5;
export const SMALL_EXPLOSION_DURATION =
  DESTRUCTION_ANIMATION_DURATION_BASE * 0.8; // 800ms

// -- Large Explosion (Player) --
export const LARGE_EXPLOSION_PARTICLE_COUNT = 60;
export const LARGE_EXPLOSION_MAX_DISTANCE = 120;
export const LARGE_EXPLOSION_PARTICLE_LENGTH = 10;
export const LARGE_EXPLOSION_PARTICLE_THICKNESS = 2;
export const LARGE_EXPLOSION_DURATION =
  DESTRUCTION_ANIMATION_DURATION_BASE * 1.2; // 1200ms

export const BASE_CARGO_CAPACITY = 10; // Base cargo capacity
export const DEFAULT_ANIMATION_DURATION = 1000; // Default animation duration in ms
