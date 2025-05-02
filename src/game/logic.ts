// src/game/logic.ts
import {
  IGameState,
  ITouchState,
  IPlayer,
  IStation,
  DestructionAnimationData,
  ParticleState,
  IAsteroid,
  IBeacon,
  IGameObject,
} from "./types";
import { Player } from "./entities/Player";
import { Enemy } from "./entities/Enemy";
import { Projectile } from "./entities/Projectile";
import { InfiniteWorldManager } from "./world/InfiniteWorldManager";
import { distance } from "../utils/geometry";
import * as C from "./config"; // Use C for brevity

// --- Constants for Hexagon Docking ---
const DOCKING_MIN_RELATIVE_ANGLE = -Math.PI + Math.PI / 6;
const DOCKING_MAX_RELATIVE_ANGLE = Math.PI - Math.PI / 6;

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
 * Creates a new player instance, considering shield upgrades.
 */
export function createPlayer(
  x: number,
  y: number,
  shieldCapacitorLevel: number = 0
): IPlayer {
  const player = new Player(x, y);
  // Calculate max shield based on upgrade level
  const baseShield = C.DEFAULT_STARTING_SHIELD;
  player.maxShield = baseShield * (1 + shieldCapacitorLevel * 0.25);
  player.shieldLevel = player.maxShield; // Start with full shields
  console.log(`Created player with Max Shield: ${player.maxShield}`);
  return player;
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
 * Creates a new projectile if cooldown allows, considering autoloader.
 */
function shootProjectile(state: IGameState): IGameState {
  const now = performance.now();
  const effectiveCooldown = C.SHOOT_COOLDOWN * state.shootCooldownFactor; // Apply factor
  if (now - state.lastShotTime > effectiveCooldown) {
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
  activatedBeaconId: string | null; // Added
  playerDestroyed: boolean;
  newAnimations: DestructionAnimationData[];
} {
  const newProjectiles = [...state.projectiles];
  const newEnemies = [...state.enemies];
  // Ensure playerInstance is correctly typed or handled if potentially null/undefined
  const playerInstance: Player =
    state.player instanceof Player ? state.player : new Player(0, 0);
  let dockingTriggerStationId: string | null = null;
  let activatedBeaconId: string | null = null; // Initialize
  const newAnimations: DestructionAnimationData[] = [];

  // --- Projectile Collisions ---
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
        // ... create animation, remove enemy/projectile ...
        const { particles, duration } = generateParticleStates("small");
        newAnimations.push({
          id: `destroy-enemy-proj-${enemy.id}-${now}`,
          x: enemy.x,
          y: enemy.y,
          color: enemy.color,
          size: "small",
          startTime: now,
          particles,
          duration,
        });
        newProjectiles.splice(i, 1);
        newEnemies.splice(j, 1);
        projHit = true;
        break;
      }
    }
    if (projHit) continue; // Move to next projectile if this one hit an enemy

    // Vs Background Objects (Station, Asteroid, Beacon)
    for (const bgObj of state.visibleBackgroundObjects) {
      // Check only relevant types
      if (
        bgObj.type === "station" ||
        bgObj.type === "asteroid" ||
        bgObj.type === "beacon"
      ) {
        // Use radius for collision check
        if (
          distance(proj.x, proj.y, bgObj.x, bgObj.y) <
          proj.radius + (bgObj as IGameObject).radius
        ) {
          newProjectiles.splice(i, 1); // Remove projectile
          projHit = true;
          // Optional: Add small impact animation?
          break; // Projectile hit something, stop checking this projectile
        }
      }
    }
    // No need to continue outer loop if projHit is true here, already handled by 'continue' inside enemy loop
  }

  // --- Enemy vs Asteroid ---
  for (let i = newEnemies.length - 1; i >= 0; i--) {
    const enemy = newEnemies[i];
    let enemyHitAsteroid = false;
    for (const bgObj of state.visibleBackgroundObjects) {
      if (bgObj.type === "asteroid") {
        const asteroid = bgObj as IAsteroid;
        if (
          distance(enemy.x, enemy.y, asteroid.x, asteroid.y) <
          enemy.radius + asteroid.radius
        ) {
          // ... create animation, remove enemy ...
          const { particles, duration } = generateParticleStates("small");
          newAnimations.push({
            id: `destroy-enemy-asteroid-${enemy.id}-${now}`,
            x: enemy.x,
            y: enemy.y,
            color: enemy.color,
            size: "small",
            startTime: now,
            particles,
            duration,
          });
          newEnemies.splice(i, 1);
          enemyHitAsteroid = true;
          break; // Enemy destroyed, stop checking this enemy
        }
      }
    }
    if (enemyHitAsteroid) continue; // Move to next enemy
  }

  // --- Player Collisions ---
  let playerDestroyed = false;
  if (playerInstance) {
    // Only proceed if player exists and is a Player instance
    // Vs Enemies
    for (let i = newEnemies.length - 1; i >= 0; i--) {
      const enemy = newEnemies[i];
      if (
        distance(playerInstance.x, playerInstance.y, enemy.x, enemy.y) <
        playerInstance.radius + enemy.radius
      ) {
        // ... create animation, remove enemy, damage player shield ...
        const { particles, duration } = generateParticleStates("small");
        newAnimations.push({
          id: `destroy-enemy-player-${enemy.id}-${now}`,
          x: enemy.x,
          y: enemy.y,
          color: enemy.color,
          size: "small",
          startTime: now,
          particles,
          duration,
        });
        newEnemies.splice(i, 1);
        playerInstance.shieldLevel -= C.ENEMY_SHIELD_DAMAGE;
        playerInstance.shieldLevel = Math.max(0, playerInstance.shieldLevel);
        if (playerInstance.shieldLevel <= 0) {
          playerDestroyed = true;
          // Don't break here, player might hit multiple enemies in one frame before destruction check
        }
      }
    }

    // Vs Asteroids (Check destruction first)
    if (!playerDestroyed) {
      // Only check asteroid collision if not already destroyed by enemy
      for (const bgObj of state.visibleBackgroundObjects) {
        if (bgObj.type === "asteroid") {
          const asteroid = bgObj as IAsteroid;
          if (
            distance(
              playerInstance.x,
              playerInstance.y,
              asteroid.x,
              asteroid.y
            ) <
            playerInstance.radius + asteroid.radius
          ) {
            playerDestroyed = true;
            break; // Player destroyed, stop checking asteroids
          }
        }
      }
    }

    // If player was destroyed by enemy or asteroid
    if (playerDestroyed) {
      playerInstance.shieldLevel = 0; // Ensure shield is zero
      const { particles, duration } = generateParticleStates("large");
      newAnimations.push({
        id: `destroy-player-${playerInstance.id}-${now}`,
        x: playerInstance.x,
        y: playerInstance.y,
        color: playerInstance.color,
        size: "large",
        startTime: now,
        particles,
        duration,
      });
      // Return state *before* player object is potentially nulled, but with shield 0
      const stateBeforePlayerModification = {
        ...state,
        enemies: newEnemies,
        projectiles: newProjectiles,
        player: { ...playerInstance, shieldLevel: 0 },
      };
      console.log("Player shield depleted! Ship destroyed.");
      return {
        newState: stateBeforePlayerModification,
        dockingTriggerStationId: null,
        activatedBeaconId: null,
        playerDestroyed: true,
        newAnimations,
      };
    }

    // Vs Interactables (Station, Beacon, Asteroid for pushback) - Only if not destroyed
    for (const bgObj of state.visibleBackgroundObjects) {
      if (bgObj.type === "station") {
        const station = bgObj as IStation;
        const player = playerInstance;
        const distToCenter = distance(player.x, player.y, station.x, station.y);
        const interactionDistanceThreshold =
          player.radius + station.radius + 10; // Slightly larger for interaction check
        const pushbackThreshold = player.radius + station.radius; // Exact overlap for pushback

        if (distToCenter < interactionDistanceThreshold) {
          // Check docking conditions
          const dx = station.x - player.x;
          const dy = station.y - player.y;
          const worldAngle = Math.atan2(dy, dx);
          const relativeAngle = normalizeAngle(worldAngle - station.angle); // Angle relative to station's orientation
          const isAngleCorrect =
            relativeAngle <= DOCKING_MIN_RELATIVE_ANGLE ||
            relativeAngle >= DOCKING_MAX_RELATIVE_ANGLE;

          const stationEntranceDepth = 10;
          // Trigger docking if angle is correct, close enough, and speed is low
          if (
            isAngleCorrect &&
            distToCenter < player.radius + station.radius - stationEntranceDepth
          ) {
            dockingTriggerStationId = station.id;
            player.vx = 0;
            player.vy = 0; // Stop player
            break; // Docking triggered, stop checking other objects for player
          }

          const distToCenterPushBackAccountingEntrance = isAngleCorrect
            ? -stationEntranceDepth
            : 0;

          // Apply pushback if overlapping and not docking
          if (
            !dockingTriggerStationId &&
            distToCenter <
              pushbackThreshold + distToCenterPushBackAccountingEntrance
          ) {
            const pushAngle = Math.atan2(
              player.y - station.y,
              player.x - station.x
            );
            const overlap = pushbackThreshold - distToCenter;
            player.x += Math.cos(pushAngle) * (overlap + 0.5); // Push slightly beyond overlap
            player.y += Math.sin(pushAngle) * (overlap + 0.5);
            player.vx = 0;
            player.vy = 0; // Stop player momentum on collision
          }
        }
      } else if (bgObj.type === "beacon") {
        const beacon = bgObj as IBeacon;
        const player = playerInstance;
        const distToBeacon = distance(player.x, player.y, beacon.x, beacon.y);
        const activationThreshold = player.radius + beacon.radius + 5; // Generous activation range

        // Check isActive state directly from the beacon object in visibleBackgroundObjects
        if (!beacon.isActive && distToBeacon < activationThreshold) {
          activatedBeaconId = beacon.id; // Signal activation
          console.log(`Player activating beacon ${beacon.id}`);
          player.vx = 0;
          player.vy = 0; // Stop player
          // Don't break here? Allow potential pushback from other objects? Let's break for now.
          break; // Only activate one per frame
        }
      } else if (bgObj.type === "asteroid") {
        // Apply pushback from asteroids
        const asteroid = bgObj as IAsteroid;
        const player = playerInstance;
        const distToCenter = distance(
          player.x,
          player.y,
          asteroid.x,
          asteroid.y
        );
        const pushbackThreshold = player.radius + asteroid.radius;
        if (distToCenter < pushbackThreshold) {
          const pushAngle = Math.atan2(
            player.y - asteroid.y,
            player.x - asteroid.x
          );
          const overlap = pushbackThreshold - distToCenter;
          player.x += Math.cos(pushAngle) * (overlap + 0.5);
          player.y += Math.sin(pushAngle) * (overlap + 0.5);
          // Don't zero velocity here, allow bouncing off asteroids? Or stop? Let's stop for consistency.
          // player.vx = 0; player.vy = 0;
        }
      }
    } // End loop through bg objects for player interaction
  } // End player interaction check

  // Return updated state and interaction results
  return {
    newState: {
      ...state,
      player: playerInstance,
      enemies: newEnemies,
      projectiles: newProjectiles,
    },
    dockingTriggerStationId,
    activatedBeaconId, // Return ID if activated
    playerDestroyed: false, // Already handled destruction case above
    newAnimations: newAnimations,
  };
}

// Updated updateGameStateLogic return type to include activatedBeaconId
export function updateGameStateLogic(
  currentState: IGameState,
  touchState: ITouchState | undefined,
  worldManager: InfiniteWorldManager,
  deltaTime: number,
  now: number
): { newState: IGameState; activatedBeaconId: string | null } {
  // Added beacon ID
  let newState = { ...currentState };
  let activatedBeaconId: string | null = null; // Track activated beacon

  // --- Update and Filter Active Destruction Animations ---
  newState.activeDestructionAnimations =
    newState.activeDestructionAnimations.filter(
      (anim) => now - anim.startTime < anim.duration + 100 // Keep slightly longer than duration
    );

  // --- Handle Destroyed State ---
  if (newState.gameView === "destroyed") {
    newState.respawnTimer -= deltaTime;
    if (newState.respawnTimer <= 0) {
      // Respawn logic
      const respawnStationId =
        newState.lastDockedStationId ?? "station_0_0_fixC"; // Default to origin fixed station
      const respawnStation = worldManager.getStationById(respawnStationId);
      let respawnX = 50;
      let respawnY = 50; // Default near origin if station not found
      if (respawnStation) {
        const exitAngle = respawnStation.angle + Math.PI; // Exit opposite docking bay
        const respawnDist = respawnStation.radius + C.PLAYER_SIZE / 2 + 20; // Spawn outside station radius
        respawnX = respawnStation.x + Math.cos(exitAngle) * respawnDist;
        respawnY = respawnStation.y + Math.sin(exitAngle) * respawnDist;
      } else {
        console.warn(
          `Respawn station ${respawnStationId} not found. Spawning near origin.`
        );
      }
      const respawnedPlayer = createPlayer(
        respawnX,
        respawnY,
        newState.shieldCapacitorLevel
      );
      // Reset relevant parts of state for respawn
      newState = {
        ...newState,
        player: respawnedPlayer,
        cargoHold: {}, // Initialize as an empty Record
        gameView: "playing", // Back to playing
        respawnTimer: 0,
        enemies: [], // Clear enemies
        projectiles: [], // Clear projectiles
        activeDestructionAnimations: [], // Clear animations
      };
    } else {
      // Keep camera centered on destruction point while timer counts down
      const deadPlayer = currentState.player; // Use player state from *before* destruction
      if (deadPlayer) {
        newState.camera = {
          x: deadPlayer.x - C.GAME_WIDTH / 2,
          y: deadPlayer.y - C.GAME_VIEW_HEIGHT / 2,
        };
      }
    }
    // Return current state during respawn countdown or after respawn setup
    return { newState, activatedBeaconId: null };
  }

  // --- Handle Docking/Undocking Animations ---
  if (newState.gameView === "docking" || newState.gameView === "undocking") {
    if (newState.animationState.type) {
      newState.animationState = {
        ...newState.animationState,
        progress: newState.animationState.progress + deltaTime,
      };
      // Check if animation finished
      if (
        newState.animationState.progress >= newState.animationState.duration
      ) {
        newState.animationState = {
          ...newState.animationState,
          type: null,
          progress: 0,
        }; // Mark animation as finished
      }
    }
    // Return state during animation (state transitions happen in the hook based on animationState.type becoming null)
    return { newState, activatedBeaconId: null };
  }

  // --- Handle Gameplay (Only when 'playing') ---
  if (newState.gameView === "playing") {
    // Ensure player exists and is a Player instance
    if (!newState.player || !(newState.player instanceof Player)) {
      console.error(
        "Player state missing/invalid during update!",
        newState.player
      );
      // Attempt recovery if possible, otherwise bail
      if (currentState.player?.x !== undefined) {
        newState.player = createPlayer(
          currentState.player.x,
          currentState.player.y,
          currentState.shieldCapacitorLevel
        );
      } else {
        // Cannot recover, maybe transition to an error state or main menu?
        // For now, just return the current (bad) state.
        console.error("Cannot recover player state!");
        return { newState: currentState, activatedBeaconId: null };
      }
    }

    // Shoot, Update Player (including movement)
    if (touchState?.shoot.active) newState = shootProjectile(newState);
    // Ensure player is treated as Player instance for update method
    if (touchState && newState.player instanceof Player) {
      newState.player.update(touchState, newState.engineBoosterLevel);
    }

    // Update Camera based on player position
    newState.camera = {
      x: newState.player.x - C.GAME_WIDTH / 2,
      y: newState.player.y - C.GAME_VIEW_HEIGHT / 2,
    };

    // Get visible objects (including beacons) from WorldManager
    newState.visibleBackgroundObjects = worldManager.getObjectsInView(
      newState.camera.x,
      newState.camera.y,
      C.GAME_WIDTH,
      C.GAME_VIEW_HEIGHT
    );

    // Update Projectiles & filter out-of-bounds
    newState.projectiles = newState.projectiles
      .map((p) => {
        // Ensure p is Projectile instance before calling update
        if (p instanceof Projectile) p.update();
        return p;
      })
      .filter(
        (p) =>
          p instanceof Projectile &&
          !p.isOutOfBounds(newState.player.x, newState.player.y)
      );

    // Update Enemies
    newState.enemies = newState.enemies.map((enemy) => {
      // Ensure enemy is Enemy instance and player exists
      if (enemy instanceof Enemy && newState.player)
        enemy.update(newState.player);
      return enemy;
    });

    // Despawn far enemies
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

    // --- Enemy Spawning Check ---
    // Check if player is near any visible station *before* spawning
    const isPlayerNearStation = newState.visibleBackgroundObjects.some(
      (obj) => {
        // Check only stations and ensure player exists
        if (obj.type === "station" && newState.player) {
          const dist = distance(
            newState.player.x,
            newState.player.y,
            obj.x,
            obj.y
          );
          // Check distance against the threshold defined in config
          return dist < C.ENEMY_SPAWN_NEAR_STATION_THRESHOLD;
        }
        return false; // Not a station or player missing
      }
    );

    // Spawn new enemies ONLY IF NOT near a station
    if (
      !isPlayerNearStation &&
      now - newState.lastEnemySpawnTime > C.ENEMY_SPAWN_INTERVAL &&
      newState.enemies.length < C.MAX_ENEMIES
    ) {
      newState = spawnEnemyNearPlayer(newState);
    }

    // Handle Collisions, Docking Check, Beacon Activation
    const collisionResult = handleCollisions(newState, now);
    newState = collisionResult.newState; // Update state based on collision results
    activatedBeaconId = collisionResult.activatedBeaconId; // Capture activated beacon ID

    // Add any new destruction animations from collisions
    newState.activeDestructionAnimations.push(...collisionResult.newAnimations);

    // Check if player was destroyed during collisions
    if (collisionResult.playerDestroyed) {
      console.log("Logic: Player destroyed signal received.");
      // Transition to destroyed state
      return {
        newState: {
          ...collisionResult.newState, // Use state returned by handleCollisions (with shield 0)
          gameView: "destroyed",
          respawnTimer: C.RESPAWN_DELAY_MS, // Set respawn timer
          projectiles: [], // Clear projectiles
          enemies: [], // Clear enemies
          // Keep animations generated during destruction
          activeDestructionAnimations: newState.activeDestructionAnimations,
        },
        activatedBeaconId: null, // No beacon activation if destroyed
      };
    }

    // Check if docking was triggered
    if (collisionResult.dockingTriggerStationId) {
      newState.dockingStationId = collisionResult.dockingTriggerStationId;
      // The state transition to 'docking' view happens in the useGameState hook based on dockingStationId being set
    }

    // Update camera again if collisions moved player
    if (newState.player) {
      newState.camera = {
        x: newState.player.x - C.GAME_WIDTH / 2,
        y: newState.player.y - C.GAME_VIEW_HEIGHT / 2,
      };
    }
  } // End 'playing' state logic

  // Calculate distance to Nav Target (if applicable)
  if (newState.navTargetCoordinates && newState.player) {
    newState.navTargetDistance = distance(
      newState.player.x,
      newState.player.y,
      newState.navTargetCoordinates.x,
      newState.navTargetCoordinates.y
    );
  } else {
    newState.navTargetDistance = null;
  }

  // Return the final state and activated beacon ID (if any)
  return { newState, activatedBeaconId };
}
