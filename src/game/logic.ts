// src/game/logic.ts
import {
  IGameState,
  ITouchState,
  IPosition,
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
import { PLAYER_SIZE } from "./config";
import { MarketGenerator, MarketSnapshot } from "./Market";
import { QuestEngine, GameEvent, V01_QUEST_DEFINITIONS } from "../quests";

const WORLD_SEED = 12345;

export type UpgradeKey =
  | "cargoPod"
  | "shieldCapacitor"
  | "engineBooster"
  | "autoloader"
  | "navComputer";

// Map beacon IDs to their corresponding quest objective IDs for direct update
const beaconToReachObjectiveMap: Record<string, string> = {
  beacon_nw_key1: "reach_beacon_nw",
  beacon_ne_key2: "reach_beacon_ne",
  beacon_sw_key3: "reach_beacon_sw", // Assuming this maps to sw
  beacon_se_key4: "reach_beacon_se", // Assuming this maps to se
};

export const questEngine = new QuestEngine(V01_QUEST_DEFINITIONS);

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
        return { newState: currentState, activatedBeaconId: null }; // Fix: Use currentState here
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

// --- Helper Functions for calculateNextGameState ---

/**
 * Calculates navigation target information based on the current state.
 */
function calculateNavigationInfo(
  currentGameState: IGameState,
  worldManager: InfiniteWorldManager
): {
  navTargetDirection: number | null;
  navTargetCoordinates: IPosition | null;
  navTargetDistance: number | null;
  needsNavClear: boolean; // Flag if target station wasn't found
} {
  let navTargetDirection: number | null = null;
  let navTargetCoordinates: IPosition | null = null;
  let navTargetDistance: number | null = null;
  let needsNavClear = false;

  if (currentGameState.navTargetStationId && currentGameState.player) {
    const targetStation = worldManager.getStationById(
      currentGameState.navTargetStationId
    );
    if (targetStation) {
      const dx = targetStation.x - currentGameState.player.x;
      const dy = targetStation.y - currentGameState.player.y;
      navTargetDirection = Math.atan2(dy, dx);
      navTargetCoordinates = { x: targetStation.x, y: targetStation.y };
      navTargetDistance = distance(
        currentGameState.player.x,
        currentGameState.player.y,
        targetStation.x,
        targetStation.y
      );
    } else {
      console.warn(
        `[calculateNavigationInfo] Nav target station ${currentGameState.navTargetStationId} not found. Flagging for clear.`
      );
      needsNavClear = true;
    }
  }

  return {
    navTargetDirection,
    navTargetCoordinates,
    navTargetDistance,
    needsNavClear,
  };
}

/**
 * Handles beacon activation side effects and directly updates quest state.
 */
export function handleBeaconActivationAndUpdateQuest(
  currentState: IGameState,
  activatedBeaconId: string | null,
  worldManager: InfiniteWorldManager
): { updatedState: IGameState; questStateModified: boolean } {
  if (!activatedBeaconId) {
    return { updatedState: currentState, questStateModified: false };
  }

  console.log(
    `[handleBeaconActivation] Beacon Activation Detected: ${activatedBeaconId}`
  );
  const beacon = worldManager.getBeaconById(activatedBeaconId);
  let questStateModified = false;
  let nextQuestState = currentState.questState; // Start with current quest state

  // Check if beacon exists and is NOT already active in the world state
  if (beacon && !beacon.isActive) {
    console.log(
      `[handleBeaconActivation] Beacon ${activatedBeaconId} is inactive, proceeding with direct quest update.`
    );
    worldManager.updateBeaconState(activatedBeaconId, true); // Update world state (visual)

    // --- Direct Quest State Modification ---
    const reachObjectiveId = beaconToReachObjectiveMap[activatedBeaconId];
    if (!reachObjectiveId) {
      console.warn(
        `[handleBeaconActivation] No matching reach objective found for beacon ID: ${activatedBeaconId}`
      );
    } else {
      // Perform a deep clone only if we intend to modify
      const clonedQuestState = structuredClone(currentState.questState);
      const freedomQuest = clonedQuestState.quests["freedom_v01"];

      if (freedomQuest) {
        let reachObjectiveMarkedDone = false;

        // 1. Update reach_beacon_* objective
        const reachObjective = freedomQuest[reachObjectiveId];
        if (reachObjective && !reachObjective.done) {
          reachObjective.done = true;
          reachObjectiveMarkedDone = true; // Flag that this objective was newly completed
          questStateModified = true;
          console.log(
            `[handleBeaconActivation] Marked objective ${reachObjectiveId} as done.`
          );
        } else if (!reachObjective) {
          console.warn(
            `[handleBeaconActivation] Objective ${reachObjectiveId} not found in quest state.`
          );
        } else if (reachObjective.done) {
          console.log(
            `[handleBeaconActivation] Objective ${reachObjectiveId} was already done.`
          );
        }

        // 2. Update beaconKeys objective count *only if* the reach objective was newly completed
        const keysObjective = freedomQuest["beaconKeys"];
        if (keysObjective && reachObjectiveMarkedDone) {
          const currentCount = (keysObjective.current as number) || 0;
          const newCount = currentCount + 1;
          keysObjective.current = newCount;
          questStateModified = true; // Mark modified even if only count changed

          // Check if count now meets the target (e.g., 4) and mark done
          const targetKeys = 4; // Defined by quest objective
          if (newCount >= targetKeys && !keysObjective.done) {
            keysObjective.done = true;
            console.log(
              `[handleBeaconActivation] Marked objective beaconKeys as done (reached ${newCount}).`
            );
          } else {
            console.log(
              `[handleBeaconActivation] Incremented beaconKeys count to ${newCount}.`
            );
          }
        } else if (!keysObjective) {
          console.warn(
            `[handleBeaconActivation] Objective beaconKeys not found in quest state.`
          );
        } else if (keysObjective && !reachObjectiveMarkedDone) {
          console.log(
            `[handleBeaconActivation] BeaconKeys objective not incremented as reach objective ${reachObjectiveId} was not newly completed.`
          );
        }

        // If the quest state was modified, update the state we plan to return
        if (questStateModified) {
          nextQuestState = clonedQuestState; // Use the modified clone
        } else {
          console.log(
            `[handleBeaconActivation] Beacon ${activatedBeaconId} processed, but no quest objectives needed updating (already done?).`
          );
        }
      } else {
        console.warn(
          `[handleBeaconActivation] freedom_v01 quest progress not found.`
        );
      }
    }
    // --- End Direct Quest State Modification ---
  } else if (beacon && beacon.isActive) {
    console.log(
      `[handleBeaconActivation] Beacon ${activatedBeaconId} already active. Skipping direct quest update.`
    );
  } else if (!beacon) {
    console.log(
      `[handleBeaconActivation] Beacon ${activatedBeaconId} not found. Skipping direct quest update.`
    );
  }

  // Return the potentially updated state
  return {
    updatedState: { ...currentState, questState: nextQuestState },
    questStateModified,
  };
}

/**
 * Handles transitions between different game views (docking, undocking, etc.).
 */
function handleGameViewTransitions(
  previousGameState: IGameState, // State *before* logic update
  nextLogicState: IGameState, // State *after* logic update but *before* transitions
  worldManager: InfiniteWorldManager,
  emitQuestEvent: (event: GameEvent) => void
): { updatedState: IGameState; transitionOccurred: boolean } {
  const currentView = previousGameState.gameView;
  const nextView = nextLogicState.gameView; // View determined by core logic
  let stateToReturn = { ...nextLogicState }; // Start with the state from logic
  let transitionOccurred = false;

  // Docking Initiation
  if (
    currentView === "playing" &&
    !previousGameState.dockingStationId && // Check previous state for docking ID
    nextLogicState.dockingStationId && // Check next state for trigger
    nextView === "playing" // Ensure logic didn't already change view (e.g., to destroyed)
  ) {
    console.log("[handleGameViewTransitions] Detected docking initiation.");
    transitionOccurred = true;
    let updatedPlayer = stateToReturn.player;
    if (updatedPlayer instanceof Player) {
      updatedPlayer.vx = 0;
      updatedPlayer.vy = 0;
    } else if (updatedPlayer) {
      // Recreate if not an instance
      const shieldLevel = previousGameState.shieldCapacitorLevel;
      updatedPlayer = createPlayer(
        updatedPlayer.x,
        updatedPlayer.y,
        shieldLevel
      );
      updatedPlayer.angle = previousGameState.player?.angle ?? -Math.PI / 2;
      updatedPlayer.vx = 0;
      updatedPlayer.vy = 0;
      console.warn(
        "[handleGameViewTransitions] Player object not instance during docking initiation. Recreated."
      );
    }
    stateToReturn = {
      ...stateToReturn,
      player: updatedPlayer,
      gameView: "docking",
      animationState: {
        type: "docking",
        progress: 0,
        duration: previousGameState.animationState.duration, // Use duration from previous state
      },
      market: null,
    };
  }
  // Docking Completion
  else if (
    currentView === "docking" &&
    previousGameState.animationState.type === "docking" &&
    nextLogicState.animationState.type === null // Logic cleared animation state
  ) {
    console.log("[handleGameViewTransitions] Detected docking completion.");
    transitionOccurred = true;
    const stationId = previousGameState.dockingStationId; // Use ID from before logic
    const station = stationId ? worldManager.getStationById(stationId) : null;
    let newMarket: MarketSnapshot | null = null;
    const updatedDiscoveredStations = [
      ...previousGameState.discoveredStations,
    ];

    if (stationId && !updatedDiscoveredStations.includes(stationId)) {
      updatedDiscoveredStations.push(stationId);
    }

    if (station) {
      newMarket = MarketGenerator.generate(station, WORLD_SEED, Date.now());
    }

    const newKnownPrices = { ...previousGameState.knownStationPrices };
    if (stationId && newMarket) {
      const currentKnown = newKnownPrices[stationId] ?? {};
      Object.entries(newMarket.table).forEach(([key, state]) => {
        if (currentKnown[key] === undefined) {
          currentKnown[key] = state.price;
        }
      });
      newKnownPrices[stationId] = currentKnown;
    }

    if (stationId) {
      setTimeout(() => emitQuestEvent({ type: "DOCK_FINISH", stationId }), 0);
    }

    stateToReturn = {
      ...stateToReturn,
      gameView: "trade_select",
      market: newMarket,
      lastDockedStationId: stationId,
      discoveredStations: updatedDiscoveredStations,
      knownStationPrices: newKnownPrices,
      animationState: {
        ...stateToReturn.animationState, // Keep potentially updated progress/duration if needed
        type: null, // Ensure type is null
        progress: 0, // Reset progress
      },
      // dockingStationId remains set from logic/previous state
    };
  }
  // Undocking Completion
  else if (
    currentView === "undocking" &&
    previousGameState.animationState.type === "undocking" &&
    nextLogicState.animationState.type === null // Logic cleared animation state
  ) {
    console.log("[handleGameViewTransitions] Detected undocking completion.");
    transitionOccurred = true;
    let playerX = stateToReturn.player?.x ?? 0;
    let playerY = stateToReturn.player?.y ?? 0;
    let playerAngle = stateToReturn.player?.angle ?? -Math.PI / 2;

    const stationId = previousGameState.lastDockedStationId; // Use last docked
    const station = stationId ? worldManager.getStationById(stationId) : null;

    if (station) {
      const undockDist =
        station.radius +
        (previousGameState.player?.radius ?? PLAYER_SIZE / 2) +
        20;
      const exitAngle = station.angle + Math.PI;
      playerX = station.x + Math.cos(exitAngle) * undockDist;
      playerY = station.y + Math.sin(exitAngle) * undockDist;
      playerAngle = exitAngle;
    }

    let updatedPlayer = stateToReturn.player;
    if (!(updatedPlayer instanceof Player) && updatedPlayer) {
      const shieldLevel = previousGameState.shieldCapacitorLevel;
      updatedPlayer = createPlayer(playerX, playerY, shieldLevel);
    } else if (!updatedPlayer) {
      const shieldLevel = previousGameState.shieldCapacitorLevel;
      updatedPlayer = createPlayer(playerX, playerY, shieldLevel);
    }

    // Ensure position, velocity, and angle are set correctly
    updatedPlayer.x = playerX;
    updatedPlayer.y = playerY;
    updatedPlayer.vx = 0;
    updatedPlayer.vy = 0;
    updatedPlayer.angle = playerAngle;
    updatedPlayer.shieldLevel = updatedPlayer.maxShield; // Top up shield

    stateToReturn = {
      ...stateToReturn,
      player: updatedPlayer,
      gameView: "playing",
      dockingStationId: null,
      market: null,
      animationState: {
        ...stateToReturn.animationState,
        type: null,
        progress: 0,
      },
    };
  }
  // Player Destruction (Transition initiated by logic)
  else if (currentView === "playing" && nextView === "destroyed") {
    console.log(
      "[handleGameViewTransitions] Detected destruction transition from logic."
    );
    transitionOccurred = true;
    // Logic already set gameView to 'destroyed' and respawn timer.
    // Clear projectiles/enemies for immediate effect.
    stateToReturn = { ...stateToReturn, projectiles: [], enemies: [] };
  }
  // Player Respawn (Transition initiated by logic)
  else if (currentView === "destroyed" && nextView === "playing") {
    console.log(
      "[handleGameViewTransitions] Detected respawn completion from logic."
    );
    transitionOccurred = true;
    // Logic handled placing the player and setting the view back to 'playing'.
    // stateToReturn already has the correct state from updateGameStateLogic.
    // No further changes needed here for this transition.
  }

  return { updatedState: stateToReturn, transitionOccurred };
}

/**
 * Checks the win condition and updates the game state if met.
 */
function checkAndApplyWinCondition(currentState: IGameState): {
  updatedState: IGameState;
  winConditionMet: boolean;
} {
  // Check win condition based on the current quest state
  const finalScore = questEngine.calculateQuestCompletion(
    "freedom_v01",
    currentState.questState
  );

  if (finalScore >= 100 && currentState.gameView !== "won") {
    console.log(
      "[checkAndApplyWinCondition] WIN CONDITION MET! Emancipation Score >= 100%"
    );
    let finalPlayer = currentState.player;
    if (finalPlayer instanceof Player) {
      finalPlayer.vx = 0;
      finalPlayer.vy = 0;
    } else if (finalPlayer) {
      finalPlayer = { ...finalPlayer, vx: 0, vy: 0 };
    }
    return {
      updatedState: { ...currentState, player: finalPlayer, gameView: "won" },
      winConditionMet: true,
    };
  }

  return { updatedState: currentState, winConditionMet: false };
}

/**
 * Calculates the next game state based on the current state, time delta,
 * input, world state, and events.
 * This function encapsulates the core game update logic previously inside
 * the setGameStateInternal callback within updateGame.
 */
export const calculateNextGameState = (
  currentGameState: IGameState,
  deltaTime: number,
  now: number,
  currentTouchState: ITouchState | undefined,
  worldManager: InfiniteWorldManager,
  emitQuestEvent: (event: GameEvent) => void // Pass emitQuestEvent as a dependency
): IGameState => {
  if (!currentGameState.isInitialized || currentGameState.gameView === "won") {
    return currentGameState;
  }

  // --- 1. Calculate Nav Target Info ---
  const {
    navTargetDirection,
    navTargetCoordinates,
    navTargetDistance,
    needsNavClear,
  } = calculateNavigationInfo(currentGameState, worldManager);

  // Handle case where nav target station disappeared
  if (needsNavClear) {
    console.warn(
      `[calculateNextGameState] Clearing navigation target due to missing station.`
    );
    return {
      ...currentGameState,
      navTargetStationId: null,
      navTargetDirection: null,
      navTargetCoordinates: null,
      navTargetDistance: null,
    };
  }

  // Prepare state for core logic update
  const stateForLogic = {
    ...currentGameState,
    navTargetDirection,
    navTargetCoordinates,
    navTargetDistance,
  };

  // --- 2. Run Core Game Logic (Physics, Collisions, Basic Updates) ---
  const {
    newState: stateAfterLogic, // State after physics, collisions, etc.
    activatedBeaconId, // Beacon ID detected by logic (if any)
  } = updateGameStateLogic(
    stateForLogic,
    currentTouchState,
    worldManager,
    deltaTime,
    now
  );

  // --- 3. Handle Beacon Activation Side Effects & Quest Updates ---
  const { updatedState: stateAfterBeaconHandling } =
    handleBeaconActivationAndUpdateQuest(
      stateAfterLogic,
      activatedBeaconId,
      worldManager
    );

  // --- 4. Handle Game View State Transitions ---
  // Pass the state *before* logic (currentGameState) and the state *after* beacon handling
  const { updatedState: stateAfterTransitions, transitionOccurred } =
    handleGameViewTransitions(
      currentGameState, // State *before* this frame's logic
      stateAfterBeaconHandling, // State *after* logic and beacon handling
      worldManager,
      emitQuestEvent
    );

  // If a major transition occurred (docking, undocking, destruction, respawn),
  // skip the win condition check for this frame to avoid potential conflicts.
  if (transitionOccurred) {
    return stateAfterTransitions;
  }

  // --- 5. Check Win Condition ---
  // Check based on the state after transitions (which might be the same as after beacon handling if no transition occurred)
  const { updatedState: finalState, winConditionMet } =
    checkAndApplyWinCondition(stateAfterTransitions);

  // If the win condition was met, return the "won" state immediately.
  if (winConditionMet) {
    return finalState;
  }

  // --- 6. Return Final State ---
  // If no major transition or win occurred, return the state after all updates.
  return finalState;
};
