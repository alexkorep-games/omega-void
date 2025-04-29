// src/game/logic.ts
import { IGameState, ITouchState, IPlayer, IStation } from "./types";
import { Player } from "./entities/Player";
import { Enemy } from "./entities/Enemy";
import { Projectile } from "./entities/Projectile";
import { InfiniteWorldManager } from "./world/InfiniteWorldManager";
// Removed pointToLineSegmentDistance and rotatePoint as they are not needed for this approach
import { distance } from "../utils/geometry";
import * as C from "./config"; // Use C for brevity

// --- Constants for Hexagon Docking ---
// A hexagon side spans 60 degrees (PI / 3 radians).
const DOCKING_ENTRANCE_CENTER_ANGLE = Math.PI; // Entrance
const DOCKING_ENTRANCE_HALF_SPAN = Math.PI / 12;
const DOCKING_MIN_RELATIVE_ANGLE =
  DOCKING_ENTRANCE_CENTER_ANGLE - DOCKING_ENTRANCE_HALF_SPAN; // -2*PI/3 or -120 deg
const DOCKING_MAX_RELATIVE_ANGLE =
  DOCKING_ENTRANCE_CENTER_ANGLE + DOCKING_ENTRANCE_HALF_SPAN; // -PI/3 or -60 deg

/**
 * Normalizes an angle to the range [-PI, PI].
 * @param angle Angle in radians.
 * @returns Angle normalized to [-PI, PI].
 */
function normalizeAngle(angle: number): number {
  // First wrap to [0, 2*PI]
  angle = angle % (2 * Math.PI);
  if (angle < 0) {
    angle += 2 * Math.PI;
  }
  // Then shift to [-PI, PI]
  if (angle > Math.PI) {
    angle -= 2 * Math.PI;
  }
  return angle;
}

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
      const station = bgObj as IStation;
      const player = playerInstance;

      const distToCenter = distance(player.x, player.y, station.x, station.y);

      // --- Define Thresholds ---
      // Player must be close enough to consider docking or pushback
      const interactionDistanceThreshold = player.radius + station.radius + 10; // Allow a small approach buffer
      // Threshold for pushback (actual overlap)
      const pushbackThreshold = player.radius + station.radius;

      if (distToCenter < interactionDistanceThreshold) {
        // --- Calculate Approach Angle ---
        const dxPlayerToStation = station.x - player.x;
        const dyPlayerToStation = station.y - player.y;
        const worldApproachAngle = Math.atan2(
          dyPlayerToStation,
          dxPlayerToStation
        );

        // --- Adjust for Station Rotation ---
        const relativeApproachAngleRaw = worldApproachAngle - station.angle;
        const relativeApproachAngle = normalizeAngle(relativeApproachAngleRaw); // Normalize to [-PI, PI]

        // --- Check Docking Condition (Distance + Angle) ---
        const isAngleCorrectForDocking =
          relativeApproachAngle >= DOCKING_MIN_RELATIVE_ANGLE &&
          relativeApproachAngle <= DOCKING_MAX_RELATIVE_ANGLE;

        if (isAngleCorrectForDocking) {
          // Use a slightly tighter distance check for actual docking commitment
          const dockingCommitDistance = player.radius + station.radius * 1.2; // Needs to be closer to the center when angle is right
          if (distToCenter < dockingCommitDistance) {
            console.log(
              `Docking angle OK (${relativeApproachAngle.toFixed(
                2
              )} rad) & distance OK (${distToCenter.toFixed(
                1
              )}). Docking with ${station.id}`
            );
            dockingTriggerStationId = station.id; // Signal to initiate docking
            player.vx = 0; // Stop player movement
            player.vy = 0;
            break; // Only dock with one station
          } else {
            // Optional: Log if angle is right but too far
            // console.log(`Docking angle OK (${relativeApproachAngle.toFixed(2)}) but too far (${distToCenter.toFixed(1)})`);
          }
        }

        // --- Check for Pushback Collision (If not docking and overlapping) ---
        // This happens if the angle wasn't right for docking OR if the angle was right but player wasn't close enough for commitment,
        // AND the player is physically overlapping the station radius.
        if (!dockingTriggerStationId && distToCenter < pushbackThreshold) {
          const pushAngle = Math.atan2(
            player.y - station.y,
            player.x - station.x
          ); // Angle from station *to* player
          const overlap = pushbackThreshold - distToCenter;
          player.x += Math.cos(pushAngle) * (overlap + 0.5); // Nudge factor
          player.y += Math.sin(pushAngle) * (overlap + 0.5);
          player.vx = 0; // Stop movement from collision
          player.vy = 0;
          // console.log("Collision (pushback) with station body!");
        }
      } // End distance check
    } // End if station
  } // End loop through background objects

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
        actions.completeDocking();
      } else {
        actions.completeUndocking();
      }

      return newState;
    }

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
