// src/game/logic.ts
import {
  IGameState,
  ITouchState,
  IPlayer,
  IEnemy,
  IProjectile,
  BackgroundObject,
} from "./types";
import { Player } from "./entities/Player";
import { Enemy } from "./entities/Enemy";
import { Projectile } from "./entities/Projectile";
import { InfiniteWorldManager } from "./world/InfiniteWorldManager";
import { distance } from "../utils/geometry";
import * as C from "./config"; // Use C for brevity

/**
 * Creates a new player instance, potentially loading position.
 */
export function createPlayer(x: number, y: number): IPlayer {
  return new Player(x, y);
}

/**
 * Spawns a new enemy near the player.
 */
function spawnEnemyNearPlayer(state: IGameState): IGameState {
  const spawnDist = C.GAME_WIDTH * 0.8;
  const angle = Math.random() * Math.PI * 2;
  const spawnX = state.player.x + Math.cos(angle) * spawnDist;
  const spawnY = state.player.y + Math.sin(angle) * spawnDist;
  const newEnemy = new Enemy(spawnX, spawnY, state.enemyIdCounter);

  return {
    ...state,
    enemies: [...state.enemies, newEnemy],
    enemyIdCounter: state.enemyIdCounter + 1,
    lastEnemySpawnTime: Date.now(),
  };
}

/**
 * Creates a new projectile if cooldown allows.
 */
function shootProjectile(state: IGameState): IGameState {
  const now = Date.now();
  if (now - state.lastShotTime > C.SHOOT_COOLDOWN) {
    const newProjectile = new Projectile(
      state.player.x,
      state.player.y,
      state.player.angle
    );
    return {
      ...state,
      projectiles: [...state.projectiles, newProjectile],
      lastShotTime: now,
    };
  }
  return state; // No change if on cooldown
}

/**
 * Handles collisions between different game entities.
 */
function handleCollisions(state: IGameState): IGameState {
  let newProjectiles = [...state.projectiles];
  let newEnemies = [...state.enemies];
  let newPlayer = { ...state.player }; // Copy player state for potential modification

  // Projectile vs Enemy/Station
  for (let i = newProjectiles.length - 1; i >= 0; i--) {
    const proj = newProjectiles[i];
    let projHit = false;

    // Vs Enemies
    for (let j = newEnemies.length - 1; j >= 0; j--) {
      const enemy = newEnemies[j];
      if (
        distance(proj.x, proj.y, enemy.x, enemy.y) <
        proj.radius + enemy.radius
      ) {
        newProjectiles.splice(i, 1);
        newEnemies.splice(j, 1);
        projHit = true;
        break; // Projectile can only hit one thing
      }
    }
    if (projHit) continue; // Move to next projectile if hit occurred

    // Vs Stations
    for (const bgObj of state.visibleBackgroundObjects) {
      if (bgObj.type === "station") {
        if (
          distance(proj.x, proj.y, bgObj.x, bgObj.y) <
          proj.radius + bgObj.radius
        ) {
          newProjectiles.splice(i, 1);
          // Stations are indestructible for now
          projHit = true;
          break;
        }
      }
    }
  }

  // Player vs Enemy
  for (let i = newEnemies.length - 1; i >= 0; i--) {
    const enemy = newEnemies[i];
    if (
      distance(newPlayer.x, newPlayer.y, enemy.x, enemy.y) <
      newPlayer.radius + enemy.radius
    ) {
      newEnemies.splice(i, 1);
      console.log("Collision with enemy!");
      // TODO: Implement player damage/death state
    }
  }

  // Player vs Station (Pushback)
  for (const bgObj of state.visibleBackgroundObjects) {
    if (bgObj.type === "station") {
      const dist = distance(newPlayer.x, newPlayer.y, bgObj.x, bgObj.y);
      if (dist < newPlayer.radius + bgObj.radius) {
        const angle = Math.atan2(newPlayer.y - bgObj.y, newPlayer.x - bgObj.x);
        const overlap = newPlayer.radius + bgObj.radius - dist;
        // Apply pushback slightly larger than overlap to prevent sticking
        newPlayer.x += Math.cos(angle) * (overlap + 1);
        newPlayer.y += Math.sin(angle) * (overlap + 1);
        // Stop player movement after collision
        newPlayer.vx = 0;
        newPlayer.vy = 0;
        console.log("Collision with station!");
        // Note: If multiple station collisions happen in one frame, the last one wins.
        // More robust physics might be needed for complex scenarios.
      }
    }
  }

  return {
    ...state,
    player: newPlayer,
    enemies: newEnemies,
    projectiles: newProjectiles,
  };
}

/**
 * The main update function for the game state.
 * Takes the current state, input, world manager, delta time, and current time.
 * Returns the new game state.
 */
export function updateGameState(
  currentState: IGameState,
  touchState: ITouchState,
  worldManager: InfiniteWorldManager,
  deltaTime: number, // Can be used for frame-rate independent movement if needed
  now: number
): IGameState {
  let newState = { ...currentState };

  // 1. Handle Input & Player Update
  if (touchState.shoot.active) {
    newState = shootProjectile(newState);
  }
  // Player class handles its own movement based on touchState
  (newState.player as Player).update(touchState); // Need to cast to call class method

  // 2. Update Camera based on new player position
  newState.camera = {
    x: newState.player.x - C.GAME_WIDTH / 2,
    y: newState.player.y - C.GAME_VIEW_HEIGHT / 2,
  };

  // 3. Update World Objects (get visible stars/stations)
  // This also updates station rotation inside the manager based on current time
  newState.visibleBackgroundObjects = worldManager.getObjectsInView(
    newState.camera.x,
    newState.camera.y,
    C.GAME_WIDTH,
    C.GAME_VIEW_HEIGHT
  );

  // 4. Update Projectiles & Filter out-of-bounds/dead ones
  newState.projectiles = newState.projectiles.filter((p) => {
    (p as Projectile).update(); // Cast to call method
    return !(p as Projectile).isOutOfBounds(
      newState.player.x,
      newState.player.y
    );
  });

  // 5. Update Enemies
  newState.enemies.forEach((enemy) => (enemy as Enemy).update(newState.player)); // Cast to call method

  // 6. Despawn Far Enemies
  const enemyIdsToDespawn = worldManager.getEnemiesToDespawn(
    newState.enemies,
    newState.player.x,
    newState.player.y,
    C.ENEMY_DESPAWN_RADIUS
  );
  if (enemyIdsToDespawn.length > 0) {
    const idsSet = new Set(enemyIdsToDespawn);
    newState.enemies = newState.enemies.filter(
      (enemy) => !idsSet.has(enemy.id)
    );
  }

  // 7. Spawn New Enemies
  if (
    now - newState.lastEnemySpawnTime > C.ENEMY_SPAWN_INTERVAL &&
    newState.enemies.length < C.MAX_ENEMIES
  ) {
    newState = spawnEnemyNearPlayer(newState);
  }

  // 8. Handle Collisions
  newState = handleCollisions(newState);

  // Return the fully updated state
  return newState;
}
