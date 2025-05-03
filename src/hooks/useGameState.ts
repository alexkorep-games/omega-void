// src/hooks/useGameState.ts
import { useCallback, useMemo, useRef } from "react";
import { atom, useAtom } from "jotai";
import {
  IGameState,
  ITouchState,
  IStation,
  GameView,
  IPlayer,
  IPosition,
  CommodityTable,
  CargoHold,
  QuestInventory,
} from "../game/types";
import { initialGameState } from "../game/state";
import { updateGameStateLogic, createPlayer } from "../game/logic";
import { InfiniteWorldManager } from "../game/world/InfiniteWorldManager";
import { loadGameState, saveGameState, SaveData } from "../utils/storage"; // Import SaveData type
import {
  SAVE_STATE_INTERVAL,
  DEFAULT_STARTING_SHIELD,
  GAME_WIDTH,
  GAME_VIEW_HEIGHT,
  PLAYER_SIZE,
} from "../game/config";
import { Player } from "../game/entities/Player";
import { MarketGenerator, MarketSnapshot } from "../game/Market";
import { distance } from "../utils/geometry";
import {
  QuestEngine,
  GameEvent,
  V01_QUEST_DEFINITIONS,
  QuestItemId,
  initialQuestState,
} from "../quests";
import { FIXED_STATIONS } from "../game/world/FixedStations";

const WORLD_SEED = 12345;

export type UpgradeKey =
  | "cargoPod"
  | "shieldCapacitor"
  | "engineBooster"
  | "autoloader"
  | "navComputer";

export const UPGRADE_CONFIG: Record<
  UpgradeKey,
  {
    maxLevel: number;
    costs: number[];
    name: string;
    effectDesc: string;
  }
> = {
  cargoPod: {
    maxLevel: 4,
    costs: [1000, 2500, 5000, 10000],
    name: "Cargo Pods",
    effectDesc: "+5t Hold / Level",
  },
  shieldCapacitor: {
    maxLevel: 3,
    costs: [2000, 5000, 12000],
    name: "Shield Capacitor",
    effectDesc: "+25% Max Shield / Level",
  },
  engineBooster: {
    maxLevel: 3,
    costs: [3000, 7000, 15000],
    name: "Engine Booster",
    effectDesc: "+20% Speed / Level",
  },
  autoloader: {
    maxLevel: 1,
    costs: [8000],
    name: "Autoloader",
    effectDesc: "Halves weapon cooldown",
  },
  navComputer: {
    maxLevel: 1,
    costs: [500],
    name: "Nav Computer",
    effectDesc: "Shows distance to Nav Target",
  },
};

// Map beacon IDs to their corresponding quest objective IDs for direct update
const beaconToReachObjectiveMap: Record<string, string> = {
  beacon_nw_key1: "reach_beacon_nw",
  beacon_ne_key2: "reach_beacon_ne",
  beacon_sw_key3: "reach_beacon_sw", // Assuming this maps to sw
  beacon_se_key4: "reach_beacon_se", // Assuming this maps to se
};

const gameStateAtom = atom<IGameState>(initialGameState);
const questEngine = new QuestEngine(V01_QUEST_DEFINITIONS);

/**
 * Calculates the next game state based on the current state, time delta,
 * input, world state, and events.
 * This function encapsulates the core game update logic previously inside
 * the setGameStateInternal callback within updateGame.
 */
const calculateNextGameState = (
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
// --- End of Extracted Free Function ---

export function useGameState() {
  const [gameState, setGameStateInternal] = useAtom(gameStateAtom);
  const worldManager = useMemo(
    () => new InfiniteWorldManager({ fixedStations: FIXED_STATIONS }),
    []
  );
  const saveIntervalId = useRef<number | null>(null);

  const totalCargoCapacity = useMemo(() => {
    const cargoPodBonus = gameState.cargoPodLevel * 5; // Use cargoPodLevel from state
    return gameState.baseCargoCapacity + cargoPodBonus;
  }, [gameState.baseCargoCapacity, gameState.cargoPodLevel]); // Depend on cargoPodLevel

  const emancipationScore = useMemo(() => {
    if (!gameState.questState || !gameState.questState.quests["freedom_v01"]) {
      return 0;
    }
    // Ensure questEngine instance is used
    return questEngine.calculateQuestCompletion(
      "freedom_v01",
      gameState.questState
    );
  }, [gameState.questState]); // Dependency on gameState.questState

  const setGameView = useCallback(
    (newView: GameView) => {
      console.log(`Setting game view to: ${newView}`);
      setGameStateInternal((prev) => {
        if (prev.gameView === newView) return prev;
        // Preserve viewTargetStationId only when switching to 'station_details'
        const nextViewTargetStationId =
          newView === "station_details" ? prev.viewTargetStationId : null;
        console.log(`Game view updated to: ${newView}`);
        return {
          ...prev,
          gameView: newView,
          viewTargetStationId: nextViewTargetStationId,
          // Reset docking/undocking animation if manually changing view
          animationState:
            newView === "playing" || newView === "trade_select"
              ? { ...prev.animationState, type: null, progress: 0 }
              : prev.animationState,
        };
      });
    },
    [setGameStateInternal]
  );

  const setViewTargetStationId = useCallback(
    (stationId: string | null) => {
      setGameStateInternal((prev) => {
        if (prev.viewTargetStationId === stationId) return prev;
        return { ...prev, viewTargetStationId: stationId };
      });
    },
    [setGameStateInternal]
  );

  const setNavTarget = useCallback(
    (stationId: string | null) => {
      console.log(`Setting nav target to: ${stationId}`);
      setGameStateInternal((prev) => {
        if (prev.navTargetStationId === stationId) return prev;
        // Reset related nav fields when changing target
        return {
          ...prev,
          navTargetStationId: stationId,
          navTargetDirection: null,
          navTargetCoordinates: null,
          navTargetDistance: null,
        };
      });
    },
    [setGameStateInternal]
  );

  // --- Declare emitQuestEvent FIRST ---
  const emitQuestEvent = useCallback(
    (event: GameEvent) => {
      // Note: This function now handles the state update logic for quests.
      // Calls to this should *not* be wrapped in setTimeout externally anymore
      // unless specific delayed execution is needed for reasons other than state updates.
      setGameStateInternal((prevState) => {
        // Basic guards
        if (!prevState.player || !prevState.questState) {
          console.warn(
            "emitQuestEvent called before player/quest state initialized."
          );
          return prevState;
        }
        // Prepare context for quest engine (could be extended)
        const currentContextState = { ...prevState };

        // Get the next quest state from the engine
        const nextQuestState = questEngine.update(
          prevState.questState,
          event,
          currentContextState // Pass current game state as context
        );

        // Only update if the quest state actually changed
        if (nextQuestState !== prevState.questState) {
          // Check for win condition *after* quest update
          const newScore = questEngine.calculateQuestCompletion(
            "freedom_v01",
            nextQuestState
          );
          const isWon = newScore >= 100;
          // Transition to 'won' view if condition met and not already there
          const newGameView =
            isWon && prevState.gameView !== "won" ? "won" : prevState.gameView;

          if (newGameView === "won" && prevState.gameView !== "won") {
            console.log(
              "[emitQuestEvent] WIN CONDITION MET! Emancipation Score >= 100%"
            );
          }

          // Return the updated state
          return {
            ...prevState,
            questState: nextQuestState,
            gameView: newGameView, // Update game view if win condition met
          };
        }

        // If quest state didn't change, return the previous state
        return prevState;
      });
    },
    [setGameStateInternal] // Dependency on setGameStateInternal
  );

  // --- Declare functions that DEPEND on emitQuestEvent ---
  const updatePlayerState = useCallback(
    (updater: (prevState: IGameState) => Partial<IGameState>) => {
      setGameStateInternal((prev) => {
        const changes = updater(prev);
        const nextState = { ...prev, ...changes };

        // Ensure player state is merged correctly if player object is partially updated
        if (
          changes.player &&
          typeof changes.player === "object" &&
          prev.player
        ) {
          nextState.player = {
            ...(prev.player as IPlayer), // Cast for type safety, assuming prev.player exists
            ...(changes.player as Partial<IPlayer>),
          };
        }

        // Check for cash changes and emit event
        if (changes.cash !== undefined && changes.cash !== prev.cash) {
          const delta = changes.cash - prev.cash;
          // Use emitQuestEvent directly (it handles async state update)
          emitQuestEvent({
            type: "CREDITS_CHANGE",
            delta,
            total: changes.cash as number,
          });
        }

        // Check for cargoHold changes (using Record)
        if (changes.cargoHold && changes.cargoHold !== prev.cargoHold) {
          const prevCargo = prev.cargoHold;
          const nextCargo = changes.cargoHold as CargoHold; // Assert type

          // Detect added items
          Object.entries(nextCargo).forEach(([key, qty]) => {
            const prevQty = prevCargo[key] || 0;
            if (qty > prevQty) {
              emitQuestEvent({
                type: "ITEM_ACQUIRED",
                itemId: key,
                quantity: qty - prevQty,
                method: "buy", // Assuming default method, adjust if needed
              });
            }
          });

          // Detect removed items
          Object.entries(prevCargo).forEach(([key, qty]) => {
            const nextQty = nextCargo[key] || 0;
            if (qty > nextQty) {
              emitQuestEvent({
                type: "ITEM_REMOVED",
                itemId: key,
                quantity: qty - nextQty,
                method: "sell", // Assuming default method, adjust if needed
              });
            }
          });
        }
        // Return the merged state
        return nextState;
      });
    },
    [setGameStateInternal, emitQuestEvent] // Include emitQuestEvent dependency
  );

  const addQuestItem = useCallback(
    (itemId: QuestItemId, quantity: number = 1) => {
      setGameStateInternal((prev) => {
        // Ensure questInventory exists
        if (!prev.questInventory) {
          console.warn(
            "Attempted to add quest item, but inventory doesn't exist."
          );
          return prev;
        }
        const currentCount = prev.questInventory[itemId] || 0;
        // Create a new inventory object for immutability
        const newInventory: QuestInventory = {
          ...prev.questInventory,
          [itemId]: currentCount + quantity,
        };
        // Emit event *after* calculating new state
        emitQuestEvent({
          type: "ITEM_ACQUIRED",
          itemId,
          quantity,
          method: "reward", // Or other appropriate method
        });
        console.log(
          `Added quest item: ${itemId} (x${quantity}). New total: ${newInventory[itemId]}`
        );
        // Return state with the new inventory
        return { ...prev, questInventory: newInventory };
      });
    },
    [setGameStateInternal, emitQuestEvent] // Include emitQuestEvent dependency
  );

  const removeQuestItem = useCallback(
    (itemId: QuestItemId, quantity: number = 1): boolean => {
      let success = false; // Flag to return success/failure
      setGameStateInternal((prev) => {
        // Ensure questInventory exists
        if (!prev.questInventory) {
          console.warn(
            "Attempted to remove quest item, but inventory doesn't exist."
          );
          success = false;
          return prev;
        }
        const currentCount = prev.questInventory[itemId] || 0;
        if (currentCount < quantity) {
          console.warn(
            `Cannot remove quest item ${itemId}: Have ${currentCount}, need ${quantity}`
          );
          success = false;
          return prev; // Return previous state if not enough items
        }

        // Create a new inventory object for immutability
        const newInventory: QuestInventory = { ...prev.questInventory };
        const newCount = currentCount - quantity;

        if (newCount <= 0) {
          delete newInventory[itemId]; // Remove key if count is zero or less
        } else {
          newInventory[itemId] = newCount; // Update count
        }

        success = true; // Mark as successful
        // Emit event *after* calculating new state
        emitQuestEvent({
          type: "ITEM_REMOVED",
          itemId,
          quantity,
          method: "consumed", // Or other appropriate method
        });
        console.log(
          `Removed quest item: ${itemId} (x${quantity}). New total: ${
            newInventory[itemId] ?? 0 // Use ?? 0 for display if key was deleted
          }`
        );
        // Return state with the new inventory
        return { ...prev, questInventory: newInventory };
      });
      return success; // Return the success flag determined within the state update
    },
    [setGameStateInternal, emitQuestEvent] // Include emitQuestEvent dependency
  );

  const purchaseUpgrade = useCallback(
    (upgradeKey: UpgradeKey): boolean => {
      let purchased = false; // Flag to return purchase success
      setGameStateInternal((prev) => {
        const config = UPGRADE_CONFIG[upgradeKey];
        if (!config) {
          console.error(`Invalid upgrade key: ${upgradeKey}`);
          return prev;
        }

        let currentLevel = 0;
        // Determine current level based on upgrade key
        switch (upgradeKey) {
          case "cargoPod":
            currentLevel = prev.cargoPodLevel;
            break;
          case "shieldCapacitor":
            currentLevel = prev.shieldCapacitorLevel;
            break;
          case "engineBooster":
            currentLevel = prev.engineBoosterLevel;
            break;
          case "autoloader":
            currentLevel = prev.hasAutoloader ? 1 : 0;
            break;
          case "navComputer":
            currentLevel = prev.hasNavComputer ? 1 : 0;
            break;
          default:
            console.error(
              `Unhandled upgrade key in level check: ${upgradeKey}`
            );
            return prev;
        }

        // Check max level
        if (currentLevel >= config.maxLevel) {
          console.log(
            `Upgrade ${upgradeKey} already at max level (${config.maxLevel}).`
          );
          return prev;
        }

        // Check cost
        const cost = config.costs[currentLevel]; // Cost for the *next* level
        if (prev.cash < cost) {
          console.log(
            `Insufficient cash for ${upgradeKey}. Need ${cost}, have ${prev.cash}`
          );
          return prev;
        }

        // --- Purchase successful ---
        purchased = true; // Set flag
        const updatedState = { ...prev }; // Copy state for modification
        updatedState.cash -= cost; // Deduct cash

        const nextLevel = currentLevel + 1;

        // Apply upgrade effect
        switch (upgradeKey) {
          case "cargoPod":
            updatedState.cargoPodLevel = nextLevel;
            // totalCargoCapacity is derived via useMemo, no direct state update needed
            break;
          case "shieldCapacitor":
            updatedState.shieldCapacitorLevel = nextLevel;
            if (updatedState.player) {
              const baseShield = DEFAULT_STARTING_SHIELD;
              const newMaxShield = baseShield * (1 + nextLevel * 0.25); // Calculate new max based on level
              // Ensure player object is updated immutably
              updatedState.player = {
                ...updatedState.player,
                maxShield: newMaxShield,
                shieldLevel: newMaxShield, // Top up shield to new max on upgrade
              };
            }
            break;
          case "engineBooster":
            updatedState.engineBoosterLevel = nextLevel;
            // Speed factor is likely handled in player movement logic based on this level
            break;
          case "autoloader":
            updatedState.hasAutoloader = true;
            updatedState.shootCooldownFactor = 0.5; // Apply cooldown reduction
            break;
          case "navComputer":
            updatedState.hasNavComputer = true;
            // Nav computer functionality enabled elsewhere based on this flag
            break;
          default:
            console.error(
              `Unhandled upgrade key in effect application: ${upgradeKey}`
            );
            break; // Should not happen
        }

        // Emit quest event *after* calculating the new state
        emitQuestEvent({
          type: "SHIP_UPGRADED",
          upgradeId: upgradeKey,
          level: nextLevel,
        });

        console.log(
          `Purchased ${upgradeKey} Level ${nextLevel} for ${cost} CR.`
        );
        return updatedState; // Return the modified state
      });
      return purchased; // Return the success flag
    },
    [setGameStateInternal, emitQuestEvent] // Include emitQuestEvent dependency
  );

  // Update market quantity (using Record)
  const updateMarketQuantity = useCallback(
    (key: string, change: number) => {
      setGameStateInternal((prev) => {
        // Ensure market and its table exist
        if (!prev.market?.table) {
          console.warn(
            "Attempted to update market quantity, but market/table doesn't exist."
          );
          return prev;
        }

        const currentTable = prev.market.table; // This is a Record
        const currentState = currentTable[key]; // Direct access

        // Commodity not found in the current market
        if (!currentState) {
          console.warn(
            `Commodity key "${key}" not found in current market table.`
          );
          return prev;
        }

        // Create a *new* table object for immutability
        const newTable: CommodityTable = { ...currentTable };
        const newQuantity = Math.max(0, currentState.quantity + change); // Prevent negative quantity

        // Update the specific commodity in the new table (create new commodity state object)
        newTable[key] = { ...currentState, quantity: newQuantity };

        // Create a new MarketSnapshot with the updated table (preserve timestamp)
        const newMarket = new MarketSnapshot(prev.market.timestamp, newTable);

        // Return the updated game state
        return { ...prev, market: newMarket };
      });
    },
    [setGameStateInternal]
  );

  const completeDocking = useCallback(() => {
    // This function is now primarily handled within the state transition logic
    // inside calculateNextGameState when the docking animation finishes.
    // It remains here mostly for potential external triggers or legacy compatibility,
    // but the main logic (market generation, state change) happens there.
    console.warn(
      "Action: completeDocking called directly. Docking completion is usually handled by animation state transition in update loop."
    );
    // It might be safer to trigger the state change here if needed externally,
    // but currently, the logic relies on the animation finishing.
    // Example: setGameView('trade_select'); // But this wouldn't generate the market etc.
  }, []); // No dependencies needed if it does nothing or just logs

  const initiateUndocking = useCallback(() => {
    console.log("Action: Initiate Undocking");
    setGameStateInternal((prev) => {
      // Only allow undocking from a docked state
      if (
        prev.gameView !== "trade_select" &&
        prev.gameView !== "station_details"
      ) {
        console.warn(
          `Cannot initiate undocking from gameView: ${prev.gameView}`
        );
        return prev;
      }
      // Cannot undock if already undocking/docking
      if (prev.animationState.type !== null) {
        console.warn(
          `Cannot initiate undocking during animation: ${prev.animationState.type}`
        );
        return prev;
      }
      return {
        ...prev,
        gameView: "undocking", // Set view to undocking state
        market: null, // Clear market data on undock initiation
        viewTargetStationId: null, // Clear station view target
        animationState: {
          type: "undocking",
          progress: 0,
          duration: prev.animationState.duration, // Use existing duration
        },
      };
    });
  }, [setGameStateInternal]);

  const findStationById = useCallback(
    (stationId: string | null): IStation | null => {
      if (!stationId) return null;
      // Use the memoized worldManager instance
      return worldManager.getStationById(stationId);
    },
    [worldManager] // Dependency on worldManager
  );

  // --- Initialization ---
  const initializeGameState = useCallback(() => {
    // Prevent re-initialization
    if (gameState.isInitialized) {
      console.log("Initialization skipped: Game state already initialized.");
      return () => {}; // Return empty cleanup function
    }

    console.log("Initializing game state...");
    const loadedData = loadGameState(); // Returns SaveData type

    // --- Prepare state based on loaded data or defaults ---

    // Validate loaded quest state and inventory
    const validQuestState =
      loadedData.questState &&
      typeof loadedData.questState === "object" &&
      loadedData.questState.quests
        ? loadedData.questState
        : initialQuestState; // Use initial if invalid/missing
    const validQuestInventory: QuestInventory =
      loadedData.questInventory && typeof loadedData.questInventory === "object"
        ? loadedData.questInventory
        : {}; // Default to empty Record if invalid/missing

    // Calculate initial derived values based on loaded upgrade levels
    const initialShootCooldownFactor = loadedData.hasAutoloader ? 0.5 : 1.0;

    // Create the player based on loaded data
    const loadedPlayer = createPlayer(
      loadedData.coordinates.x,
      loadedData.coordinates.y,
      loadedData.shieldCapacitorLevel // Pass shield level for correct maxShield calculation
    );
    // Ensure player starts with full shields based on loaded capacity
    loadedPlayer.shieldLevel = loadedPlayer.maxShield;

    // Calculate initial camera position based on loaded player position
    const initialCameraX = loadedData.coordinates.x - GAME_WIDTH / 2;
    const initialCameraY = loadedData.coordinates.y - GAME_VIEW_HEIGHT / 2;

    // --- Set the initial state using setGameStateInternal ---
    setGameStateInternal({
      ...initialGameState, // Start with base defaults to ensure all keys exist

      // Overwrite with loaded data
      player: loadedPlayer,
      cash: loadedData.cash,
      cargoHold: loadedData.cargoHold ?? {}, // Ensure cargoHold is an object
      lastDockedStationId: loadedData.lastDockedStationId,
      discoveredStations: loadedData.discoveredStations ?? [],
      knownStationPrices: loadedData.knownStationPrices ?? {},

      // Load upgrades
      cargoPodLevel: loadedData.cargoPodLevel,
      shieldCapacitorLevel: loadedData.shieldCapacitorLevel,
      engineBoosterLevel: loadedData.engineBoosterLevel,
      hasAutoloader: loadedData.hasAutoloader,
      hasNavComputer: loadedData.hasNavComputer,

      // Set derived/calculated values based on upgrades
      shootCooldownFactor: initialShootCooldownFactor,
      // Note: totalCargoCapacity is derived via useMemo, not stored directly

      // Load quest state
      questState: validQuestState,
      questInventory: validQuestInventory,

      // --- Set runtime/transient state ---
      isInitialized: true, // Mark as initialized
      gameView: "playing", // Start in playing view after load
      enemies: [], // Start with no enemies
      projectiles: [], // Start with no projectiles
      visibleBackgroundObjects: [], // Start with no visible objects (will be populated)
      camera: { x: initialCameraX, y: initialCameraY },
      dockingStationId: null, // Not docking on load
      animationState: {
        ...initialGameState.animationState,
        type: null,
        progress: 0,
      }, // Reset animation
      respawnTimer: 0, // No respawn active
      market: null, // No market loaded initially
      navTargetStationId: null, // No nav target initially
      navTargetDirection: null,
      navTargetCoordinates: null,
      navTargetDistance: null,
      viewTargetStationId: null, // No station view target initially
      lastEnemySpawnTime: 0, // Reset timers
      lastShotTime: 0,
      enemyIdCounter: 0, // Reset counter

      // Ensure base capacity is explicitly set from initial state if needed
      baseCargoCapacity: initialGameState.baseCargoCapacity,
      // extraCargoCapacity is derived and shouldn't be set here
    });

    console.log("Game state initialized from saved data (or defaults).");

    // --- Start Auto-Save Interval ---
    if (saveIntervalId.current) {
      clearInterval(saveIntervalId.current); // Clear any existing interval
      console.log("Cleared previous save interval.");
    }
    saveIntervalId.current = setInterval(() => {
      // Use setGameStateInternal to access the *latest* state for saving
      // This avoids stale closure issues with gameState variable
      setGameStateInternal((currentSyncState) => {
        // Ensure player coords are valid before saving
        if (
          currentSyncState.player &&
          typeof currentSyncState.player.x === "number" &&
          typeof currentSyncState.player.y === "number"
        ) {
          // Construct the SaveData object correctly from the latest state
          const dataToSave: SaveData = {
            coordinates: {
              x: currentSyncState.player.x,
              y: currentSyncState.player.y,
            },
            cash: currentSyncState.cash,
            cargoHold: currentSyncState.cargoHold,
            lastDockedStationId: currentSyncState.lastDockedStationId,
            discoveredStations: currentSyncState.discoveredStations,
            knownStationPrices: currentSyncState.knownStationPrices,
            // Save upgrades
            cargoPodLevel: currentSyncState.cargoPodLevel,
            shieldCapacitorLevel: currentSyncState.shieldCapacitorLevel,
            engineBoosterLevel: currentSyncState.engineBoosterLevel,
            hasAutoloader: currentSyncState.hasAutoloader,
            hasNavComputer: currentSyncState.hasNavComputer,
            // Save quest progress
            questState: currentSyncState.questState,
            questInventory: currentSyncState.questInventory,
          };
          saveGameState(dataToSave);
          // console.log("Game state auto-saved."); // Optional: for debugging
        } else {
          console.warn(
            "Attempted to auto-save state but player data was invalid or missing."
          );
        }
        // IMPORTANT: Return the state unmodified because this is just for reading
        return currentSyncState;
      });
    }, SAVE_STATE_INTERVAL);

    console.log(`Auto-save interval started (${SAVE_STATE_INTERVAL}ms).`);

    // Return cleanup function for the interval when the component unmounts or hook re-runs
    return () => {
      if (saveIntervalId.current) {
        clearInterval(saveIntervalId.current);
        console.log("Cleaned up auto-save interval.");
        saveIntervalId.current = null;
      }
    };
  }, [setGameStateInternal, gameState.isInitialized]); // Dependencies: setGameStateInternal and isInitialized flag

  // --- Define updateGame AFTER its dependencies ---
  const updateGame = useCallback(
    (
      deltaTime: number,
      now: number,
      currentTouchState: ITouchState | undefined
    ) => {
      // Use the extracted function within setGameStateInternal's callback
      setGameStateInternal((currentGameState) =>
        calculateNextGameState(
          currentGameState,
          deltaTime,
          now,
          currentTouchState,
          worldManager, // Pass worldManager from hook's scope
          emitQuestEvent // Pass emitQuestEvent from hook's scope
        )
      );
    },
    // Dependencies: setGameStateInternal (for state updates),
    // worldManager (passed to logic), emitQuestEvent (passed to logic)
    [setGameStateInternal, worldManager, emitQuestEvent]
  );

  // --- Restart Game ---
  const startNewGame = useCallback(() => {
    console.log("Action: Starting New Game...");

    // Stop existing save interval immediately
    if (saveIntervalId.current) {
      clearInterval(saveIntervalId.current);
      saveIntervalId.current = null;
      console.log("Stopped existing auto-save interval for new game.");
    }

    // Define default starting values clearly
    const defaultPosition: IPosition = { x: 0, y: 0 };
    const defaultCash = initialGameState.cash; // Use value from initialGameState
    const defaultCargo: CargoHold = {}; // Empty Record
    const defaultLastDocked: string | null = null;
    const defaultDiscoveredStations: string[] = [];
    const defaultQuestState = initialQuestState; // Use initialQuestState definition
    const defaultQuestInventory: QuestInventory = {}; // Empty Record
    const defaultKnownPrices: Record<string, Record<string, number>> = {};

    // Create a new player instance for the new game
    const newPlayer = createPlayer(defaultPosition.x, defaultPosition.y, 0); // 0 initial shield level

    // --- Reset state to initial values using setGameStateInternal ---
    setGameStateInternal((prev) => ({
      // Access previous state only for non-reset values like duration
      ...initialGameState, // Start with base initial state

      // Explicitly set core game progress fields to defaults
      player: newPlayer,
      cash: defaultCash,
      cargoHold: defaultCargo,
      lastDockedStationId: defaultLastDocked,
      discoveredStations: defaultDiscoveredStations,
      knownStationPrices: defaultKnownPrices,

      // Reset upgrades to level 0 / false
      cargoPodLevel: 0,
      shieldCapacitorLevel: 0,
      engineBoosterLevel: 0,
      hasAutoloader: false,
      hasNavComputer: false,
      // Reset derived upgrade effects
      shootCooldownFactor: 1.0,

      // Reset quest progress
      questState: defaultQuestState,
      questInventory: defaultQuestInventory,

      // --- Reset runtime/transient state ---
      gameView: "playing", // Start playing immediately
      isInitialized: true, // Mark as initialized
      enemies: [],
      projectiles: [],
      visibleBackgroundObjects: [],
      camera: {
        x: defaultPosition.x - GAME_WIDTH / 2,
        y: defaultPosition.y - GAME_VIEW_HEIGHT / 2,
      }, // Center camera
      dockingStationId: null,
      animationState: {
        type: null, // Reset animation
        progress: 0,
        duration: prev.animationState.duration, // Keep existing duration setting
      },
      respawnTimer: 0,
      market: null,
      navTargetStationId: null,
      navTargetDirection: null,
      navTargetCoordinates: null,
      navTargetDistance: null,
      viewTargetStationId: null,
      lastEnemySpawnTime: 0,
      lastShotTime: 0,
      enemyIdCounter: 0,
    }));

    console.log("Game state reset to defaults for new game.");

    // --- Immediately save the new default state ---
    const newGameSaveData: SaveData = {
      coordinates: defaultPosition,
      cash: defaultCash,
      cargoHold: defaultCargo,
      lastDockedStationId: defaultLastDocked,
      discoveredStations: defaultDiscoveredStations,
      knownStationPrices: defaultKnownPrices,
      // Save default upgrades
      cargoPodLevel: 0,
      shieldCapacitorLevel: 0,
      engineBoosterLevel: 0,
      hasAutoloader: false,
      hasNavComputer: false,
      // Save default quest state
      questState: defaultQuestState,
      questInventory: defaultQuestInventory,
    };
    saveGameState(newGameSaveData);
    console.log("Initial state for new game saved.");

    // --- Restart the save interval ---
    saveIntervalId.current = setInterval(() => {
      // Use setGameStateInternal again to access latest state for saving
      setGameStateInternal((currentSyncState) => {
        if (
          currentSyncState.player &&
          typeof currentSyncState.player.x === "number"
        ) {
          const dataToSave: SaveData = {
            coordinates: {
              x: currentSyncState.player.x,
              y: currentSyncState.player.y,
            },
            cash: currentSyncState.cash,
            cargoHold: currentSyncState.cargoHold,
            lastDockedStationId: currentSyncState.lastDockedStationId,
            discoveredStations: currentSyncState.discoveredStations,
            knownStationPrices: currentSyncState.knownStationPrices,
            // upgrades
            cargoPodLevel: currentSyncState.cargoPodLevel,
            shieldCapacitorLevel: currentSyncState.shieldCapacitorLevel,
            engineBoosterLevel: currentSyncState.engineBoosterLevel,
            hasAutoloader: currentSyncState.hasAutoloader,
            hasNavComputer: currentSyncState.hasNavComputer,
            // quests
            questState: currentSyncState.questState,
            questInventory: currentSyncState.questInventory,
          };
          saveGameState(dataToSave);
          // console.log("New game state auto-saved.");
        }
        return currentSyncState; // Return unmodified state
      });
    }, SAVE_STATE_INTERVAL);
    console.log(
      `Auto-save interval restarted for new game (${SAVE_STATE_INTERVAL}ms).`
    );
  }, [setGameStateInternal]); // Dependency on setGameStateInternal

  // --- Return Hook API ---
  return {
    initializeGameState,
    gameState, // The current state snapshot
    updateGame, // The function to advance the game state
    isInitialized: gameState.isInitialized, // Convenience flag
    // Actions / State Changers
    completeDocking, // (Note: might be deprecated by internal logic)
    initiateUndocking,
    setGameView,
    setViewTargetStationId,
    setNavTarget,
    updatePlayerState, // For general player/cash/cargo updates
    updateMarketQuantity, // For market interaction
    startNewGame,
    purchaseUpgrade,
    // Selectors / Data Accessors
    findStationById,
    totalCargoCapacity, // Derived value
    // Quest related exports
    emitQuestEvent, // For triggering quest events
    addQuestItem,
    removeQuestItem,
    questEngine: questEngine, // Expose the engine instance (e.g., for UI display)
    emancipationScore, // Derived quest score
  };
}
