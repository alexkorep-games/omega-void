// src/game/config.ts
export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 640;
export const HUD_HEIGHT = 120;
export const GAME_VIEW_HEIGHT = GAME_HEIGHT - HUD_HEIGHT;

// Spawning / Despawning
export const INITIAL_SPAWN_AREA_WIDTH = 1000; // Used conceptually for initial placement if needed
export const INITIAL_SPAWN_AREA_HEIGHT = 1000;
export const WORLD_ORIGIN_STATION_ID = "station_0_0"; // ID of the station at cell 0,0 (if it exists)
export const ENEMY_DESPAWN_RADIUS = GAME_WIDTH * 2.5;
export const PROJECTILE_DESPAWN_RADIUS_FACTOR = 1.5; // Projectiles despawn further out
export const MAX_ENEMIES = 8;
export const ENEMY_SPAWN_INTERVAL = 2000; // ms
export const SHOOT_COOLDOWN = 200; // ms

// Colors
export const PLAYER_COLOR = "#FF00FF"; // Magenta
export const ENEMY_COLOR = "#00FFFF"; // Cyan
export const PROJECTILE_COLOR = "#FFFFFF"; // White
export const HUD_COLOR = "#00FFFF";
export const HUD_ACCENT_COLOR = "#FF00FF";
export const HUD_SHIELD_BAR_COLOR = "#00AAFF"; // Light Blue for shield bar
export const HUD_SHIELD_BAR_EMPTY_COLOR = "#333355"; // Dim background for shield bar
export const STAR_COLOR = "#FFFFFF";
export const STATION_COLOR = "#00FFFF";

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
export const TOUCH_MOVE_MAX_DIST = 50; // Max distance from start touch for full speed
export const TOUCH_JOYSTICK_OUTER_RADIUS = 40;
export const TOUCH_JOYSTICK_INNER_RADIUS = 25;
export const TOUCH_SHOOT_INDICATOR_RADIUS = 35;
export const TOUCH_SHOOT_INDICATOR_INNER_RADIUS = 8;

// Saving
export const SAVE_STATE_INTERVAL = 5000;
export const LOCAL_STORAGE_GAME_STATE_KEY = "omegaVoidGameState"; // New combined key

// Drawing
export const SCANNER_MAX_DIST = 800;

export const DEFAULT_STARTING_CASH = 100.0;
export const DEFAULT_STARTING_SHIELD = 100;

// Gameplay Tuning
export const ENEMY_SHIELD_DAMAGE = 10; // % shield damage per hit
export const RESPAWN_DELAY_MS = 3000; // Time in ms before respawn
