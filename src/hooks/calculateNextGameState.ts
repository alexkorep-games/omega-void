// src/hooks/calculateNextGameState.ts
import { IGameState, ITouchState, IPosition } from "../game/types";
import { updateGameStateLogic, createPlayer } from "../game/logic";
import { InfiniteWorldManager } from "../game/world/InfiniteWorldManager";
import { PLAYER_SIZE } from "../game/config";
import { Player } from "../game/entities/Player";
import { MarketGenerator, MarketSnapshot } from "../game/Market";
import { distance } from "../utils/geometry";
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
  if (!currentGameState.isInitialized || currentGameState.gameView === "won")
    return currentGameState;

  // --- Calculate Nav Target Info ---
  let navTargetDirection: number | null = null;
  let navTargetCoordinates: IPosition | null = null;
  let navTargetDistance: number | null = null;
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
        `[calculateNextGameState] Nav target station ${currentGameState.navTargetStationId} not found. Clearing navigation.`
      );
      // Clear nav target if station not found
      return {
        ...currentGameState,
        navTargetStationId: null,
        navTargetDirection: null,
        navTargetCoordinates: null,
        navTargetDistance: null,
      };
    }
  }

  const stateForLogic = {
    ...currentGameState,
    navTargetDirection,
    navTargetCoordinates,
    navTargetDistance,
  };

  // --- Run Core Game Logic ---
  const {
    newState: nextLogicState, // Contains updates from physics, collisions etc.
    activatedBeaconId: beaconIdFromLogic,
  } = updateGameStateLogic(
    stateForLogic,
    currentTouchState,
    worldManager,
    deltaTime,
    now
  );

  // Use a clearer variable name for the activated beacon ID
  const activatedBeaconId = beaconIdFromLogic;

  // Start with the state returned by the core logic update
  let stateToReturn = { ...nextLogicState };
  let questStateModified = false;

  // --- Beacon Activation Side Effects (Direct Quest State Update) ---
  if (activatedBeaconId) {
    console.log(
      `[calculateNextGameState] Beacon Activation Detected: ${activatedBeaconId}`
    );
    const beacon = worldManager.getBeaconById(activatedBeaconId);

    // Check if beacon exists and is NOT already active in the world state
    if (beacon && !beacon.isActive) {
      console.log(
        `[calculateNextGameState] Beacon ${activatedBeaconId} is inactive, proceeding with direct quest update.`
      );
      worldManager.updateBeaconState(activatedBeaconId, true); // Update world state (visual)

      // --- Direct Quest State Modification ---
      const reachObjectiveId = beaconToReachObjectiveMap[activatedBeaconId];
      if (!reachObjectiveId) {
        console.warn(
          `[calculateNextGameState] No matching reach objective found for beacon ID: ${activatedBeaconId}`
        );
      } else {
        // Perform a deep clone of the quest state for safe modification
        // Use structuredClone for deep copy if available and appropriate,
        // otherwise use a library or manual deep copy.
        // For simplicity, assuming a shallow copy might suffice if quest state updates are careful,
        // but a deep clone is safer. Using structuredClone here.
        const nextQuestState = structuredClone(currentGameState.questState);
        const freedomQuest = nextQuestState.quests["freedom_v01"];

        if (freedomQuest) {
          let reachObjectiveMarkedDone = false;

          // 1. Update reach_beacon_* objective
          const reachObjective = freedomQuest[reachObjectiveId];
          if (reachObjective && !reachObjective.done) {
            reachObjective.done = true;
            reachObjectiveMarkedDone = true; // Flag that this objective was newly completed
            questStateModified = true;
            console.log(
              `[calculateNextGameState] Marked objective ${reachObjectiveId} as done.`
            );
          } else if (!reachObjective) {
            console.warn(
              `[calculateNextGameState] Objective ${reachObjectiveId} not found in quest state.`
            );
          } else if (reachObjective.done) {
            console.log(
              `[calculateNextGameState] Objective ${reachObjectiveId} was already done.`
            );
          }

          // 2. Update beaconKeys objective count *only if* the reach objective was newly completed
          const keysObjective = freedomQuest["beaconKeys"];
          if (keysObjective && reachObjectiveMarkedDone) {
            const currentCount = (keysObjective.current as number) || 0;
            const newCount = currentCount + 1;
            keysObjective.current = newCount;
            questStateModified = true;

            // Check if count now meets the target (e.g., 4) and mark done
            const targetKeys = 4; // Defined by quest objective
            if (newCount >= targetKeys && !keysObjective.done) {
              keysObjective.done = true;
              console.log(
                `[calculateNextGameState] Marked objective beaconKeys as done (reached ${newCount}).`
              );
            } else {
              console.log(
                `[calculateNextGameState] Incremented beaconKeys count to ${newCount}.`
              );
            }
          } else if (!keysObjective) {
            console.warn(
              `[calculateNextGameState] Objective beaconKeys not found in quest state.`
            );
          } else if (keysObjective && !reachObjectiveMarkedDone) {
            console.log(
              `[calculateNextGameState] BeaconKeys objective not incremented as reach objective ${reachObjectiveId} was not newly completed.`
            );
          }

          // If the quest state was modified, update the state we plan to return
          if (questStateModified) {
            stateToReturn = {
              ...stateToReturn, // Keep other changes from logic update
              questState: nextQuestState, // Replace with our directly modified questState
            };
          } else {
            console.log(
              `[calculateNextGameState] Beacon ${activatedBeaconId} processed, but no quest objectives needed updating (already done?).`
            );
          }
        } else {
          console.warn(
            `[calculateNextGameState] freedom_v01 quest progress not found.`
          );
        }
      }
      // --- End Direct Quest State Modification ---
    } else if (beacon && beacon.isActive) {
      console.log(
        `[calculateNextGameState] Beacon ${activatedBeaconId} already active. Skipping direct quest update.`
      );
    } else if (!beacon) {
      console.log(
        `[calculateNextGameState] Beacon ${activatedBeaconId} not found. Skipping direct quest update.`
      );
    }
  } // --- End of Beacon Activation Handling ---

  // --- Handle State Transitions (Docking, Undocking, Destruction, Respawn) ---
  // Check transitions based on the *potentially modified* stateToReturn
  const currentView = currentGameState.gameView; // View *before* this update cycle
  const nextView = stateToReturn.gameView; // View determined by logic update

  // Docking Initiation
  if (
    currentView === "playing" &&
    !currentGameState.dockingStationId &&
    stateToReturn.dockingStationId &&
    nextView === "playing" // Make sure logic didn't already change view
  ) {
    console.log("[calculateNextGameState] Detected docking initiation signal.");
    let updatedPlayer = stateToReturn.player;
    if (updatedPlayer instanceof Player) {
      updatedPlayer.vx = 0;
      updatedPlayer.vy = 0;
    } else if (updatedPlayer) {
      // Recreate if not an instance (e.g., loaded from save)
      const shieldLevel = currentGameState.shieldCapacitorLevel;
      updatedPlayer = createPlayer(
        updatedPlayer.x,
        updatedPlayer.y,
        shieldLevel
      );
      updatedPlayer.angle = currentGameState.player?.angle ?? -Math.PI / 2; // Preserve angle
      updatedPlayer.vx = 0;
      updatedPlayer.vy = 0;
      console.warn(
        "[calculateNextGameState] Player object not instance during docking initiation. Recreated."
      );
    }
    return {
      ...stateToReturn,
      player: updatedPlayer,
      gameView: "docking", // Change view state
      animationState: {
        type: "docking",
        progress: 0,
        duration: currentGameState.animationState.duration, // Use existing duration
      },
      market: null, // Clear market while docking
    };
  }
  // Docking Completion
  else if (
    currentView === "docking" &&
    currentGameState.animationState.type === "docking" &&
    stateToReturn.animationState.type === null // Logic cleared animation state
  ) {
    console.log(
      "[calculateNextGameState] Detected docking animation completion."
    );
    const stationId = currentGameState.dockingStationId;
    const station = stationId ? worldManager.getStationById(stationId) : null;
    let newMarket: MarketSnapshot | null = null;
    const updatedDiscoveredStations = [...currentGameState.discoveredStations];

    if (stationId && !updatedDiscoveredStations.includes(stationId)) {
      updatedDiscoveredStations.push(stationId);
    }

    if (station) {
      newMarket = MarketGenerator.generate(station, WORLD_SEED, Date.now());
    }

    const newKnownPrices = { ...currentGameState.knownStationPrices };
    if (stationId && newMarket) {
      const currentKnown = newKnownPrices[stationId] ?? {};
      Object.entries(newMarket.table).forEach(([key, state]) => {
        // Only add price if not already known - preserves older known prices
        // if the item isn't currently sold. Might want different logic here.
        if (currentKnown[key] === undefined) {
          currentKnown[key] = state.price;
        }
      });
      newKnownPrices[stationId] = currentKnown;
    }

    if (stationId) {
      // Use the passed-in emitQuestEvent, wrapped in setTimeout
      // to allow state update cycle to potentially finish first.
      setTimeout(() => emitQuestEvent({ type: "DOCK_FINISH", stationId }), 0);
    }

    return {
      ...stateToReturn,
      gameView: "trade_select", // Change view state
      market: newMarket,
      lastDockedStationId: stationId,
      discoveredStations: updatedDiscoveredStations,
      knownStationPrices: newKnownPrices,
      animationState: {
        // Ensure animation state is fully reset
        ...stateToReturn.animationState,
        type: null,
        progress: 0,
      },
      // dockingStationId remains from currentGameState as logic doesn't clear it here
    };
  }
  // Undocking Completion
  else if (
    currentView === "undocking" &&
    currentGameState.animationState.type === "undocking" &&
    stateToReturn.animationState.type === null // Logic cleared animation state
  ) {
    console.log(
      "[calculateNextGameState] Detected undocking animation completion."
    );
    let playerX = stateToReturn.player?.x ?? 0;
    let playerY = stateToReturn.player?.y ?? 0;
    let playerAngle = stateToReturn.player?.angle ?? -Math.PI / 2; // Default angle

    const stationId = currentGameState.lastDockedStationId; // Use last docked
    const station = stationId ? worldManager.getStationById(stationId) : null;

    if (station) {
      const undockDist =
        station.radius +
        (currentGameState.player?.radius ?? PLAYER_SIZE / 2) +
        20; // Distance to place player away
      const exitAngle = station.angle + Math.PI; // Exit opposite docking bay
      playerX = station.x + Math.cos(exitAngle) * undockDist;
      playerY = station.y + Math.sin(exitAngle) * undockDist;
      playerAngle = exitAngle; // Point player away from station
    }

    let updatedPlayer = stateToReturn.player;
    if (!(updatedPlayer instanceof Player) && updatedPlayer) {
      // Recreate if needed
      const shieldLevel = currentGameState.shieldCapacitorLevel;
      updatedPlayer = createPlayer(playerX, playerY, shieldLevel);
    } else if (!updatedPlayer) {
      // Create if missing entirely
      const shieldLevel = currentGameState.shieldCapacitorLevel;
      updatedPlayer = createPlayer(playerX, playerY, shieldLevel);
    }

    // Ensure position, velocity, and angle are set correctly after undocking
    updatedPlayer.x = playerX;
    updatedPlayer.y = playerY;
    updatedPlayer.vx = 0;
    updatedPlayer.vy = 0;
    updatedPlayer.angle = playerAngle;
    updatedPlayer.shieldLevel = updatedPlayer.maxShield; // Top up shield on undock

    return {
      ...stateToReturn,
      player: updatedPlayer,
      gameView: "playing", // Back to playing
      dockingStationId: null, // Clear docking ID
      market: null, // Clear market
      animationState: {
        // Ensure animation state is fully reset
        ...stateToReturn.animationState,
        type: null,
        progress: 0,
      },
    };
  }
  // Player Destruction
  else if (currentView === "playing" && nextView === "destroyed") {
    console.log(
      "[calculateNextGameState] Detected destruction transition from logic."
    );
    // Logic already set gameView to 'destroyed' and respawn timer.
    // We might clear projectiles/enemies here for immediate effect.
    return { ...stateToReturn, projectiles: [], enemies: [] };
  }
  // Player Respawn
  else if (currentView === "destroyed" && nextView === "playing") {
    console.log(
      "[calculateNextGameState] Detected respawn completion from logic."
    );
    // Logic handled placing the player and setting the view back to 'playing'.
    // stateToReturn should already have the correct state from updateGameStateLogic.
    return stateToReturn;
  }

  // --- Final State Check (Win Condition) ---
  // Check win condition based on the *potentially modified* quest state
  const finalScore = questEngine.calculateQuestCompletion(
    "freedom_v01",
    stateToReturn.questState // Use the state we are about to return
  );
  if (finalScore >= 100 && stateToReturn.gameView !== "won") {
    console.log(
      "[calculateNextGameState] WIN CONDITION MET (End of Frame)! Emancipation Score >= 100%"
    );
    // Ensure player velocity is zeroed on win? Optional.
    let finalPlayer = stateToReturn.player;
    if (finalPlayer instanceof Player) {
      finalPlayer.vx = 0;
      finalPlayer.vy = 0;
    } else if (finalPlayer) {
      finalPlayer = { ...finalPlayer, vx: 0, vy: 0 };
    }
    return { ...stateToReturn, player: finalPlayer, gameView: "won" };
  }

  // If no major transition occurred, return the final updated state from logic/beacon checks
  return stateToReturn;
};
