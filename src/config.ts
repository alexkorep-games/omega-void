// src/config.ts
export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 640;
export const HUD_HEIGHT = 120;
export const GAME_VIEW_HEIGHT = GAME_HEIGHT - HUD_HEIGHT;

export const PLAYER_COLOR = 0xff00ff; // Magenta (use hex numbers for Pixi colors)
export const ENEMY_COLOR = 0x00ffff; // Cyan
export const PROJECTILE_COLOR = 0xffffff; // White
export const HUD_COLOR = 0x00ffff;
export const HUD_ACCENT_COLOR = 0xff00ff;
export const BACKGROUND_COLOR = 0x000000; // Black

export const PLAYER_SIZE = 15;
export const ENEMY_SIZE = 18;
export const PROJECTILE_SIZE = 2;

export const PLAYER_SPEED = 2.5;
export const ENEMY_SPEED = 1;
export const PROJECTILE_SPEED = 5;
export const PROJECTILE_LIFESPAN_FRAMES = 150; // Corresponds to original 'life'

export const MAX_ENEMIES = 8;
export const ENEMY_SPAWN_INTERVAL = 2000; // ms
export const SHOOT_COOLDOWN = 200; // ms

export const ENEMY_DESPAWN_RADIUS = GAME_WIDTH * 2.5;
export const PROJECTILE_DESPAWN_RADIUS_MULTIPLIER = 1.5;

// Saving
export const SAVE_COORDS_INTERVAL = 5000; // ms
export const LOCAL_STORAGE_COORDS_KEY = "eliteShooterPlayerCoords_ReactPixi";

// World Manager Config
export const WORLD_CONFIG = {
    cellSize: 350,
    starBaseDensity: 0.0001,
    stationProbability: 0.05,
    starColor: 0xffffff, // White
    stationColor: 0x00ffff, // Cyan
    minStationSize: 45,
    maxStationSize: 90,
    minStarSize: 0.5,
    maxStarSize: 1.8,
    viewBufferFactor: 1.5,
};

// Touch Control Visuals
export const TOUCH_JOYSTICK_OUTER_RADIUS = 40;
export const TOUCH_JOYSTICK_INNER_RADIUS = 25;
export const TOUCH_SHOOT_INDICATOR_RADIUS = 35;
export const TOUCH_SHOOT_INNER_DOT_RADIUS = 8;