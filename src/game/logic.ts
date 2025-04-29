// src/game/logic.ts
import {
  IGameState,
  ITouchState,
  IPlayer,
  IStation,
  DestructionAnimationData,
} from "./types"; // Added DestructionAnimationData
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
  DOCKING_ENTRANCE_CENTER_ANGLE - DOCKING_ENTRANCE_HALF_SPAN;
const DOCKING_MAX_RELATIVE_ANGLE =
  DOCKING_ENTRANCE_CENTER_ANGLE + DOCKING_ENTRANCE_HALF_SPAN;

// --- Constants for Destruction Animations ---
const DESTRUCTION_ANIMATION_DURATION = 1000; // ms

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
 * Returns a new state object with updated entities and trigger info.
 */
function handleCollisions(
  state: IGameState,
  now: number // Pass current time for animation start time
): {
  newState: IGameState;
  dockingTriggerStationId: string | null;
  playerDestroyed: boolean;
  newAnimations: DestructionAnimationData[]; // Return newly created animations
} {
  const newProjectiles = [...state.projectiles];
  const newEnemies = [...state.enemies];
  const playerInstance = state.player;
  let dockingTriggerStationId: string | null = null;
  let newAnimations: DestructionAnimationData[] = []; // Initialize animation list

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
        // Create ENEMY destruction animation on projectile hit
        newAnimations.push({
          id: `destroy-enemy-proj-${enemy.id}-${now}`,
          x: enemy.x,
          y: enemy.y,
          color: enemy.color,
          size: "small",
          startTime: now,
        });
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
  let playerHitThisFrame = false;
  let playerDestroyed = false;

  if (playerInstance) {
    // Only check if player exists
    for (let i = newEnemies.length - 1; i >= 0; i--) {
      const enemy = newEnemies[i];
      if (
        distance(playerInstance.x, playerInstance.y, enemy.x, enemy.y) <
        playerInstance.radius + enemy.radius
      ) {
        playerHitThisFrame = true;
        // Create ENEMY destruction animation on PLAYER collision
        newAnimations.push({
          id: `destroy-enemy-player-${enemy.id}-${now}`,
          x: enemy.x,
          y: enemy.y,
          color: enemy.color,
          size: "small", // Small animation for enemy hitting player
          startTime: now,
        });

        newEnemies.splice(i, 1); // Remove enemy

        // Apply damage to player
        playerInstance.shieldLevel -= C.ENEMY_SHIELD_DAMAGE;
        playerInstance.shieldLevel = Math.max(0, playerInstance.shieldLevel); // Clamp at 0
        console.log(
          `Collision with enemy! Shield: ${playerInstance.shieldLevel}%`
        );

        // Check if this hit destroys the player
        if (playerInstance.shieldLevel <= 0) {
          playerDestroyed = true;
          // Don't break loop immediately, let other enemies hit if overlapping in same frame
        }
      }
    }
  }

  // If player was destroyed in this frame's checks
  if (playerDestroyed) {
    console.log("Player shield depleted! Ship destroyed.");
    // Create PLAYER destruction animation
    newAnimations.push({
      id: `destroy-player-${playerInstance.id}-${now}`,
      x: playerInstance.x,
      y: playerInstance.y,
      color: playerInstance.color,
      size: "large",
      startTime: now,
    });
    // Pass back the state *before* removing player, but signal destruction
    const stateBeforePlayerModification = {
      ...state,
      enemies: newEnemies,
      projectiles: newProjectiles,
      // Don't modify player object itself here, let the main logic handle view transition
    };
    return {
      newState: stateBeforePlayerModification,
      dockingTriggerStationId: null,
      playerDestroyed: true, // Signal destruction
      newAnimations: newAnimations,
    };
  }

  // Player vs Station (Check for Docking or Pushback)
  // Only proceed if player exists and was not destroyed this frame
  if (playerInstance && !playerDestroyed) {
    for (const bgObj of state.visibleBackgroundObjects) {
      if (bgObj.type === "station") {
        const station = bgObj as IStation;
        const player = playerInstance;

        const distToCenter = distance(player.x, player.y, station.x, station.y);
        const interactionDistanceThreshold =
          player.radius + station.radius + 10;
        const pushbackThreshold = player.radius + station.radius;

        if (distToCenter < interactionDistanceThreshold) {
          const dxPlayerToStation = station.x - player.x;
          const dyPlayerToStation = station.y - player.y;
          const worldApproachAngle = Math.atan2(
            dyPlayerToStation,
            dxPlayerToStation
          );
          const relativeApproachAngleRaw = worldApproachAngle - station.angle;
          const relativeApproachAngle = normalizeAngle(
            relativeApproachAngleRaw
          );
          const isAngleCorrectForDocking =
            relativeApproachAngle >= DOCKING_MIN_RELATIVE_ANGLE &&
            relativeApproachAngle <= DOCKING_MAX_RELATIVE_ANGLE;

          if (isAngleCorrectForDocking) {
            const dockingCommitDistance = player.radius + station.radius * 1.2;
            if (distToCenter < dockingCommitDistance) {
              console.log(
                `Docking angle OK (${relativeApproachAngle.toFixed(
                  2
                )} rad) & distance OK (${distToCenter.toFixed(
                  1
                )}). Docking with ${station.id}`
              );
              dockingTriggerStationId = station.id;
              player.vx = 0;
              player.vy = 0;
              break; // Dock with one station only
            }
          }

          if (!dockingTriggerStationId && distToCenter < pushbackThreshold) {
            const pushAngle = Math.atan2(
              player.y - station.y,
              player.x - station.x
            );
            const overlap = pushbackThreshold - distToCenter;
            player.x += Math.cos(pushAngle) * (overlap + 0.5);
            player.y += Math.sin(pushAngle) * (overlap + 0.5);
            player.vx = 0;
            player.vy = 0;
          }
        }
      }
    }
  }

  // Return new state and triggers
  return {
    newState: {
      ...state,
      player: playerInstance,
      enemies: newEnemies,
      projectiles: newProjectiles,
      // Active animations are handled in the main update loop
    },
    dockingTriggerStationId,
    playerDestroyed: false, // Not destroyed unless signaled above
    newAnimations: newAnimations,
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

  // --- Update and Filter Active Destruction Animations ---
  // Filter out animations that have finished
  newState.activeDestructionAnimations =
    newState.activeDestructionAnimations.filter(
      (anim) => now - anim.startTime < DESTRUCTION_ANIMATION_DURATION + 100 // Keep for duration + buffer
    );

  // --- Handle Destroyed State ---
  if (newState.gameView === "destroyed") {
    // Decrement timer
    newState.respawnTimer -= deltaTime;
    if (newState.respawnTimer <= 0) {
      console.log("Respawn timer finished. Respawning player...");
      const respawnStationId =
        newState.lastDockedStationId ?? C.WORLD_ORIGIN_STATION_ID;
      const respawnStation = worldManager.getStationById(respawnStationId);
      let respawnX = 0;
      let respawnY = 0;
      if (respawnStation) {
        const exitAngle = respawnStation.angle + Math.PI;
        const respawnDist = respawnStation.radius + C.PLAYER_SIZE / 2 + 20; // Use default player size for calc
        respawnX = respawnStation.x + Math.cos(exitAngle) * respawnDist;
        respawnY = respawnStation.y + Math.sin(exitAngle) * respawnDist;
      } else {
        console.warn(
          `Could not find respawn station ${respawnStationId}. Respawning at origin.`
        );
      }

      const respawnedPlayer = createPlayer(respawnX, respawnY);

      return {
        ...newState,
        player: respawnedPlayer,
        cargoHold: new Map(), // Clear cargo
        gameView: "playing",
        respawnTimer: 0,
        enemies: [],
        projectiles: [],
        activeDestructionAnimations: [], // Clear any remaining animations on respawn
      };
    }
    // If timer still running, just update timer and keep view as 'destroyed'
    // Also update camera based on the *static* player position from the destroyed state
    const deadPlayer = currentState.player; // Use player from state *before* this update tick
    return {
      ...newState,
      respawnTimer: newState.respawnTimer,
      camera: {
        x: deadPlayer.x - C.GAME_WIDTH / 2,
        y: deadPlayer.y - C.GAME_VIEW_HEIGHT / 2,
      },
    };
  }

  // --- Handle Animations ---
  if (newState.gameView === "docking" || newState.gameView === "undocking") {
    if (newState.animationState.type) {
      newState.animationState = {
        ...newState.animationState,
        progress: newState.animationState.progress + deltaTime,
      };

      if (
        newState.animationState.progress >= newState.animationState.duration
      ) {
        console.log(`Logic: ${newState.gameView} animation finished.`);
        newState.animationState = {
          ...newState.animationState,
          type: null,
          progress: 0,
        };
        return newState;
      }
    }
    return newState;
  }

  // --- Handle Gameplay (Only when 'playing') ---
  if (newState.gameView === "playing") {
    if (!newState.player || !(newState.player instanceof Player)) {
      console.error(
        "Player state is missing or not a Player instance during update!",
        newState.player
      );
      if (
        currentState.player?.x !== undefined &&
        currentState.player?.y !== undefined
      ) {
        newState.player = new Player(
          currentState.player.x,
          currentState.player.y
        );
        newState.player.angle = currentState.player.angle ?? -Math.PI / 2;
        newState.player.shieldLevel =
          currentState.player.shieldLevel ?? C.DEFAULT_STARTING_SHIELD;
      } else {
        console.error("Cannot recover player state. Bailing out of update.");
        return currentState;
      }
    }

    // 1. Handle Input & Player Update
    if (touchState?.shoot.active) {
      newState = shootProjectile(newState);
    }
    if (touchState) {
      (newState.player as Player).update(touchState);
    }

    // 2. Update Camera based on new player position
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
    newState.projectiles = newState.projectiles
      .map((p) => {
        (p as Projectile).update();
        return p;
      })
      .filter(
        (p) =>
          !(p as Projectile).isOutOfBounds(newState.player.x, newState.player.y)
      );

    // 5. Update Enemies
    newState.enemies = newState.enemies.map((enemy) => {
      (enemy as Enemy).update(newState.player);
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

    // 8. Handle Collisions & Docking Check
    const collisionResult = handleCollisions(newState, now);
    newState = collisionResult.newState; // Apply pushback etc.

    // Add any new destruction animations from collisions
    newState.activeDestructionAnimations.push(...collisionResult.newAnimations);

    // Check if player was destroyed by collision logic
    if (collisionResult.playerDestroyed) {
      console.log("Logic: Player destroyed signal received.");
      return {
        ...collisionResult.newState,
        player: {
          ...collisionResult.newState.player, // Keep player data for animation pos
          shieldLevel: 0, // Ensure shield is visually 0
        },
        gameView: "destroyed",
        respawnTimer: C.RESPAWN_DELAY_MS,
        projectiles: [], // Clear projectiles immediately
        enemies: [], // Clear enemies immediately
        activeDestructionAnimations: newState.activeDestructionAnimations, // Keep animations from collision
      };
    }

    // Check if docking was triggered by collision logic
    if (collisionResult.dockingTriggerStationId) {
      console.log(
        `Logic: Docking collision detected for ${collisionResult.dockingTriggerStationId}`
      );
      newState.dockingStationId = collisionResult.dockingTriggerStationId;
      if (newState.player instanceof Player) {
        newState.player.vx = 0;
        newState.player.vy = 0;
      } else if (newState.player) {
        newState.player = new Player(newState.player.x, newState.player.y);
        newState.player.angle = currentState.player?.angle ?? -Math.PI / 2;
        newState.player.shieldLevel =
          currentState.player?.shieldLevel ?? C.DEFAULT_STARTING_SHIELD;
        newState.player.vx = 0;
        newState.player.vy = 0;
        console.warn(
          "Player object was not an instance during docking collision check. Recreated."
        );
      }
      return newState;
    }

    // Camera update might be needed again if collisions moved the player
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
