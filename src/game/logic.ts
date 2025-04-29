// src/game/logic.ts
import {
  IGameState,
  ITouchState,
  IPlayer,
  IStation,
  DestructionAnimationData,
  ParticleState, // Import ParticleState type
} from "./types";
import { Player } from "./entities/Player";
import { Enemy } from "./entities/Enemy";
import { Projectile } from "./entities/Projectile";
import { InfiniteWorldManager } from "./world/InfiniteWorldManager";
import { distance } from "../utils/geometry";
import * as C from "./config"; // Use C for brevity

// --- Constants for Hexagon Docking ---
const DOCKING_ENTRANCE_CENTER_ANGLE = Math.PI;
const DOCKING_ENTRANCE_HALF_SPAN = Math.PI / 12;
const DOCKING_MIN_RELATIVE_ANGLE =
  DOCKING_ENTRANCE_CENTER_ANGLE - DOCKING_ENTRANCE_HALF_SPAN;
const DOCKING_MAX_RELATIVE_ANGLE =
  DOCKING_ENTRANCE_CENTER_ANGLE + DOCKING_ENTRANCE_HALF_SPAN;

/**
 * Normalizes an angle to the range [-PI, PI].
 */
function normalizeAngle(angle: number): number {
  angle = angle % (2 * Math.PI);
  if (angle < 0) {
    angle += 2 * Math.PI;
  }
  if (angle > Math.PI) {
    angle -= 2 * Math.PI;
  }
  return angle;
}

/**
 * Creates a new player instance.
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
  return state;
}

function generateParticleStates(size: "small" | "large"): {
  particles: ParticleState[];
  duration: number;
} {
  const count =
    size === "large"
      ? C.LARGE_EXPLOSION_PARTICLE_COUNT
      : C.SMALL_EXPLOSION_PARTICLE_COUNT;
  const maxDist =
    size === "large"
      ? C.LARGE_EXPLOSION_MAX_DISTANCE
      : C.SMALL_EXPLOSION_MAX_DISTANCE;
  const baseDuration =
    size === "large" ? C.LARGE_EXPLOSION_DURATION : C.SMALL_EXPLOSION_DURATION;
  const length =
    size === "large"
      ? C.LARGE_EXPLOSION_PARTICLE_LENGTH
      : C.SMALL_EXPLOSION_PARTICLE_LENGTH;
  const thickness =
    size === "large"
      ? C.LARGE_EXPLOSION_PARTICLE_THICKNESS
      : C.SMALL_EXPLOSION_PARTICLE_THICKNESS;

  const particles: ParticleState[] = [];
  let maxTotalDuration = 0;

  for (let i = 0; i < count; i++) {
    const delay = Math.random() * (baseDuration * 0.2); // Delay up to 20% of base duration
    const animDuration = baseDuration * (0.7 + Math.random() * 0.3); // Randomize duration 70-100%
    const totalParticleTime = delay + animDuration;
    maxTotalDuration = Math.max(maxTotalDuration, totalParticleTime);

    particles.push({
      id: i,
      delay: delay,
      duration: animDuration,
      finalAngle: Math.random() * 360, // degrees
      finalDistance: maxDist * (0.5 + Math.random() * 0.5), // Randomize distance 50-100%
      initialRotation: Math.random() * 360, // degrees
      rotationSpeed: (Math.random() - 0.5) * 720, // degrees/sec, +/-
      length: length * (0.8 + Math.random() * 0.4), // Randomize length 80-120%
      thickness: thickness * (0.8 + Math.random() * 0.4), // Randomize thickness 80-120%
    });
  }

  return { particles: particles, duration: maxTotalDuration };
}
// *** End New Helper ***

/**
 * Handles collisions between different game entities.
 * Returns a new state object with updated entities and trigger info.
 */
function handleCollisions(
  state: IGameState,
  now: number
): {
  newState: IGameState;
  dockingTriggerStationId: string | null;
  playerDestroyed: boolean;
  newAnimations: DestructionAnimationData[];
} {
  const newProjectiles = [...state.projectiles];
  const newEnemies = [...state.enemies];
  const playerInstance = state.player;
  let dockingTriggerStationId: string | null = null;
  const newAnimations: DestructionAnimationData[] = []; // Initialize animation list

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
        // *** Generate enemy destruction animation data ***
        const { particles, duration } = generateParticleStates("small");
        newAnimations.push({
          id: `destroy-enemy-proj-${enemy.id}-${now}`,
          x: enemy.x,
          y: enemy.y,
          color: enemy.color,
          size: "small",
          startTime: now,
          particles: particles, // Add generated particles
          duration: duration, // Store calculated duration
        });
        newProjectiles.splice(i, 1);
        newEnemies.splice(j, 1);
        projHit = true;
        break;
      }
    }
    if (projHit) continue;

    // Vs Stations
    for (const bgObj of state.visibleBackgroundObjects) {
      if (bgObj.type === "station") {
        if (
          distance(proj.x, proj.y, bgObj.x, bgObj.y) <
          proj.radius + bgObj.radius
        ) {
          newProjectiles.splice(i, 1);
          projHit = true;
          break;
        }
      }
    }
  }

  // Player vs Enemy
  let playerDestroyed = false;

  if (playerInstance) {
    for (let i = newEnemies.length - 1; i >= 0; i--) {
      const enemy = newEnemies[i];
      if (
        distance(playerInstance.x, playerInstance.y, enemy.x, enemy.y) <
        playerInstance.radius + enemy.radius
      ) {
        // *** Generate enemy destruction animation data on collision with player ***
        const { particles, duration } = generateParticleStates("small");
        newAnimations.push({
          id: `destroy-enemy-player-${enemy.id}-${now}`,
          x: enemy.x,
          y: enemy.y,
          color: enemy.color,
          size: "small",
          startTime: now,
          particles: particles, // Add generated particles
          duration: duration, // Store calculated duration
        });

        newEnemies.splice(i, 1); // Remove enemy

        // Apply damage to player
        playerInstance.shieldLevel -= C.ENEMY_SHIELD_DAMAGE;
        playerInstance.shieldLevel = Math.max(0, playerInstance.shieldLevel);
        console.log(
          `Collision with enemy! Shield: ${playerInstance.shieldLevel}%`
        );

        if (playerInstance.shieldLevel <= 0) {
          playerDestroyed = true;
        }
      }
    }
  }

  // If player was destroyed
  if (playerDestroyed) {
    console.log("Player shield depleted! Ship destroyed.");
    // *** Generate PLAYER destruction animation data ***
    const { particles, duration } = generateParticleStates("large");
    newAnimations.push({
      id: `destroy-player-${playerInstance.id}-${now}`,
      x: playerInstance.x,
      y: playerInstance.y,
      color: playerInstance.color,
      size: "large",
      startTime: now,
      particles: particles, // Add generated particles
      duration: duration, // Store calculated duration
    });

    const stateBeforePlayerModification = {
      ...state,
      enemies: newEnemies,
      projectiles: newProjectiles,
      player: {
        ...playerInstance, // Keep player data for animation pos reference
        shieldLevel: 0, // Ensure shield is 0
      },
    };
    return {
      newState: stateBeforePlayerModification,
      dockingTriggerStationId: null,
      playerDestroyed: true,
      newAnimations: newAnimations,
    };
  }

  // Player vs Station (Check for Docking or Pushback)
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
              dockingTriggerStationId = station.id;
              player.vx = 0;
              player.vy = 0;
              break;
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

  return {
    newState: {
      ...state,
      player: playerInstance,
      enemies: newEnemies,
      projectiles: newProjectiles,
      // Active animations are handled in the main update loop
    },
    dockingTriggerStationId,
    playerDestroyed: false,
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
  newState.activeDestructionAnimations =
    newState.activeDestructionAnimations.filter(
      (anim) => now - anim.startTime < anim.duration + 100 // Use animation's own duration + buffer
    );

  // --- Handle Destroyed State ---
  if (newState.gameView === "destroyed") {
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
        const respawnDist = respawnStation.radius + C.PLAYER_SIZE / 2 + 20;
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
        cargoHold: new Map(),
        gameView: "playing",
        respawnTimer: 0,
        enemies: [],
        projectiles: [],
        activeDestructionAnimations: [], // Clear animations on respawn
      };
    }

    // Update camera based on the *static* player position from the destroyed state
    const deadPlayer = currentState.player;
    return {
      ...newState,
      respawnTimer: newState.respawnTimer,
      camera: {
        x: deadPlayer.x - C.GAME_WIDTH / 2,
        y: deadPlayer.y - C.GAME_VIEW_HEIGHT / 2,
      },
      // Keep active destruction animation running
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
        "Player state missing/invalid during update!",
        newState.player
      );
      // Attempt recovery or return current state
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
        console.error("Cannot recover player state. Bailing update.");
        return currentState;
      }
    }

    if (touchState?.shoot.active) newState = shootProjectile(newState);
    if (touchState) (newState.player as Player).update(touchState);

    newState.camera = {
      x: newState.player.x - C.GAME_WIDTH / 2,
      y: newState.player.y - C.GAME_VIEW_HEIGHT / 2,
    };

    newState.visibleBackgroundObjects = worldManager.getObjectsInView(
      newState.camera.x,
      newState.camera.y,
      C.GAME_WIDTH,
      C.GAME_VIEW_HEIGHT
    );

    newState.projectiles = newState.projectiles
      .map((p) => {
        (p as Projectile).update();
        return p;
      })
      .filter(
        (p) =>
          !(p as Projectile).isOutOfBounds(newState.player.x, newState.player.y)
      );

    newState.enemies = newState.enemies.map((enemy) => {
      (enemy as Enemy).update(newState.player);
      return enemy;
    });

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

    if (
      now - newState.lastEnemySpawnTime > C.ENEMY_SPAWN_INTERVAL &&
      newState.enemies.length < C.MAX_ENEMIES
    ) {
      newState = spawnEnemyNearPlayer(newState);
    }

    // Handle Collisions & Docking Check
    const collisionResult = handleCollisions(newState, now);
    newState = collisionResult.newState;

    // Add any new destruction animations from collisions
    newState.activeDestructionAnimations.push(...collisionResult.newAnimations);

    // Check if player was destroyed
    if (collisionResult.playerDestroyed) {
      console.log("Logic: Player destroyed signal received.");
      return {
        ...collisionResult.newState, // Includes player ref for anim position
        gameView: "destroyed",
        respawnTimer: C.RESPAWN_DELAY_MS,
        projectiles: [],
        enemies: [],
        activeDestructionAnimations: newState.activeDestructionAnimations, // Keep animations
      };
    }

    // Check if docking was triggered
    if (collisionResult.dockingTriggerStationId) {
      newState.dockingStationId = collisionResult.dockingTriggerStationId;
      if (newState.player instanceof Player) {
        newState.player.vx = 0;
        newState.player.vy = 0;
      } else if (newState.player) {
        // Ensure player object integrity if needed
        newState.player = new Player(newState.player.x, newState.player.y);
        newState.player.angle = currentState.player?.angle ?? -Math.PI / 2;
        newState.player.shieldLevel =
          currentState.player?.shieldLevel ?? C.DEFAULT_STARTING_SHIELD;
        newState.player.vx = 0;
        newState.player.vy = 0;
      }
      return newState; // Return state signaling docking initiation
    }

    // Update camera again if collisions moved player
    if (newState.player) {
      newState.camera = {
        x: newState.player.x - C.GAME_WIDTH / 2,
        y: newState.player.y - C.GAME_VIEW_HEIGHT / 2,
      };
    }
  }

  return newState;
}
