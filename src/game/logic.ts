// src/game/logic.ts
import { IGameState, ITouchState, IPlayer, IStation } from "./types";
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
 * Returns a new state object with updated entities and docking trigger info.
 */
function handleCollisions(state: IGameState): {
  newState: IGameState;
  dockingTriggerStationId: string | null;
} {
  const newProjectiles = [...state.projectiles];
  const newEnemies = [...state.enemies];
  const playerInstance = state.player;
  let dockingTriggerStationId: string | null = null;

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

  // Player vs Station (Check for Docking or Pushback)
  for (const bgObj of state.visibleBackgroundObjects) {
    if (bgObj.type === "station") {
      const dist = distance(
        playerInstance.x,
        playerInstance.y,
        bgObj.x,
        bgObj.y
      );
      const dockThreshold = playerInstance.radius + bgObj.radius * 1.2; // Closer threshold for docking
      const pushbackThreshold = playerInstance.radius + bgObj.radius;

      // Check for docking first
      if (dist < dockThreshold) {
        console.log("Close enough to dock with station:", bgObj.id);
        dockingTriggerStationId = bgObj.id; // Signal to initiate docking
        // Stop player movement immediately upon docking trigger
        playerInstance.vx = 0;
        playerInstance.vy = 0;
        break; // Only dock with one station at a time
      }
      // If not docking, check for pushback collision
      else if (dist < pushbackThreshold) {
        const angle = Math.atan2(
          playerInstance.y - bgObj.y,
          playerInstance.x - bgObj.x
        );
        const overlap = pushbackThreshold - dist;
        playerInstance.x += Math.cos(angle) * (overlap + 0.5); // Nudge factor
        playerInstance.y += Math.sin(angle) * (overlap + 0.5);
        playerInstance.vx = 0;
        playerInstance.vy = 0;
        console.log("Collision (pushback) with station!");
        // Don't break here, could potentially push back from multiple if overlapping weirdly
      }
    }
  }

  // Return new state and docking trigger
  return {
    newState: {
      ...state,
      player: playerInstance, // Keep the potentially mutated instance
      enemies: newEnemies,
      projectiles: newProjectiles,
    },
    dockingTriggerStationId,
  };
}

/**
 * The main update function for the game state.
 * Takes the current state, input, world manager, delta time, and current time.
 * Returns the new game state.
 */
export function updateGameStateLogic( // Renamed to avoid conflict if imported directly
  currentState: IGameState,
  touchState: ITouchState | undefined, // Touch state is optional now
  worldManager: InfiniteWorldManager,
  deltaTime: number,
  now: number,
  actions: {
    // Pass actions from useGameState
    initiateDocking: (stationId: string) => void;
    completeDocking: () => void;
    completeUndocking: () => void;
  }
): IGameState {
  let newState = { ...currentState }; // Start with a copy

  // --- Handle Animations ---
  if (newState.gameView === "docking" || newState.gameView === "undocking") {
    newState.animationState.progress += deltaTime;
    if (newState.animationState.progress >= newState.animationState.duration) {
      if (newState.gameView === "docking") {
        actions.completeDocking(); // Call action from hook
      } else {
        // undocking
        actions.completeUndocking(); // Call action from hook
      }
      // Return early after completing animation, state is updated by actions
      // We need to return the *result* of the action, which happens in useGameState's setState
      // So, just return the current state here, the hook will handle the transition.
      // Or better: Modify the state directly here for the next frame render before hook updates.
      if (newState.gameView === "docking") {
        newState.gameView = "docked";
        newState.animationState = {
          ...newState.animationState,
          type: null,
          progress: 0,
        };
      } else {
        newState.gameView = "playing";
        newState.dockingStationId = null; // Clear station ID
        newState.animationState = {
          ...newState.animationState,
          type: null,
          progress: 0,
        };

        // Find the station player just undocked from to reposition player
        const station = newState.visibleBackgroundObjects.find(
          (obj) =>
            obj.type === "station" && obj.id === currentState.dockingStationId
        ) as IStation | undefined;
        if (station) {
          const undockDist = station.radius + newState.player.radius + 20; // Appear slightly away
          const angle = Math.random() * Math.PI * 2; // Appear at a random angle
          newState.player.x = station.x + Math.cos(angle) * undockDist;
          newState.player.y = station.y + Math.sin(angle) * undockDist;
        }
      }
    }
    // Return the state with updated animation progress
    return newState;
  }

  // --- Handle Gameplay (Only when 'playing') ---
  if (newState.gameView === "playing") {
    // Ensure player is an instance
    if (!(newState.player instanceof Player)) {
      console.error(
        "Player state is not a Player instance during update!",
        newState.player
      );
      // Attempt recovery or bail? For now, try creating it again.
      newState.player = new Player(newState.player.x, newState.player.y);
      newState.player.angle = currentState.player.angle; // Preserve angle if possible
    }

    // 1. Handle Input & Player Update
    if (touchState?.shoot.active) {
      newState = shootProjectile(newState);
    }
    // Only update player if touchState is provided (i.e., game is playing)
    if (touchState) {
      (newState.player as Player).update(touchState);
    }

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

    // 8. Handle Collisions & Docking Check
    const collisionResult = handleCollisions(newState);
    newState = collisionResult.newState; // Update state based on collisions (pushback etc.)

    if (collisionResult.dockingTriggerStationId) {
      // Call the action provided by the hook to change the game state
      actions.initiateDocking(collisionResult.dockingTriggerStationId);
      // Return the state *before* the docking animation starts.
      // The hook's setState will trigger the re-render with the 'docking' view.
      // Modify state directly to reflect docking start immediately
      newState.gameView = "docking";
      newState.dockingStationId = collisionResult.dockingTriggerStationId;
      newState.animationState = {
        type: "docking",
        progress: 0,
        duration: 1500,
      }; // Reset animation
      return newState;
    }

    // Camera update might be needed again if collisions moved the player
    newState.camera = {
      x: newState.player.x - C.GAME_WIDTH / 2,
      y: newState.player.y - C.GAME_VIEW_HEIGHT / 2,
    };
  }

  // Return the fully updated state
  return newState;
}
