// src/game/logic.ts
import { IGameState, ITouchState, IPlayer } from "./types";
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
 * Returns a new state object with updated entities.
 */
function handleCollisions(state: IGameState): IGameState {
  const newProjectiles = [...state.projectiles];
  const newEnemies = [...state.enemies];
  const playerInstance = state.player;

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
        // TODO: Add score, explosion effect etc.
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
      distance(playerInstance.x, playerInstance.y, enemy.x, enemy.y) < // Use playerInstance
      playerInstance.radius + enemy.radius
    ) {
      newEnemies.splice(i, 1);
      console.log("Collision with enemy!");
      // TODO: Implement player damage/death state
    }
  }

  // Player vs Station (Pushback - MODIFY THE INSTANCE DIRECTLY)
  for (const bgObj of state.visibleBackgroundObjects) {
    if (bgObj.type === "station") {
      const dist = distance(
        playerInstance.x,
        playerInstance.y,
        bgObj.x,
        bgObj.y
      ); // Use playerInstance
      if (dist < playerInstance.radius + bgObj.radius) {
        const angle = Math.atan2(
          playerInstance.y - bgObj.y,
          playerInstance.x - bgObj.x
        );
        const overlap = playerInstance.radius + bgObj.radius - dist;
        // Apply pushback slightly larger than overlap to prevent sticking
        // Modify the instance directly
        playerInstance.x += Math.cos(angle) * (overlap + 1);
        playerInstance.y += Math.sin(angle) * (overlap + 1);
        // Stop player movement after collision
        playerInstance.vx = 0;
        playerInstance.vy = 0;
        console.log("Collision with station!");
        // Note: If multiple station collisions happen in one frame, the last one wins or accumulates.
        // break; // Consider if break is needed after first station collision
      }
    }
  }

  // Return new state with the (potentially mutated) player instance
  return {
    ...state, // Copy other properties from the original state
    player: playerInstance, // Assign the instance back
    enemies: newEnemies, // Assign the new array
    projectiles: newProjectiles, // Assign the new array
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
  _deltaTime: number, // Can be used for frame-rate independent movement if needed
  now: number
): IGameState {
  // Ensure player is an instance (Defensive check, shouldn't be needed after fix)
  // If the player somehow isn't an instance at the start, this is a different bug.
  // if (!(currentState.player instanceof Player)) {
  //     console.error("Initial player state is not a Player instance!", currentState.player);
  //     // Attempt recovery? Or let it fail clearly.
  //     // For now, assume it starts correctly due to createPlayer.
  // }

  let newState = { ...currentState }; // Initial shallow copy

  // 1. Handle Input & Player Update
  if (touchState.shoot.active) {
    newState = shootProjectile(newState); // shootProjectile returns a new state object
  }
  // Player class handles its own movement based on touchState
  // newState.player should still be the instance here
  (newState.player as Player).update(touchState); // This modifies the player instance within newState

  // 2. Update Camera based on new player position (after input update)
  newState.camera = {
    x: newState.player.x - C.GAME_WIDTH / 2,
    y: newState.player.y - C.GAME_VIEW_HEIGHT / 2,
  };

  // 3. Update World Objects (get visible stars/stations)
  newState.visibleBackgroundObjects = worldManager.getObjectsInView(
    newState.camera.x,
    newState.camera.y,
    C.GAME_WIDTH,
    C.GAME_VIEW_HEIGHT
  );

  // 4. Update Projectiles & Filter out-of-bounds/dead ones
  // Make sure to return a new array for projectiles
  newState.projectiles = newState.projectiles
    .map((p) => {
      // If Projectile is a class, ensure its update doesn't suffer the same issue.
      // Assuming Projectile instances are preserved correctly.
      (p as Projectile).update(); // Update in place
      return p;
    })
    .filter(
      (p) =>
        !(p as Projectile).isOutOfBounds(newState.player.x, newState.player.y)
    );

  // 5. Update Enemies
  // Make sure to return a new array for enemies
  newState.enemies = newState.enemies.map((enemy) => {
    (enemy as Enemy).update(newState.player); // Update in place
    return enemy;
  });

  // 6. Despawn Far Enemies
  const enemyIdsToDespawn = worldManager.getEnemiesToDespawn(
    newState.enemies,
    newState.player.x,
    newState.player.y,
    C.ENEMY_DESPAWN_RADIUS
  );
  if (enemyIdsToDespawn.length > 0) {
    const idsSet = new Set(enemyIdsToDespawn);
    // Filter returns a new array
    newState.enemies = newState.enemies.filter(
      (enemy) => !idsSet.has(enemy.id)
    );
  }

  // 7. Spawn New Enemies
  if (
    now - newState.lastEnemySpawnTime > C.ENEMY_SPAWN_INTERVAL &&
    newState.enemies.length < C.MAX_ENEMIES
  ) {
    // spawnEnemyNearPlayer returns a new state object
    newState = spawnEnemyNearPlayer(newState);
  }

  // 8. Handle Collisions
  // handleCollisions now correctly returns a new state object
  // where the player is still an instance (potentially mutated)
  newState = handleCollisions(newState);

  // Camera update might be needed again if collisions moved the player significantly
  newState.camera = {
    x: newState.player.x - C.GAME_WIDTH / 2,
    y: newState.player.y - C.GAME_VIEW_HEIGHT / 2,
  };

  // Return the fully updated state
  return newState;
}
