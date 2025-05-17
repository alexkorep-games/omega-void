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

function spawnEnemyNearPlayer(state: IGameState): IGameState {
  const spawnDist = C.GAME_WIDTH * 0.8;
  const angle = Math.random() * Math.PI * 2;
  const spawnX = state.hot.player.x + Math.cos(angle) * spawnDist;
  const spawnY = state.hot.player.y + Math.sin(angle) * spawnDist;
  const newEnemy = new Enemy(spawnX, spawnY, state.hot.enemyIdCounter);

  return {
    ...state,
    hot: {
      ...state.hot,
      enemies: [...state.hot.enemies, newEnemy],
      enemyIdCounter: state.hot.enemyIdCounter + 1,
      lastEnemySpawnTime: performance.now(),
    },
  };
}

function shootProjectile(state: IGameState): IGameState {
  const now = performance.now();
  const effectiveCooldown = C.SHOOT_COOLDOWN * state.cold.shootCooldownFactor;
  if (now - state.hot.lastShotTime > effectiveCooldown) {
    const newProjectile = new Projectile(
      state.hot.player.x,
      state.hot.player.y,
      state.hot.player.angle
    );
    return {
      ...state,
      hot: {
        ...state.hot,
        projectiles: [...state.hot.projectiles, newProjectile],
        lastShotTime: now,
      },
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
  const newProjectiles = [...state.hot.projectiles];
  const newEnemies = [...state.hot.enemies];
  const playerInstance: Player =
    state.hot.player instanceof Player ? state.hot.player : new Player(0, 0);
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

    for (const bgObj of state.hot.visibleBackgroundObjects) {
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
    for (const bgObj of state.hot.visibleBackgroundObjects) {
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
      for (const bgObj of state.hot.visibleBackgroundObjects) {
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

    for (const bgObj of state.hot.visibleBackgroundObjects) {
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
      hot: {
        ...state.hot,
        player: playerInstance,
        enemies: newEnemies,
        projectiles: newProjectiles,
      },
    },
    dockingTriggerStationId,
    activatedBeaconId,
    playerDestroyed: false,
    newAnimations: newAnimations,
  };
}

// This function should also recieve the hot state and return updated cold and hot state
export function updateGameStateLogic(
  currentState: IGameState,
  touchState: ITouchState | undefined,
  worldManager: InfiniteWorldManager,
  deltaTime: number,
  now: number
): { newState: IGameState; activatedBeaconId: string | null } {
  let newState = { ...currentState };
  let activatedBeaconId: string | null = null;

  newState.cold.activeDestructionAnimations =
    newState.cold.activeDestructionAnimations.filter(
      (anim) => now - anim.startTime < anim.duration + 100
    );

  if (newState.cold.gameView === "destroyed") {
    newState.cold.respawnTimer -= deltaTime;
    if (newState.cold.respawnTimer <= 0) {
      const respawnStationId =
        newState.cold.lastDockedStationId ?? C.WORLD_ORIGIN_STATION_ID; // Use config for origin
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
        newState.cold.shieldCapacitorLevel
      );
      newState = {
        ...newState,
        hot: {
          ...newState.hot,
          player: respawnedPlayer,
          enemies: [],
          projectiles: [],
        },
        cold: {
          ...newState.cold,
          cargoHold: {}, // When ship is destroyed, cargo is lost
          gameView: "playing",
          respawnTimer: 0,
          activeDestructionAnimations: [],
        },
      };
    } else {
      const deadPlayer = currentState.hot.player;
      if (deadPlayer) {
        newState.hot.camera = {
          x: deadPlayer.x - C.GAME_WIDTH / 2,
          y: deadPlayer.y - C.GAME_VIEW_HEIGHT / 2,
        };
      }
    }
    return { newState, activatedBeaconId: null };
  }

  if (
    newState.cold.gameView === "docking" ||
    newState.cold.gameView === "undocking"
  ) {
    if (newState.cold.animationState.type) {
      newState.cold.animationState = {
        ...newState.cold.animationState,
        progress: newState.cold.animationState.progress + deltaTime,
      };
      if (
        newState.cold.animationState.progress >=
        newState.cold.animationState.duration
      ) {
        newState.cold.animationState = {
          ...newState.cold.animationState,
          type: null,
          progress: 0,
        };
      }
    }
    return { newState, activatedBeaconId: null };
  }

  if (newState.cold.gameView === "playing") {
    if (!newState.hot.player || !(newState.hot.player instanceof Player)) {
      console.error(
        "Player state missing/invalid during update!",
        newState.hot.player
      );
      if (currentState.hot.player?.x !== undefined) {
        newState.hot.player = createPlayer(
          currentState.hot.player.x,
          currentState.hot.player.y,
          currentState.cold.shieldCapacitorLevel
        );
      } else {
        console.error("Cannot recover player state!");
        return { newState: currentState, activatedBeaconId: null };
      }
    }

    if (touchState?.shoot.active) newState = shootProjectile(newState);
    if (touchState && newState.hot.player instanceof Player) {
      newState.hot.player.update(touchState, newState.cold.engineBoosterLevel);
    }

    newState.hot.camera = {
      x: newState.hot.player.x - C.GAME_WIDTH / 2,
      y: newState.hot.player.y - C.GAME_VIEW_HEIGHT / 2,
    };

    newState.hot.visibleBackgroundObjects = worldManager.getObjectsInView(
      newState.hot.camera.x,
      newState.hot.camera.y,
      C.GAME_WIDTH,
      C.GAME_VIEW_HEIGHT
    );

    newState.hot.projectiles = newState.hot.projectiles
      .map((p) => {
        if (p instanceof Projectile) p.update();
        return p;
      })
      .filter(
        (p) =>
          p instanceof Projectile &&
          !p.isOutOfBounds(newState.hot.player.x, newState.hot.player.y)
      );

    newState.hot.enemies = newState.hot.enemies.map((enemy) => {
      if (enemy instanceof Enemy && newState.hot.player)
        enemy.update(newState.hot.player);
      return enemy;
    });

    const enemyIdsToDespawn = worldManager.getEnemiesToDespawn(
      newState.hot.enemies,
      newState.hot.player.x,
      newState.hot.player.y,
      C.ENEMY_DESPAWN_RADIUS
    );
    if (enemyIdsToDespawn.length > 0) {
      const idsSet = new Set(enemyIdsToDespawn);
      newState.hot.enemies = newState.hot.enemies.filter(
        (enemy) => !idsSet.has(enemy.id)
      );
    }

    // --- Dynamic Max Enemies Calculation ---
    const dynamicMaxEnemies = getDynamicMaxEnemies(
      newState.cold.cargoHold,
      COMMODITIES,
      newState.cold.lastDockedStationId,
      worldManager
    );
    // --- End Dynamic Max Enemies Calculation ---

    const isPlayerNearStation = newState.hot.visibleBackgroundObjects.some(
      (obj) => {
        if (obj.type === "station" && newState.hot.player) {
          const dist = distance(
            newState.hot.player.x,
            newState.hot.player.y,
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
      now - newState.hot.lastEnemySpawnTime > C.ENEMY_SPAWN_INTERVAL &&
      newState.hot.enemies.length < dynamicMaxEnemies // Use dynamicMaxEnemies here
    ) {
      newState = spawnEnemyNearPlayer(newState);
    }

    const collisionResult = handleCollisions(newState, now);
    newState = collisionResult.newState;
    activatedBeaconId = collisionResult.activatedBeaconId;

    newState.cold.activeDestructionAnimations.push(
      ...collisionResult.newAnimations
    );

    if (collisionResult.playerDestroyed) {
      console.log("Logic: Player destroyed signal received.");
      return {
        newState: {
          ...collisionResult.newState,
          cold: {
            ...collisionResult.newState.cold,

            gameView: "destroyed",
            respawnTimer: C.RESPAWN_DELAY_MS,
            activeDestructionAnimations:
              newState.cold.activeDestructionAnimations,
          },
          hot: {
            ...collisionResult.newState.hot,
            projectiles: [],
            enemies: [],
          },
        },
        activatedBeaconId: null,
      };
    }

    if (collisionResult.dockingTriggerStationId) {
      newState.cold.dockingStationId = collisionResult.dockingTriggerStationId;
    }

    if (newState.hot.player) {
      newState.hot.camera = {
        x: newState.hot.player.x - C.GAME_WIDTH / 2,
        y: newState.hot.player.y - C.GAME_VIEW_HEIGHT / 2,
      };
    }
  }

  if (newState.cold.navTargetCoordinates && newState.hot.player) {
    newState.cold.navTargetDistance = distance(
      newState.hot.player.x,
      newState.hot.player.y,
      newState.cold.navTargetCoordinates.x,
      newState.cold.navTargetCoordinates.y
    );
  } else {
    newState.cold.navTargetDistance = null;
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

  if (currentGameState.cold.navTargetStationId && currentGameState.hot.player) {
    const targetStation = worldManager.getStationById(
      currentGameState.cold.navTargetStationId
    );
    if (targetStation) {
      const dx = targetStation.x - currentGameState.hot.player.x;
      const dy = targetStation.y - currentGameState.hot.player.y;
      navTargetDirection = Math.atan2(dy, dx);
      navTargetCoordinates = { x: targetStation.x, y: targetStation.y };
      navTargetDistance = distance(
        currentGameState.hot.player.x,
        currentGameState.hot.player.y,
        targetStation.x,
        targetStation.y
      );
    } else {
      console.warn(
        `[calculateNavigationInfo] Nav target station ${currentGameState.cold.navTargetStationId} not found. Flagging for clear.`
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

  const questStateModified = false;
  const nextQuestState = currentState.cold.questState;

  return {
    updatedState: {
      ...currentState,
      cold: {
        ...currentState.cold,
        questState: nextQuestState,
      },
    },
    questStateModified,
  };
}

function handleGameViewTransitions(
  previousGameState: IGameState,
  nextLogicState: IGameState,
  worldManager: InfiniteWorldManager,
  emitQuestEvent: (event: GameEvent) => void
): { updatedState: IGameState; transitionOccurred: boolean } {
  const currentView = previousGameState.cold.gameView;
  const nextView = nextLogicState.cold.gameView;
  let stateToReturn = { ...nextLogicState };
  let transitionOccurred = false;

  if (
    currentView === "playing" &&
    !previousGameState.cold.dockingStationId &&
    nextLogicState.cold.dockingStationId &&
    nextView === "playing"
  ) {
    console.log("[handleGameViewTransitions] Detected docking initiation.");
    transitionOccurred = true;
    let updatedPlayer = stateToReturn.hot.player;
    if (updatedPlayer instanceof Player) {
      updatedPlayer.vx = 0;
      updatedPlayer.vy = 0;
    } else if (updatedPlayer) {
      const shieldLevel = previousGameState.cold.shieldCapacitorLevel;
      updatedPlayer = createPlayer(
        updatedPlayer.x,
        updatedPlayer.y,
        shieldLevel
      );
      updatedPlayer.angle = previousGameState.hot.player?.angle ?? -Math.PI / 2;
      updatedPlayer.vx = 0;
      updatedPlayer.vy = 0;
      console.warn(
        "[handleGameViewTransitions] Player object not instance during docking initiation. Recreated."
      );
    }
    stateToReturn = {
      ...stateToReturn,
      hot: {
        ...stateToReturn.hot,
        player: updatedPlayer,
      },
      cold: {
        ...stateToReturn.cold,
        gameView: "docking",
        animationState: {
          type: "docking",
          progress: 0,
          duration: previousGameState.cold.animationState.duration,
        },
        market: null,
      },
    };
  } else if (
    currentView === "docking" &&
    previousGameState.cold.animationState.type === "docking" &&
    nextLogicState.cold.animationState.type === null
  ) {
    console.log("[handleGameViewTransitions] Detected docking completion.");
    transitionOccurred = true;
    const stationId = previousGameState.cold.dockingStationId;
    const station = stationId ? worldManager.getStationById(stationId) : null;

    const updatedDiscoveredStations = [
      ...previousGameState.cold.discoveredStations,
    ];
    if (stationId && !updatedDiscoveredStations.includes(stationId)) {
      updatedDiscoveredStations.push(stationId);
    }

    const newKnownPrices = { ...previousGameState.cold.knownStationPrices };
    const newKnownQuantities = {
      ...previousGameState.cold.knownStationQuantities,
    };
    let marketForSession: MarketSnapshot | null = null;

    if (stationId && station) {
      // Generate market data (prices are fixed, initial quantities are fixed)
      const generatedMarket = MarketGenerator.generate(station, WORLD_SEED, 0); // Use fixed seed suffix 0

      const currentStationPrices = newKnownPrices[stationId] ?? {};
      const currentStationQuantities = newKnownQuantities[stationId] ?? {};

      let pricesWereUpdated = false;
      let quantitiesWereUpdated = false;

      // Ensure prices and initial quantities are known for all items this station generates
      // Iterate over items defined in the deterministic market generation for this station
      for (const commKey in generatedMarket.table) {
        if (
          Object.prototype.hasOwnProperty.call(generatedMarket.table, commKey)
        ) {
          const generatedItemData = generatedMarket.table[commKey];
          // Prices are fixed, so they are set once if not known.
          if (currentStationPrices[commKey] === undefined) {
            currentStationPrices[commKey] = generatedItemData.price;
            pricesWereUpdated = true;
          }
          // Initial quantities are also fixed. If we don't have a quantity stored for this item yet,
          // it means this is likely the first time or data was reset, so use the generated initial quantity.
          // This ensures `knownStationQuantities` is populated for all items the station trades.
          if (currentStationQuantities[commKey] === undefined) {
            currentStationQuantities[commKey] = generatedItemData.quantity;
            quantitiesWereUpdated = true;
          }
        }
      }

      if (pricesWereUpdated) {
        newKnownPrices[stationId] = currentStationPrices;
      }
      if (quantitiesWereUpdated) {
        newKnownQuantities[stationId] = currentStationQuantities;
      }

      // Construct the market snapshot for *this specific docking session*.
      // It uses the fixed prices and the *current, persistent* quantities from newKnownQuantities.
      const tableForSessionSnapshot: CommodityTable = {};
      const pricesToUseForSession = newKnownPrices[stationId]!;
      const quantitiesToUseForSession = newKnownQuantities[stationId]!;

      // Iterate over all commodities for which prices are known at this station.
      // These are all the commodities this station is designed to trade.
      for (const commKey in pricesToUseForSession) {
        if (
          Object.prototype.hasOwnProperty.call(pricesToUseForSession, commKey)
        ) {
          const quantity = quantitiesToUseForSession[commKey];
          // A commodity with a price must also have a quantity entry in knownStationQuantities
          // (it would have been initialized above if it was missing).
          if (quantity !== undefined) {
            tableForSessionSnapshot[commKey] = {
              price: pricesToUseForSession[commKey],
              quantity: quantity,
            };
          } else {
            // This state (price known, quantity undefined in knownStationQuantities)
            // should ideally not be reached due to the initialization loop above.
            // If it does, it indicates an inconsistency.
            console.warn(
              `[Docking] Station ${stationId} has price for ${commKey} but its quantity is undefined in knownStationQuantities. Listing with Qty 0.`
            );
            tableForSessionSnapshot[commKey] = {
              price: pricesToUseForSession[commKey],
              quantity: 0, // Fallback for safety, though should be avoided
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
      cold: {
        ...stateToReturn.cold,
        gameView: "trade_select",
        market: marketForSession,
        lastDockedStationId: stationId,
        discoveredStations: updatedDiscoveredStations,
        knownStationPrices: newKnownPrices,
        knownStationQuantities: newKnownQuantities,
        animationState: {
          ...stateToReturn.cold.animationState,
          type: null,
          progress: 0,
        },
      },
    };
  } else if (
    currentView === "undocking" &&
    previousGameState.cold.animationState.type === "undocking" &&
    nextLogicState.cold.animationState.type === null
  ) {
    console.log("[handleGameViewTransitions] Detected undocking completion.");
    transitionOccurred = true;
    let playerX = stateToReturn.hot.player?.x ?? 0;
    let playerY = stateToReturn.hot.player?.y ?? 0;
    let playerAngle = stateToReturn.hot.player?.angle ?? -Math.PI / 2;

    const stationId = previousGameState.cold.lastDockedStationId;
    const station = stationId ? worldManager.getStationById(stationId) : null;

    if (station) {
      const undockDist =
        station.radius +
        (previousGameState.hot.player?.radius ?? PLAYER_SIZE / 2) +
        20;
      const exitAngle = station.angle + Math.PI;
      playerX = station.x + Math.cos(exitAngle) * undockDist;
      playerY = station.y + Math.sin(exitAngle) * undockDist;
      playerAngle = exitAngle;
    }
    let updatedPlayer = stateToReturn.hot.player;
    if (!(updatedPlayer instanceof Player) && updatedPlayer) {
      const shieldLevel = previousGameState.cold.shieldCapacitorLevel;
      updatedPlayer = createPlayer(playerX, playerY, shieldLevel);
    } else if (!updatedPlayer) {
      const shieldLevel = previousGameState.cold.shieldCapacitorLevel;
      updatedPlayer = createPlayer(playerX, playerY, shieldLevel);
    }
    updatedPlayer.x = playerX;
    updatedPlayer.y = playerY;
    updatedPlayer.vx = 0;
    updatedPlayer.vy = 0;
    updatedPlayer.angle = playerAngle;
    // Restore shields on undock - consider if this is desired behavior or should be part of a service
    // if (updatedPlayer.maxShield > 0) {
    //   // only if maxShield is positive
    //   updatedPlayer.shieldLevel = updatedPlayer.maxShield;
    // }

    stateToReturn = {
      ...stateToReturn,
      hot: {
        ...stateToReturn.hot,
        player: updatedPlayer,
      },
      cold: {
        ...stateToReturn.cold,
        gameView: "playing",
        dockingStationId: null,
        market: null,
        animationState: {
          ...stateToReturn.cold.animationState,
          type: null,
          progress: 0,
        },
      },
    };
  } else if (currentView === "playing" && nextView === "destroyed") {
    console.log(
      "[handleGameViewTransitions] Detected destruction transition from logic."
    );
    transitionOccurred = true;
    stateToReturn = {
      ...stateToReturn,
      hot: {
        ...stateToReturn.hot,
        projectiles: [],
        enemies: [],
      },
    };
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
    currentState.cold.questState
  );
  if (finalScore >= 100 && currentState.cold.gameView !== "won") {
    console.log(
      "[checkAndApplyWinCondition] WIN CONDITION MET! Emancipation Score >= 100%"
    );
    let finalPlayer = currentState.hot.player;
    if (finalPlayer instanceof Player) {
      finalPlayer.vx = 0;
      finalPlayer.vy = 0;
    } else if (finalPlayer) {
      finalPlayer = { ...finalPlayer, vx: 0, vy: 0 };
    }
    return {
      updatedState: {
        ...currentState,
        hot: { ...currentState.hot, player: finalPlayer },
        cold: { ...currentState.cold, gameView: "won" },
      },
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
  if (
    !currentGameState.cold.isInitialized ||
    currentGameState.cold.gameView === "won"
  ) {
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
      `[calculateNavigationInfo] Clearing navigation target due to missing station.`
    );
    return {
      ...currentGameState,
      cold: {
        ...currentGameState.cold,
        navTargetStationId: null,
        navTargetDirection: null,
        navTargetCoordinates: null,
        navTargetDistance: null,
      },
    };
  }

  const stateForLogic = {
    ...currentGameState,
    cold: {
      ...currentGameState.cold,
      navTargetDirection,
      navTargetCoordinates,
      navTargetDistance,
    },
  };

  const { newState: stateAfterLogic } = updateGameStateLogic(
    stateForLogic,
    currentTouchState,
    worldManager,
    deltaTime,
    now
  );

  const { updatedState: stateAfterTransitions, transitionOccurred } =
    handleGameViewTransitions(
      currentGameState,
      stateAfterLogic,
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
