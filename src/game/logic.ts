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
import * as C from "./config";
import { PLAYER_SIZE } from "./config";
import { MarketGenerator, MarketSnapshot, COMMODITIES } from "./Market";
import { QuestEngine, GameEvent, V01_QUEST_DEFINITIONS } from "../quests";
import { getDynamicMaxEnemies } from "../utils/enemies";

const WORLD_SEED = 12345;

export type UpgradeKey =
  | "cargoPod"
  | "shieldCapacitor"
  | "engineBooster"
  | "autoloader"
  | "navComputer";

// Removed beaconToReachObjectiveMap
// const beaconToReachObjectiveMap: Record<string, string> = { ... };

export const questEngine = new QuestEngine(V01_QUEST_DEFINITIONS);

const DOCKING_MIN_RELATIVE_ANGLE = -Math.PI + Math.PI / 6;
const DOCKING_MAX_RELATIVE_ANGLE = Math.PI - Math.PI / 6;

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

export function createPlayer(
  x: number,
  y: number,
  shieldCapacitorLevel: number = 0
): IPlayer {
  const player = new Player(x, y);
  const baseShield = C.DEFAULT_STARTING_SHIELD;
  player.maxShield = baseShield * (1 + shieldCapacitorLevel * 0.25);
  player.shieldLevel = player.maxShield;
  console.log(`Created player with Max Shield: ${player.maxShield}`);
  return player;
}

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

function shootProjectile(state: IGameState): IGameState {
  const now = performance.now();
  const effectiveCooldown = C.SHOOT_COOLDOWN * state.shootCooldownFactor;
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
    const delay = Math.random() * (baseDuration * 0.2);
    const animDuration = baseDuration * (0.7 + Math.random() * 0.3);
    const totalParticleTime = delay + animDuration;
    maxTotalDuration = Math.max(maxTotalDuration, totalParticleTime);

    particles.push({
      id: i,
      delay: delay,
      duration: animDuration,
      finalAngle: Math.random() * 360,
      finalDistance: maxDist * (0.5 + Math.random() * 0.5),
      initialRotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 720,
      length: length * (0.8 + Math.random() * 0.4),
      thickness: thickness * (0.8 + Math.random() * 0.4),
    });
  }
  return { particles: particles, duration: maxTotalDuration };
}

function handleCollisions(
  state: IGameState,
  now: number
): {
  newState: IGameState;
  dockingTriggerStationId: string | null;
  activatedBeaconId: string | null;
  playerDestroyed: boolean;
  newAnimations: DestructionAnimationData[];
} {
  const newProjectiles = [...state.projectiles];
  const newEnemies = [...state.enemies];
  const playerInstance: Player =
    state.player instanceof Player ? state.player : new Player(0, 0);
  let dockingTriggerStationId: string | null = null;
  let activatedBeaconId: string | null = null;
  const newAnimations: DestructionAnimationData[] = [];

  for (let i = newProjectiles.length - 1; i >= 0; i--) {
    const proj = newProjectiles[i];
    let projHit = false;

    for (let j = newEnemies.length - 1; j >= 0; j--) {
      const enemy = newEnemies[j];
      if (
        distance(proj.x, proj.y, enemy.x, enemy.y) <
        proj.radius + enemy.radius
      ) {
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
    if (projHit) continue;

    for (const bgObj of state.visibleBackgroundObjects) {
      if (
        bgObj.type === "station" ||
        bgObj.type === "asteroid" ||
        bgObj.type === "beacon"
      ) {
        if (
          distance(proj.x, proj.y, bgObj.x, bgObj.y) <
          proj.radius + (bgObj as IGameObject).radius
        ) {
          newProjectiles.splice(i, 1);
          projHit = true;
          break;
        }
      }
    }
  }

  for (let i = newEnemies.length - 1; i >= 0; i--) {
    const enemy = newEnemies[i];
    let enemyDestroyedByEnvironment = false;
    for (const bgObj of state.visibleBackgroundObjects) {
      if (bgObj.type === "asteroid" || bgObj.type === "station") {
        const obstacle = bgObj as IAsteroid | IStation; // Both have x, y, radius
        if (
          distance(enemy.x, enemy.y, obstacle.x, obstacle.y) <
          enemy.radius + obstacle.radius
        ) {
          const { particles, duration } = generateParticleStates("small");
          newAnimations.push({
            id: `destroy-enemy-${obstacle.type}-${enemy.id}-${now}`,
            x: enemy.x,
            y: enemy.y,
            color: enemy.color,
            size: "small",
            startTime: now,
            particles,
            duration,
          });
          newEnemies.splice(i, 1);
          enemyDestroyedByEnvironment = true;
          break; // Enemy destroyed, move to next enemy
        }
      }
    }
    if (enemyDestroyedByEnvironment) continue; // Continue to the next enemy
  }

  let playerDestroyed = false;
  if (playerInstance) {
    for (let i = newEnemies.length - 1; i >= 0; i--) {
      const enemy = newEnemies[i];
      if (
        distance(playerInstance.x, playerInstance.y, enemy.x, enemy.y) <
        playerInstance.radius + enemy.radius
      ) {
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
        }
      }
    }

    if (!playerDestroyed) {
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
            break;
          }
        }
      }
    }

    if (playerDestroyed) {
      playerInstance.shieldLevel = 0;
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

    for (const bgObj of state.visibleBackgroundObjects) {
      if (bgObj.type === "station") {
        const station = bgObj as IStation;
        const player = playerInstance;
        const distToCenter = distance(player.x, player.y, station.x, station.y);
        const interactionDistanceThreshold =
          player.radius + station.radius + 10;
        const pushbackThreshold = player.radius + station.radius;

        if (distToCenter < interactionDistanceThreshold) {
          const dx = station.x - player.x;
          const dy = station.y - player.y;
          const worldAngle = Math.atan2(dy, dx);
          const relativeAngle = normalizeAngle(worldAngle - station.angle);
          const isAngleCorrect =
            relativeAngle <= DOCKING_MIN_RELATIVE_ANGLE ||
            relativeAngle >= DOCKING_MAX_RELATIVE_ANGLE;

          const stationEntranceDepth = 10;
          if (
            isAngleCorrect &&
            distToCenter < player.radius + station.radius - stationEntranceDepth
          ) {
            dockingTriggerStationId = station.id;
            player.vx = 0;
            player.vy = 0;
            break;
          }

          const distToCenterPushBackAccountingEntrance = isAngleCorrect
            ? -stationEntranceDepth
            : 0;

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
            player.x += Math.cos(pushAngle) * (overlap + 0.5);
            player.y += Math.sin(pushAngle) * (overlap + 0.5);
            player.vx = 0;
            player.vy = 0;
          }
        }
      } else if (bgObj.type === "beacon") {
        // This logic remains, but if no beacons are generated, it won't trigger for the removed ones.
        const beacon = bgObj as IBeacon;
        const player = playerInstance;
        const distToBeacon = distance(player.x, player.y, beacon.x, beacon.y);
        const activationThreshold = player.radius + beacon.radius + 5;

        if (!beacon.isActive && distToBeacon < activationThreshold) {
          activatedBeaconId = beacon.id;
          console.log(`Player activating beacon ${beacon.id}`);
          player.vx = 0;
          player.vy = 0;
          break;
        }
      } else if (bgObj.type === "asteroid") {
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
    },
    dockingTriggerStationId,
    activatedBeaconId,
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
): { newState: IGameState; activatedBeaconId: string | null } {
  let newState = { ...currentState };
  let activatedBeaconId: string | null = null;

  newState.activeDestructionAnimations =
    newState.activeDestructionAnimations.filter(
      (anim) => now - anim.startTime < anim.duration + 100
    );

  if (newState.gameView === "destroyed") {
    newState.respawnTimer -= deltaTime;
    if (newState.respawnTimer <= 0) {
      const respawnStationId =
        newState.lastDockedStationId ?? C.WORLD_ORIGIN_STATION_ID; // Use config for origin
      const respawnStation = worldManager.getStationById(respawnStationId);
      let respawnX = 50;
      let respawnY = 50;
      if (respawnStation) {
        const exitAngle = respawnStation.angle + Math.PI;
        const respawnDist = respawnStation.radius + C.PLAYER_SIZE / 2 + 20;
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
      newState = {
        ...newState,
        player: respawnedPlayer,
        cargoHold: {}, // When ship is destroyed, cargo is lost
        gameView: "playing",
        respawnTimer: 0,
        enemies: [],
        projectiles: [],
        activeDestructionAnimations: [],
      };
    } else {
      const deadPlayer = currentState.player;
      if (deadPlayer) {
        newState.camera = {
          x: deadPlayer.x - C.GAME_WIDTH / 2,
          y: deadPlayer.y - C.GAME_VIEW_HEIGHT / 2,
        };
      }
    }
    return { newState, activatedBeaconId: null };
  }

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
      }
    }
    return { newState, activatedBeaconId: null };
  }

  if (newState.gameView === "playing") {
    if (!newState.player || !(newState.player instanceof Player)) {
      console.error(
        "Player state missing/invalid during update!",
        newState.player
      );
      if (currentState.player?.x !== undefined) {
        newState.player = createPlayer(
          currentState.player.x,
          currentState.player.y,
          currentState.shieldCapacitorLevel
        );
      } else {
        console.error("Cannot recover player state!");
        return { newState: currentState, activatedBeaconId: null };
      }
    }

    if (touchState?.shoot.active) newState = shootProjectile(newState);
    if (touchState && newState.player instanceof Player) {
      newState.player.update(touchState, newState.engineBoosterLevel);
    }

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
        if (p instanceof Projectile) p.update();
        return p;
      })
      .filter(
        (p) =>
          p instanceof Projectile &&
          !p.isOutOfBounds(newState.player.x, newState.player.y)
      );

    newState.enemies = newState.enemies.map((enemy) => {
      if (enemy instanceof Enemy && newState.player)
        enemy.update(newState.player);
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

    // --- Dynamic Max Enemies Calculation ---
    const dynamicMaxEnemies = getDynamicMaxEnemies(
      newState.cargoHold,
      COMMODITIES,
      newState.lastDockedStationId,
      worldManager
    );
    // --- End Dynamic Max Enemies Calculation ---

    const isPlayerNearStation = newState.visibleBackgroundObjects.some(
      (obj) => {
        if (obj.type === "station" && newState.player) {
          const dist = distance(
            newState.player.x,
            newState.player.y,
            obj.x,
            obj.y
          );
          return dist < C.ENEMY_SPAWN_NEAR_STATION_THRESHOLD;
        }
        return false;
      }
    );

    if (
      !isPlayerNearStation &&
      now - newState.lastEnemySpawnTime > C.ENEMY_SPAWN_INTERVAL &&
      newState.enemies.length < dynamicMaxEnemies // Use dynamicMaxEnemies here
    ) {
      newState = spawnEnemyNearPlayer(newState);
    }

    const collisionResult = handleCollisions(newState, now);
    newState = collisionResult.newState;
    activatedBeaconId = collisionResult.activatedBeaconId;

    newState.activeDestructionAnimations.push(...collisionResult.newAnimations);

    if (collisionResult.playerDestroyed) {
      console.log("Logic: Player destroyed signal received.");
      return {
        newState: {
          ...collisionResult.newState,
          gameView: "destroyed",
          respawnTimer: C.RESPAWN_DELAY_MS,
          projectiles: [],
          enemies: [],
          activeDestructionAnimations: newState.activeDestructionAnimations,
        },
        activatedBeaconId: null,
      };
    }

    if (collisionResult.dockingTriggerStationId) {
      newState.dockingStationId = collisionResult.dockingTriggerStationId;
    }

    if (newState.player) {
      newState.camera = {
        x: newState.player.x - C.GAME_WIDTH / 2,
        y: newState.player.y - C.GAME_VIEW_HEIGHT / 2,
      };
    }
  }

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

  return { newState, activatedBeaconId };
}

function calculateNavigationInfo(
  currentGameState: IGameState,
  worldManager: InfiniteWorldManager
): {
  navTargetDirection: number | null;
  navTargetCoordinates: IPosition | null;
  navTargetDistance: number | null;
  needsNavClear: boolean;
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

export function handleBeaconActivationAndUpdateQuest(
  currentState: IGameState,
  activatedBeaconId: string | null
): { updatedState: IGameState; questStateModified: boolean } {
  if (!activatedBeaconId) {
    return { updatedState: currentState, questStateModified: false };
  }

  console.log(
    `[handleBeaconActivation] Beacon Activation Detected: ${activatedBeaconId}`
  );
  // Since worldManager.getBeaconById and updateBeaconState are removed,
  // this function can't interact with beacon world state directly anymore.
  // const beacon = worldManager.getBeaconById(activatedBeaconId); // This would be null or error

  // For the removed quests, beaconToReachObjectiveMap would be empty or not contain these beacon IDs.
  // So, the quest update logic below would not trigger for the removed beacon quests.
  // If other quests were to use beacons, this function would need adjustment.
  // For now, it will largely be a no-op for the removed beacon-related quests.

  const questStateModified = false;
  const nextQuestState = currentState.questState;

  // Check if beacon exists and is NOT already active in the world state
  // This check is now problematic as getBeaconById is removed from worldManager.
  // We'll assume for now that if a beacon ID is passed, it's intended for activation.
  // However, without specific beacon generation, this path won't be hit for the removed beacons.

  // Original logic for direct quest modification:
  /*
  const reachObjectiveId = beaconToReachObjectiveMap[activatedBeaconId]; 
  if (!reachObjectiveId) {
    console.warn(
      `[handleBeaconActivation] No matching reach objective found for beacon ID: ${activatedBeaconId}`
    );
  } else {
    // ... (quest state modification logic) ...
    // This part will not be reached for the removed beacons if beaconToReachObjectiveMap is cleared.
  }
  */

  // If no specific beacon quests are active or the map is empty, this function
  // might still be called but won't modify quest state for those.
  // If beacon entities are entirely removed, then `activatedBeaconId` in `handleCollisions`
  // will never be set, and this function won't be called with those IDs.

  return {
    updatedState: { ...currentState, questState: nextQuestState },
    questStateModified,
  };
}

function handleGameViewTransitions(
  previousGameState: IGameState,
  nextLogicState: IGameState,
  worldManager: InfiniteWorldManager,
  emitQuestEvent: (event: GameEvent) => void
): { updatedState: IGameState; transitionOccurred: boolean } {
  const currentView = previousGameState.gameView;
  const nextView = nextLogicState.gameView;
  let stateToReturn = { ...nextLogicState };
  let transitionOccurred = false;

  if (
    currentView === "playing" &&
    !previousGameState.dockingStationId &&
    nextLogicState.dockingStationId &&
    nextView === "playing"
  ) {
    console.log("[handleGameViewTransitions] Detected docking initiation.");
    transitionOccurred = true;
    let updatedPlayer = stateToReturn.player;
    if (updatedPlayer instanceof Player) {
      updatedPlayer.vx = 0;
      updatedPlayer.vy = 0;
    } else if (updatedPlayer) {
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
        duration: previousGameState.animationState.duration,
      },
      market: null,
    };
  } else if (
    currentView === "docking" &&
    previousGameState.animationState.type === "docking" &&
    nextLogicState.animationState.type === null
  ) {
    console.log("[handleGameViewTransitions] Detected docking completion.");
    transitionOccurred = true;
    const stationId = previousGameState.dockingStationId;
    const station = stationId ? worldManager.getStationById(stationId) : null;
    let newMarket: MarketSnapshot | null = null;
    const updatedDiscoveredStations = [...previousGameState.discoveredStations];

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
        ...stateToReturn.animationState,
        type: null,
        progress: 0,
      },
    };
  } else if (
    currentView === "undocking" &&
    previousGameState.animationState.type === "undocking" &&
    nextLogicState.animationState.type === null
  ) {
    console.log("[handleGameViewTransitions] Detected undocking completion.");
    transitionOccurred = true;
    let playerX = stateToReturn.player?.x ?? 0;
    let playerY = stateToReturn.player?.y ?? 0;
    let playerAngle = stateToReturn.player?.angle ?? -Math.PI / 2;

    const stationId = previousGameState.lastDockedStationId;
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
    updatedPlayer.x = playerX;
    updatedPlayer.y = playerY;
    updatedPlayer.vx = 0;
    updatedPlayer.vy = 0;
    updatedPlayer.angle = playerAngle;
    updatedPlayer.shieldLevel = updatedPlayer.maxShield;

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
  } else if (currentView === "playing" && nextView === "destroyed") {
    console.log(
      "[handleGameViewTransitions] Detected destruction transition from logic."
    );
    transitionOccurred = true;
    stateToReturn = { ...stateToReturn, projectiles: [], enemies: [] };
  } else if (currentView === "destroyed" && nextView === "playing") {
    console.log(
      "[handleGameViewTransitions] Detected respawn completion from logic."
    );
    transitionOccurred = true;
  }
  return { updatedState: stateToReturn, transitionOccurred };
}

function checkAndApplyWinCondition(currentState: IGameState): {
  updatedState: IGameState;
  winConditionMet: boolean;
} {
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

export const calculateNextGameState = (
  currentGameState: IGameState,
  deltaTime: number,
  now: number,
  currentTouchState: ITouchState | undefined,
  worldManager: InfiniteWorldManager,
  emitQuestEvent: (event: GameEvent) => void
): IGameState => {
  if (!currentGameState.isInitialized || currentGameState.gameView === "won") {
    return currentGameState;
  }

  const {
    navTargetDirection,
    navTargetCoordinates,
    navTargetDistance,
    needsNavClear,
  } = calculateNavigationInfo(currentGameState, worldManager);

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

  const stateForLogic = {
    ...currentGameState,
    navTargetDirection,
    navTargetCoordinates,
    navTargetDistance,
  };

  const { newState: stateAfterLogic, activatedBeaconId } = updateGameStateLogic(
    stateForLogic,
    currentTouchState,
    worldManager,
    deltaTime,
    now
  );

  const { updatedState: stateAfterBeaconHandling } =
    handleBeaconActivationAndUpdateQuest(stateAfterLogic, activatedBeaconId);

  const { updatedState: stateAfterTransitions, transitionOccurred } =
    handleGameViewTransitions(
      currentGameState,
      stateAfterBeaconHandling,
      worldManager,
      emitQuestEvent
    );

  if (transitionOccurred) {
    return stateAfterTransitions;
  }

  const { updatedState: finalState, winConditionMet } =
    checkAndApplyWinCondition(stateAfterTransitions);

  if (winConditionMet) {
    return finalState;
  }
  return finalState;
};
