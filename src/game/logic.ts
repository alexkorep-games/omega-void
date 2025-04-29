// src/game/logic.ts
import { IGameState, ITouchState, IPlayer, IStation } from "./types";
import { Player } from "./entities/Player";
import { Enemy } from "./entities/Enemy";
import { Projectile } from "./entities/Projectile";
import { InfiniteWorldManager } from "./world/InfiniteWorldManager";
// Need world manager to find stations
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
  return new Player(x, y); // Player constructor sets default shield
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
    lastEnemySpawnTime: performance.now(),
  };
}

/**
 * Creates a new projectile if cooldown allows.
 */
function shootProjectile(state: IGameState): IGameState {
  const now = performance.now();
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
  playerDestroyed: boolean;
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
  let playerHit = false;
  for (let i = newEnemies.length - 1; i >= 0; i--) {
    const enemy = newEnemies[i];
    if (
      playerInstance && // Check if player instance exists
      distance(playerInstance.x, playerInstance.y, enemy.x, enemy.y) <
        playerInstance.radius + enemy.radius
    ) {
      playerHit = true;
      newEnemies.splice(i, 1);
      console.log(
        `Collision with enemy! Shield: ${playerInstance.shieldLevel}% -> ${
          playerInstance.shieldLevel - C.ENEMY_SHIELD_DAMAGE
        }%`
      );
      playerInstance.shieldLevel -= C.ENEMY_SHIELD_DAMAGE;
      playerInstance.shieldLevel = Math.max(0, playerInstance.shieldLevel); // Clamp at 0
      // Don't break, allow multiple enemies to hit in one frame (maybe?)
    }
  }

  // Check for player destruction *after* checking all enemy collisions in this frame
  if (playerHit && playerInstance && playerInstance.shieldLevel <= 0) {
    console.log("Player shield depleted! Ship destroyed.");
    // Signal destruction, newState will be handled later
    // Pass back the state *before* modifying player, but signal destruction
    const stateBeforePlayerModification = {
      ...state,
      enemies: newEnemies,
      projectiles: newProjectiles,
    };
    return {
      newState: stateBeforePlayerModification,
      dockingTriggerStationId: null,
      playerDestroyed: true,
    };
  }

  // Player vs Station (Check for Docking or Pushback)
  for (const bgObj of state.visibleBackgroundObjects) {
    if (bgObj.type === "station") {
      const station = bgObj as IStation;
      const player = playerInstance;

      // Check if player exists before accessing properties
      if (!player) continue;

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
              // TODO: This is duplicated in the hook, remove one?
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
    playerDestroyed: false, // Not destroyed by station collision
  };
}

export function updateGameStateLogic(
  currentState: IGameState,
  touchState: ITouchState | undefined,
  worldManager: InfiniteWorldManager,
  deltaTime: number,
  now: number
): IGameState {
  let newState = { ...currentState };

  // --- Handle Destroyed State ---
  if (newState.gameView === "destroyed") {
    // Decrement timer
    newState.respawnTimer -= deltaTime;
    if (newState.respawnTimer <= 0) {
      console.log("Respawn timer finished. Respawning player...");
      // Find respawn station
      const respawnStationId =
        newState.lastDockedStationId ?? C.WORLD_ORIGIN_STATION_ID;
      const respawnStation = worldManager.getStationById(respawnStationId);
      let respawnX = 0;
      let respawnY = 0;
      if (respawnStation) {
        // Respawn near the station exit
        const exitAngle = respawnStation.angle + Math.PI; // Angle opposite docking entrance
        const respawnDist =
          respawnStation.radius +
          (newState.player?.radius ?? C.PLAYER_SIZE / 2) +
          20; // Use current player radius or default
        respawnX = respawnStation.x + Math.cos(exitAngle) * respawnDist;
        respawnY = respawnStation.y + Math.sin(exitAngle) * respawnDist;
      } else {
        console.warn(
          `Could not find respawn station ${respawnStationId}. Respawning at origin.`
        );
      }

      // Reset player state
      const respawnedPlayer = createPlayer(respawnX, respawnY); // Creates player with full shield
      // respawnedPlayer.shieldLevel = C.DEFAULT_STARTING_SHIELD; // Already set by createPlayer

      // Return new state with respawned player
      return {
        ...newState,
        player: respawnedPlayer,
        cargoHold: new Map(), // Clear cargo
        gameView: "playing",
        respawnTimer: 0,
        enemies: [], // Clear enemies from previous state
        projectiles: [], // Clear projectiles
      };
    }
    // If timer still running, just update timer and keep view as 'destroyed'
    return { ...newState, respawnTimer: newState.respawnTimer }; // Return state with updated timer
  }

  // --- Handle Animations ---
  if (newState.gameView === "docking" || newState.gameView === "undocking") {
    // Ensure animationState exists and is not null type before incrementing
    if (newState.animationState.type) {
      newState.animationState = {
        ...newState.animationState,
        progress: newState.animationState.progress + deltaTime,
      };

      if (
        newState.animationState.progress >= newState.animationState.duration
      ) {
        // Animation finished: Signal completion by setting type to null
        console.log(`Logic: ${newState.gameView} animation finished.`);
        newState.animationState = {
          ...newState.animationState,
          type: null,
          progress: 0,
        };
        // Crucially, DO NOT change gameView here. Let the hook handle it.
        return newState; // Return state indicating animation ended
      }
    }
    // If animation is running but not finished, return state with updated progress
    return newState;
  }

  // --- Handle Gameplay (Only when 'playing') ---
  if (newState.gameView === "playing") {
    // Ensure player exists and is an instance
    if (!newState.player || !(newState.player instanceof Player)) {
      console.error(
        "Player state is missing or not a Player instance during update!",
        newState.player
      );
      // Attempt recovery: If we have coordinates, create player. Otherwise, this is a critical error.
      if (
        currentState.player?.x !== undefined &&
        currentState.player?.y !== undefined
      ) {
        newState.player = new Player(
          currentState.player.x,
          currentState.player.y
        );
        newState.player.angle = currentState.player.angle ?? -Math.PI / 2; // Preserve angle if possible
        newState.player.shieldLevel =
          currentState.player.shieldLevel ?? C.DEFAULT_STARTING_SHIELD; // Preserve shield
      } else {
        // Cannot recover, return current state to avoid crashing loop
        console.error("Cannot recover player state. Bailing out of update.");
        return currentState;
      }
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
    newState = collisionResult.newState; // Apply pushback etc.

    // Check if player was destroyed by collision logic
    if (collisionResult.playerDestroyed) {
      console.log("Logic: Player destroyed signal received.");
      // Transition to destroyed state
      // Use the state returned by handleCollisions which might have updated enemies/projectiles
      return {
        ...collisionResult.newState, // Base on the state returned from collision
        player: { ...collisionResult.newState.player, shieldLevel: 0 }, // Ensure shield is visually 0 if needed immediately
        gameView: "destroyed",
        respawnTimer: C.RESPAWN_DELAY_MS,
        projectiles: [], // Clear projectiles immediately on destruction
        enemies: [], // Clear enemies immediately on destruction
      };
    }

    // Check if docking was triggered by collision logic
    if (collisionResult.dockingTriggerStationId) {
      // Signal intent to dock by setting the ID. Keep view as 'playing'.
      console.log(
        `Logic: Docking collision detected for ${collisionResult.dockingTriggerStationId}`
      );
      newState.dockingStationId = collisionResult.dockingTriggerStationId;
      // Ensure player velocity is stopped *immediately* in the logic state
      if (newState.player instanceof Player) {
        newState.player.vx = 0;
        newState.player.vy = 0;
      } else if (newState.player) {
        // Check if player exists even if not instance
        // If player is not an instance, create a new one with stopped velocity
        newState.player = new Player(newState.player.x, newState.player.y);
        newState.player.angle = currentState.player?.angle ?? -Math.PI / 2; // Preserve angle
        newState.player.shieldLevel =
          currentState.player?.shieldLevel ?? C.DEFAULT_STARTING_SHIELD; // Preserve shield
        newState.player.vx = 0;
        newState.player.vy = 0;
        console.warn(
          "Player object was not an instance during docking collision check. Recreated."
        );
      }
      // Return the state signalling the *start* of docking process
      return newState;
    }

    // Camera update might be needed again if collisions moved the player
    // Ensure player exists before updating camera based on it
    if (newState.player) {
      newState.camera = {
        x: newState.player.x - C.GAME_WIDTH / 2,
        y: newState.player.y - C.GAME_VIEW_HEIGHT / 2,
      };
    }
  }

  // Return the fully updated state
  return newState;
}
