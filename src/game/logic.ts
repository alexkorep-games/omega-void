// src/game/logic.ts
import {
  IGameColdState,
  ITouchState,
  IPosition,
  IPlayer,
  IStation,
  DestructionAnimationData,
  ParticleState,
  IAsteroid,
  IBeacon,
  IGameObject,
  CommodityTable,
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

function spawnEnemyNearPlayer(state: IGameColdState): IGameColdState {
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

function shootProjectile(state: IGameColdState): IGameColdState {
  const now = performance.now();
  const effectiveCooldown = C.SHOOT_COOLDOWN * state.shootCooldownFactor;
  if (now - state.lastShotTime > effectiveCooldown) {
    const newProjectile = new Projectile(
      state.player.x,
      state.player.y,
      state.player.angle // Projectile angle matches player's current facing angle
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
  state: IGameColdState,
  now: number
): {
  newState: IGameColdState;
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
  currentState: IGameColdState,
  touchState: ITouchState | undefined,
  worldManager: InfiniteWorldManager,
  deltaTime: number,
  now: number
): { newState: IGameColdState; activatedBeaconId: string | null } {
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
        newState.lastDockedStationId ?? C.WORLD_ORIGIN_STATION_ID;
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
        cargoHold: {},
        gameView: "playing",
        respawnTimer: 0,
        enemies: [],
        projectiles: [],
        activeDestructionAnimations: [],
      };
    } else {
      const deadPlayer = currentState.player;
      if (deadPlayer) {
        // Camera remains centered on destruction point, world rotates around it
        // No specific change to camera logic needed here due to new rendering.
        // It will still be based on player's last known position for world offset.
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

    if (newState.player instanceof Player) {
      newState.player.update(
        touchState,
        newState.engineBoosterLevel,
        deltaTime
      );
    }

    // Camera logic is now implicit in GameCanvas through offsetX/offsetY of the GameWorldGroup
    // No explicit camera update needed here for rendering the world relative to player.
    // However, worldManager still needs a camera-like view box to decide what to load.
    // This camera state can still represent the logical center of the view.
    newState.camera = {
      x: newState.player.x - C.GAME_WIDTH / 2,
      y: newState.player.y - C.GAME_VIEW_HEIGHT / 2, // Centered on player's logical position
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

    const dynamicMaxEnemies = getDynamicMaxEnemies(
      newState.cargoHold,
      COMMODITIES,
      newState.lastDockedStationId,
      worldManager
    );

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
      newState.enemies.length < dynamicMaxEnemies
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

    // Camera logic updated after player moves (already handled above)
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
  currentGameState: IGameColdState,
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
  currentState: IGameColdState,
  activatedBeaconId: string | null
): { updatedState: IGameColdState; questStateModified: boolean } {
  if (!activatedBeaconId) {
    return { updatedState: currentState, questStateModified: false };
  }

  console.log(
    `[handleBeaconActivation] Beacon Activation Detected: ${activatedBeaconId}`
  );
  const questStateModified = false;
  const nextQuestState = currentState.questState;

  // Quest logic related to beacons would go here if any existed.
  // For now, it's a no-op for the removed beacon-related quests.

  return {
    updatedState: { ...currentState, questState: nextQuestState },
    questStateModified,
  };
}

function handleGameViewTransitions(
  previousGameState: IGameColdState,
  nextLogicState: IGameColdState,
  worldManager: InfiniteWorldManager,
  emitQuestEvent: (event: GameEvent) => void
): { updatedState: IGameColdState; transitionOccurred: boolean } {
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

    const updatedDiscoveredStations = [...previousGameState.discoveredStations];
    if (stationId && !updatedDiscoveredStations.includes(stationId)) {
      updatedDiscoveredStations.push(stationId);
    }

    const newKnownPrices = { ...previousGameState.knownStationPrices };
    const newKnownQuantities = { ...previousGameState.knownStationQuantities };
    let marketForSession: MarketSnapshot | null = null;

    if (stationId && station) {
      const generatedMarket = MarketGenerator.generate(station, WORLD_SEED, 0);
      const currentStationPrices = newKnownPrices[stationId] ?? {};
      const currentStationQuantities = newKnownQuantities[stationId] ?? {};
      let pricesWereUpdated = false;
      let quantitiesWereUpdated = false;

      for (const commKey in generatedMarket.table) {
        if (
          Object.prototype.hasOwnProperty.call(generatedMarket.table, commKey)
        ) {
          const generatedItemData = generatedMarket.table[commKey];
          if (currentStationPrices[commKey] === undefined) {
            currentStationPrices[commKey] = generatedItemData.price;
            pricesWereUpdated = true;
          }
          if (currentStationQuantities[commKey] === undefined) {
            currentStationQuantities[commKey] = generatedItemData.quantity;
            quantitiesWereUpdated = true;
          }
        }
      }
      if (pricesWereUpdated) newKnownPrices[stationId] = currentStationPrices;
      if (quantitiesWereUpdated)
        newKnownQuantities[stationId] = currentStationQuantities;

      const tableForSessionSnapshot: CommodityTable = {};
      const pricesToUseForSession = newKnownPrices[stationId]!;
      const quantitiesToUseForSession = newKnownQuantities[stationId]!;
      for (const commKey in pricesToUseForSession) {
        if (
          Object.prototype.hasOwnProperty.call(pricesToUseForSession, commKey)
        ) {
          const quantity = quantitiesToUseForSession[commKey];
          if (quantity !== undefined) {
            tableForSessionSnapshot[commKey] = {
              price: pricesToUseForSession[commKey],
              quantity: quantity,
            };
          } else {
            console.warn(
              `[Docking] Station ${stationId} has price for ${commKey} but its quantity is undefined. Listing Qty 0.`
            );
            tableForSessionSnapshot[commKey] = {
              price: pricesToUseForSession[commKey],
              quantity: 0,
            };
          }
        }
      }
      marketForSession = new MarketSnapshot(
        Date.now(),
        tableForSessionSnapshot
      );
      setTimeout(() => emitQuestEvent({ type: "DOCK_FINISH", stationId }), 0);
    }

    stateToReturn = {
      ...stateToReturn,
      gameView: "trade_select",
      market: marketForSession,
      lastDockedStationId: stationId,
      discoveredStations: updatedDiscoveredStations,
      knownStationPrices: newKnownPrices,
      knownStationQuantities: newKnownQuantities,
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
      playerAngle = exitAngle; // Player faces away from station on undock
    }
    let updatedPlayer = stateToReturn.player;
    if (!(updatedPlayer instanceof Player) && updatedPlayer) {
      updatedPlayer = createPlayer(
        playerX,
        playerY,
        previousGameState.shieldCapacitorLevel
      );
    } else if (!updatedPlayer) {
      updatedPlayer = createPlayer(
        playerX,
        playerY,
        previousGameState.shieldCapacitorLevel
      );
    }
    updatedPlayer.x = playerX;
    updatedPlayer.y = playerY;
    updatedPlayer.vx = 0;
    updatedPlayer.vy = 0;
    updatedPlayer.angle = playerAngle;

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

function checkAndApplyWinCondition(currentState: IGameColdState): {
  updatedState: IGameColdState;
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
  currentGameState: IGameColdState,
  deltaTime: number,
  now: number,
  currentTouchState: ITouchState | undefined,
  worldManager: InfiniteWorldManager,
  emitQuestEvent: (event: GameEvent) => void
): IGameColdState => {
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
