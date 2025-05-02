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
    return questEngine.calculateQuestCompletion(
      "freedom_v01",
      gameState.questState
    );
  }, [gameState.questState]);

  const setGameView = useCallback(
    (newView: GameView) => {
      console.log(`Setting game view to: ${newView}`);
      setGameStateInternal((prev) => {
        if (prev.gameView === newView) return prev;
        const nextViewTargetStationId =
          newView === "station_details" ? prev.viewTargetStationId : null;
        console.log(`Game view updated to: ${newView}`);
        return {
          ...prev,
          gameView: newView,
          viewTargetStationId: nextViewTargetStationId,
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
        return { ...prev, navTargetStationId: stationId };
      });
    },
    [setGameStateInternal]
  );

  // --- Declare emitQuestEvent FIRST ---
  const emitQuestEvent = useCallback(
    (event: GameEvent) => {
      setGameStateInternal((prevState) => {
        if (!prevState.player || !prevState.questState) return prevState;
        const currentContextState = { ...prevState };
        const nextQuestState = questEngine.update(
          prevState.questState,
          event,
          currentContextState
        );
        if (nextQuestState !== prevState.questState) {
          const newScore = questEngine.calculateQuestCompletion(
            "freedom_v01",
            nextQuestState
          );
          const isWon = newScore >= 100;
          const newGameView =
            isWon && prevState.gameView !== "won" ? "won" : prevState.gameView;
          if (newGameView === "won" && prevState.gameView !== "won") {
            console.log("WIN CONDITION MET! Emancipation Score >= 100%");
          }
          return {
            ...prevState,
            questState: nextQuestState,
            gameView: newGameView,
          };
        }
        return prevState;
      });
    },
    [setGameStateInternal]
  );

  // --- Declare functions that DEPEND on emitQuestEvent ---
  const updatePlayerState = useCallback(
    (updater: (prevState: IGameState) => Partial<IGameState>) => {
      setGameStateInternal((prev) => {
        const changes = updater(prev);
        const nextState = { ...prev, ...changes };

        // Ensure player state is merged correctly
        if (changes.player && typeof changes.player === "object") {
          nextState.player = {
            ...(prev.player as IPlayer),
            ...(changes.player as Partial<IPlayer>),
          };
        }

        // Check for cash changes
        if (changes.cash !== undefined && changes.cash !== prev.cash) {
          const delta = changes.cash - prev.cash;
          setTimeout(
            () =>
              emitQuestEvent({
                type: "CREDITS_CHANGE",
                delta,
                total: changes.cash as number,
              }),
            0
          );
        }

        // Check for cargoHold changes (using Record)
        if (changes.cargoHold && changes.cargoHold !== prev.cargoHold) {
          const prevCargo = prev.cargoHold;
          const nextCargo = changes.cargoHold; // This is already a Record

          // Detect added items
          Object.entries(nextCargo).forEach(([key, qty]) => {
            const prevQty = prevCargo[key] || 0;
            if (qty > prevQty) {
              setTimeout(
                () =>
                  emitQuestEvent({
                    type: "ITEM_ACQUIRED",
                    itemId: key,
                    quantity: qty - prevQty,
                    method: "buy", // Assuming default method, adjust if needed
                  }),
                0
              );
            }
          });

          // Detect removed items
          Object.entries(prevCargo).forEach(([key, qty]) => {
            const nextQty = nextCargo[key] || 0;
            if (qty > nextQty) {
              setTimeout(
                () =>
                  emitQuestEvent({
                    type: "ITEM_REMOVED",
                    itemId: key,
                    quantity: qty - nextQty,
                    method: "sell", // Assuming default method, adjust if needed
                  }),
                0
              );
            }
          });
        }
        return nextState;
      });
    },
    [setGameStateInternal, emitQuestEvent]
  ); // emitQuestEvent is now defined

  const addQuestItem = useCallback(
    (itemId: QuestItemId, quantity: number = 1) => {
      setGameStateInternal((prev) => {
        const currentCount = prev.questInventory[itemId] || 0;
        const newInventory: QuestInventory = {
          ...prev.questInventory,
          [itemId]: currentCount + quantity,
        }; // Works directly with Record
        setTimeout(
          () =>
            emitQuestEvent({
              type: "ITEM_ACQUIRED",
              itemId,
              quantity,
              method: "reward",
            }),
          0
        );
        console.log(
          `Added quest item: ${itemId} (x${quantity}). New total: ${newInventory[itemId]}`
        );
        return { ...prev, questInventory: newInventory };
      });
    },
    [setGameStateInternal, emitQuestEvent]
  ); // emitQuestEvent is now defined

  const removeQuestItem = useCallback(
    (itemId: QuestItemId, quantity: number = 1): boolean => {
      let success = false;
      setGameStateInternal((prev) => {
        const currentCount = prev.questInventory[itemId] || 0;
        if (currentCount < quantity) {
          console.warn(
            `Cannot remove quest item ${itemId}: Have ${currentCount}, need ${quantity}`
          );
          success = false;
          return prev;
        }
        const newInventory: QuestInventory = { ...prev.questInventory }; // Copy Record
        const newCount = currentCount - quantity;
        if (newCount <= 0) {
          delete newInventory[itemId]; // Remove key if count is zero or less
        } else {
          newInventory[itemId] = newCount; // Update count
        }
        success = true;
        setTimeout(
          () =>
            emitQuestEvent({
              type: "ITEM_REMOVED",
              itemId,
              quantity,
              method: "consumed",
            }),
          0
        );
        console.log(
          `Removed quest item: ${itemId} (x${quantity}). New total: ${
            newInventory[itemId] ?? 0
          }`
        );
        return { ...prev, questInventory: newInventory };
      });
      return success;
    },
    [setGameStateInternal, emitQuestEvent]
  ); // emitQuestEvent is now defined

  const purchaseUpgrade = useCallback(
    (upgradeKey: UpgradeKey): boolean => {
      let purchased = false;
      setGameStateInternal((prev) => {
        const config = UPGRADE_CONFIG[upgradeKey];
        if (!config) return prev;
        let currentLevel = 0;
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
        }
        if (currentLevel >= config.maxLevel) {
          console.log(`Upgrade ${upgradeKey} already at max level.`);
          return prev;
        }
        const cost = config.costs[currentLevel];
        if (prev.cash < cost) {
          console.log(
            `Insufficient cash for ${upgradeKey}. Need ${cost}, have ${prev.cash}`
          );
          return prev;
        }
        const updatedState = { ...prev };
        updatedState.cash -= cost;
        const nextLevel = currentLevel + 1;
        switch (upgradeKey) {
          case "cargoPod":
            updatedState.cargoPodLevel = nextLevel;
            // extraCargoCapacity is derived via useMemo, no need to set here
            break;
          case "shieldCapacitor":
            updatedState.shieldCapacitorLevel = nextLevel;
            if (updatedState.player) {
              // Create a new player object to ensure immutability
              const baseShield = DEFAULT_STARTING_SHIELD;
              const newMaxShield = baseShield * (1 + nextLevel * 0.25);
              updatedState.player = {
                ...updatedState.player,
                maxShield: newMaxShield,
                // Top up shield on upgrade to new max
                shieldLevel: newMaxShield,
              };
            }
            break;
          case "engineBooster":
            updatedState.engineBoosterLevel = nextLevel;
            break;
          case "autoloader":
            updatedState.hasAutoloader = true;
            updatedState.shootCooldownFactor = 0.5;
            break;
          case "navComputer":
            updatedState.hasNavComputer = true;
            break;
        }
        setTimeout(
          () =>
            emitQuestEvent({
              type: "SHIP_UPGRADED",
              upgradeId: upgradeKey,
              level: nextLevel,
            }),
          0
        );
        purchased = true;
        console.log(
          `Purchased ${upgradeKey} Level ${nextLevel} for ${cost} CR.`
        );
        return updatedState;
      });
      return purchased;
    },
    [setGameStateInternal, emitQuestEvent]
  ); // emitQuestEvent is now defined

  // Update market quantity (using Record)
  const updateMarketQuantity = useCallback(
    (key: string, change: number) => {
      setGameStateInternal((prev) => {
        if (!prev.market) return prev;

        const currentTable = prev.market.table; // This is a Record
        const currentState = currentTable[key]; // Direct access

        if (!currentState) return prev; // Commodity not in market

        // Create a *new* table object for immutability
        const newTable: CommodityTable = { ...currentTable };
        const newQuantity = Math.max(0, currentState.quantity + change);

        // Update the specific commodity in the new table
        newTable[key] = { ...currentState, quantity: newQuantity };

        // Create a new MarketSnapshot with the updated table
        const newMarket = new MarketSnapshot(prev.market.timestamp, newTable);
        return { ...prev, market: newMarket };
      });
    },
    [setGameStateInternal]
  );

  const completeDocking = useCallback(() => {
    // This function is now primarily handled within the updateGame state transition logic
    // It remains here mostly for potential external triggers if needed, but the main
    // logic (market generation, state change) happens in updateGame.
    console.log(
      "Action: Complete Docking (called, but logic handled in updateGame)"
    );
    // The actual state change to 'trade_select' and market generation
    // happens within the updateGame's docking completion check.
  }, []); // Keep dependencies minimal or empty if logic is fully moved

  const initiateUndocking = useCallback(() => {
    console.log("Action: Initiate Undocking");
    setGameStateInternal((prev) => ({
      ...prev,
      gameView: "undocking",
      market: null, // Clear market data on undock
      animationState: {
        type: "undocking",
        progress: 0,
        duration: prev.animationState.duration,
      },
    }));
  }, [setGameStateInternal]);

  const findStationById = useCallback(
    (stationId: string | null): IStation | null => {
      if (!stationId) return null;
      return worldManager.getStationById(stationId);
    },
    [worldManager]
  );

  // --- Initialization ---
  const initializeGameState = useCallback(() => {
    if (gameState.isInitialized) return;
    console.log("Initializing game state...");
    const loadedData = loadGameState(); // This now returns the SaveData type

    // Ensure loaded quest state and inventory are Records
    const validQuestState =
      loadedData.questState && typeof loadedData.questState.quests === "object"
        ? loadedData.questState
        : initialQuestState;
    const validQuestInventory: QuestInventory =
      loadedData.questInventory && typeof loadedData.questInventory === "object"
        ? loadedData.questInventory
        : {}; // Default to empty Record

    // Calculate initial derived values based on loaded upgrade levels
    // extraCargoCapacity is now derived via useMemo, no need to store/load
    const initialShootCooldownFactor = loadedData.hasAutoloader ? 0.5 : 1.0;

    setGameStateInternal(() => {
      const loadedPlayer = createPlayer(
        loadedData.coordinates.x,
        loadedData.coordinates.y,
        loadedData.shieldCapacitorLevel // Pass shield level for correct maxShield
      );
      // Ensure player starts with full shields based on loaded capacity
      loadedPlayer.shieldLevel = loadedPlayer.maxShield;

      return {
        ...initialGameState, // Start with base defaults to ensure all keys exist
        // Overwrite with loaded data
        player: loadedPlayer,
        cash: loadedData.cash,
        cargoHold: loadedData.cargoHold,
        lastDockedStationId: loadedData.lastDockedStationId,
        discoveredStations: loadedData.discoveredStations,
        knownStationPrices: loadedData.knownStationPrices,
        // Load upgrades
        cargoPodLevel: loadedData.cargoPodLevel,
        shieldCapacitorLevel: loadedData.shieldCapacitorLevel,
        engineBoosterLevel: loadedData.engineBoosterLevel,
        hasAutoloader: loadedData.hasAutoloader,
        hasNavComputer: loadedData.hasNavComputer,
        // Set derived values
        shootCooldownFactor: initialShootCooldownFactor,
        // Load quest state
        questState: validQuestState,
        questInventory: validQuestInventory,
        // Set initialization flag and reset transient state
        isInitialized: true,
        gameView: "playing", // Start in playing view after load
        enemies: [],
        projectiles: [],
        visibleBackgroundObjects: [],
        camera: {
          // Calculate initial camera based on loaded position
          x: loadedData.coordinates.x - GAME_WIDTH / 2,
          y: loadedData.coordinates.y - GAME_VIEW_HEIGHT / 2,
        },
        dockingStationId: null,
        animationState: { ...initialGameState.animationState },
        respawnTimer: 0,
        market: null,
        navTargetStationId: null,
        navTargetDirection: null,
        navTargetCoordinates: null,
        navTargetDistance: null,
        viewTargetStationId: null,
        lastEnemySpawnTime: 0, // Reset timers
        lastShotTime: 0,
        enemyIdCounter: 0,
        // Ensure base capacity is set (extra is derived)
        baseCargoCapacity: initialGameState.baseCargoCapacity,
        extraCargoCapacity: 0, // Will be calculated by totalCargoCapacity useMemo
      };
    });

    // Start save interval
    if (saveIntervalId.current) clearInterval(saveIntervalId.current);
    saveIntervalId.current = setInterval(() => {
      setGameStateInternal((currentSyncState) => {
        // Ensure player coords are valid before saving
        if (
          currentSyncState.player &&
          typeof currentSyncState.player.x === "number" &&
          typeof currentSyncState.player.y === "number"
        ) {
          // Construct the SaveData object correctly
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
            cargoPodLevel: currentSyncState.cargoPodLevel,
            shieldCapacitorLevel: currentSyncState.shieldCapacitorLevel,
            engineBoosterLevel: currentSyncState.engineBoosterLevel,
            hasAutoloader: currentSyncState.hasAutoloader,
            hasNavComputer: currentSyncState.hasNavComputer,
            questState: currentSyncState.questState,
            questInventory: currentSyncState.questInventory,
          };
          saveGameState(dataToSave);
        } else {
          console.warn("Attempted to save state but player data was invalid.");
        }
        return currentSyncState; // Return unmodified state
      });
    }, SAVE_STATE_INTERVAL);

    // Return cleanup function for the interval
    return () => {
      if (saveIntervalId.current) {
        clearInterval(saveIntervalId.current);
        console.log("Cleaned up save interval.");
        saveIntervalId.current = null;
      }
    };
  }, [setGameStateInternal, gameState.isInitialized]);

  // --- Define updateGame AFTER its dependencies ---
  const updateGame = useCallback(
    (
      deltaTime: number,
      now: number,
      currentTouchState: ITouchState | undefined
    ) => {
      setGameStateInternal((currentGameState) => {
        if (
          !currentGameState.isInitialized ||
          currentGameState.gameView === "won"
        )
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
              `Nav target station ${currentGameState.navTargetStationId} not found. Clearing navigation.`
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
            `[useGameState] Beacon Activation Detected: ${activatedBeaconId}`
          );
          const beacon = worldManager.getBeaconById(activatedBeaconId);

          // Check if beacon exists and is NOT already active in the world state
          if (beacon && !beacon.isActive) {
            console.log(
              `[useGameState] Beacon ${activatedBeaconId} is inactive, proceeding with direct quest update.`
            );
            worldManager.updateBeaconState(activatedBeaconId, true); // Update world state (visual)

            // --- Direct Quest State Modification ---
            const reachObjectiveId =
              beaconToReachObjectiveMap[activatedBeaconId];
            if (!reachObjectiveId) {
              console.warn(
                `[useGameState] No matching reach objective found for beacon ID: ${activatedBeaconId}`
              );
            } else {
              // Perform a deep clone of the quest state for safe modification
              const nextQuestState = structuredClone(
                currentGameState.questState
              ); // Use structuredClone for deep copy
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
                    `[useGameState] Marked objective ${reachObjectiveId} as done.`
                  );
                } else if (!reachObjective) {
                  console.warn(
                    `[useGameState] Objective ${reachObjectiveId} not found in quest state.`
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
                      `[useGameState] Marked objective beaconKeys as done (reached ${newCount}).`
                    );
                  } else {
                    console.log(
                      `[useGameState] Incremented beaconKeys count to ${newCount}.`
                    );
                  }
                } else if (!keysObjective) {
                  console.warn(
                    `[useGameState] Objective beaconKeys not found in quest state.`
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
                    `[useGameState] Beacon ${activatedBeaconId} processed, but no quest objectives needed updating (already done?).`
                  );
                }
              } else {
                console.warn(
                  `[useGameState] freedom_v01 quest progress not found.`
                );
              }
            }
            // --- End Direct Quest State Modification ---
          } else {
            console.log(
              `[useGameState] Beacon ${activatedBeaconId} already active or not found. Skipping direct quest update.`
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
          nextView === "playing"
        ) {
          console.log("Hook: Detected docking initiation signal.");
          let updatedPlayer = stateToReturn.player;
          if (updatedPlayer instanceof Player) {
            updatedPlayer.vx = 0;
            updatedPlayer.vy = 0;
          } else if (updatedPlayer) {
            updatedPlayer = createPlayer(
              updatedPlayer.x,
              updatedPlayer.y,
              currentGameState.shieldCapacitorLevel
            );
            updatedPlayer.angle =
              currentGameState.player?.angle ?? -Math.PI / 2;
            updatedPlayer.vx = 0;
            updatedPlayer.vy = 0;
            console.warn(
              "Player object not instance during docking initiation. Recreated."
            );
          }
          return {
            ...stateToReturn,
            player: updatedPlayer,
            gameView: "docking",
            animationState: {
              type: "docking",
              progress: 0,
              duration: currentGameState.animationState.duration,
            },
            market: null,
          };
        }
        // Docking Completion
        else if (
          currentView === "docking" &&
          currentGameState.animationState.type === "docking" &&
          stateToReturn.animationState.type === null
        ) {
          console.log("Hook: Detected docking animation completion.");
          const stationId = currentGameState.dockingStationId;
          const station = stationId
            ? worldManager.getStationById(stationId)
            : null;
          let newMarket: MarketSnapshot | null = null;
          const updatedDiscoveredStations = [
            ...currentGameState.discoveredStations,
          ];
          if (stationId && !updatedDiscoveredStations.includes(stationId)) {
            updatedDiscoveredStations.push(stationId);
          }
          if (station) {
            newMarket = MarketGenerator.generate(
              station,
              WORLD_SEED,
              Date.now()
            );
          }
          const newKnownPrices = { ...currentGameState.knownStationPrices };
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
            emitQuestEvent({ type: "DOCK_FINISH", stationId });
          }
          return {
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
        }
        // Undocking Completion
        else if (
          currentView === "undocking" &&
          currentGameState.animationState.type === "undocking" &&
          stateToReturn.animationState.type === null
        ) {
          console.log("Hook: Detected undocking animation completion.");
          let playerX = stateToReturn.player?.x ?? 0;
          let playerY = stateToReturn.player?.y ?? 0;
          let playerAngle = stateToReturn.player?.angle ?? -Math.PI / 2;
          const stationId = currentGameState.lastDockedStationId;
          const station = stationId
            ? worldManager.getStationById(stationId)
            : null;
          if (station) {
            const undockDist =
              station.radius +
              (currentGameState.player?.radius ?? PLAYER_SIZE / 2) +
              20;
            const exitAngle = station.angle + Math.PI;
            playerX = station.x + Math.cos(exitAngle) * undockDist;
            playerY = station.y + Math.sin(exitAngle) * undockDist;
            playerAngle = exitAngle;
          }
          let updatedPlayer = stateToReturn.player;
          if (!(updatedPlayer instanceof Player) && updatedPlayer) {
            updatedPlayer = createPlayer(
              playerX,
              playerY,
              currentGameState.shieldCapacitorLevel
            );
          } else if (!updatedPlayer) {
            updatedPlayer = createPlayer(
              playerX,
              playerY,
              currentGameState.shieldCapacitorLevel
            );
          }
          updatedPlayer.x = playerX;
          updatedPlayer.y = playerY;
          updatedPlayer.vx = 0;
          updatedPlayer.vy = 0;
          updatedPlayer.angle = playerAngle;
          return {
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
        // Player Destruction
        else if (currentView === "playing" && nextView === "destroyed") {
          console.log("Hook: Detected destruction transition from logic.");
          return { ...stateToReturn, projectiles: [], enemies: [] }; // Clear immediately
        }
        // Player Respawn
        else if (currentView === "destroyed" && nextView === "playing") {
          console.log("Hook: Detected respawn completion from logic.");
          return stateToReturn; // State is already set up by logic
        }

        // --- Final State Check (Win Condition) ---
        // Check win condition based on the *potentially modified* quest state
        const finalScore = questEngine.calculateQuestCompletion(
          "freedom_v01",
          stateToReturn.questState // Use the state we are about to return
        );
        if (finalScore >= 100 && stateToReturn.gameView !== "won") {
          console.log(
            "WIN CONDITION MET (End of Frame)! Emancipation Score >= 100%"
          );
          return { ...stateToReturn, gameView: "won" };
        }

        // If no major transition occurred, return the final updated state
        return stateToReturn;
      });
    },
    [setGameStateInternal, worldManager, emitQuestEvent]
  );

  // --- Restart Game ---
  const startNewGame = useCallback(() => {
    console.log("Action: Start New Game");
    // Stop existing save interval
    if (saveIntervalId.current) {
      clearInterval(saveIntervalId.current);
      saveIntervalId.current = null;
    }

    // Define default starting values
    const defaultPosition = { x: 0, y: 0 };
    const defaultCash = initialGameState.cash;
    const defaultCargo: CargoHold = {}; // Empty Record
    const defaultLastDocked = null;
    const defaultDiscoveredStations: string[] = [];
    const defaultQuestState = initialQuestState;
    const defaultQuestInventory: QuestInventory = {}; // Empty Record
    const defaultKnownPrices: Record<string, Record<string, number>> = {}; // Empty Prices Record

    // Reset state to initial values
    setGameStateInternal((prev) => ({
      ...initialGameState, // Base initial state
      player: createPlayer(defaultPosition.x, defaultPosition.y, 0), // New player at 0,0 with 0 shield upgrade
      cash: defaultCash,
      cargoHold: defaultCargo,
      lastDockedStationId: defaultLastDocked,
      discoveredStations: defaultDiscoveredStations,
      knownStationPrices: defaultKnownPrices,
      // Reset upgrades
      cargoPodLevel: 0,
      shieldCapacitorLevel: 0,
      engineBoosterLevel: 0,
      hasAutoloader: false,
      hasNavComputer: false,
      // extraCargoCapacity: 0, // Derived via useMemo
      shootCooldownFactor: 1.0,
      // Reset quests
      questState: defaultQuestState,
      questInventory: defaultQuestInventory,
      // Reset transient/runtime state
      gameView: "playing", // Start playing
      isInitialized: true, // Mark as initialized
      enemies: [],
      projectiles: [],
      visibleBackgroundObjects: [],
      camera: { x: 0 - GAME_WIDTH / 2, y: 0 - GAME_VIEW_HEIGHT / 2 }, // Center camera initially
      dockingStationId: null,
      animationState: {
        // Reset animation
        type: null,
        progress: 0,
        duration: prev.animationState.duration, // Keep duration
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

    // Immediately save the new default state
    const newGameSaveData: SaveData = {
      coordinates: defaultPosition,
      cash: defaultCash,
      cargoHold: defaultCargo,
      lastDockedStationId: defaultLastDocked,
      discoveredStations: defaultDiscoveredStations,
      knownStationPrices: defaultKnownPrices,
      cargoPodLevel: 0,
      shieldCapacitorLevel: 0,
      engineBoosterLevel: 0,
      hasAutoloader: false,
      hasNavComputer: false,
      questState: defaultQuestState,
      questInventory: defaultQuestInventory,
    };
    saveGameState(newGameSaveData);

    // Restart the save interval
    saveIntervalId.current = setInterval(() => {
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
            cargoPodLevel: currentSyncState.cargoPodLevel,
            shieldCapacitorLevel: currentSyncState.shieldCapacitorLevel,
            engineBoosterLevel: currentSyncState.engineBoosterLevel,
            hasAutoloader: currentSyncState.hasAutoloader,
            hasNavComputer: currentSyncState.hasNavComputer,
            questState: currentSyncState.questState,
            questInventory: currentSyncState.questInventory,
          };
          saveGameState(dataToSave);
        }
        return currentSyncState;
      });
    }, SAVE_STATE_INTERVAL);
  }, [setGameStateInternal]);

  // --- Return Hook API ---
  return {
    initializeGameState,
    gameState,
    updateGame,
    isInitialized: gameState.isInitialized,
    completeDocking,
    initiateUndocking,
    setGameView,
    setViewTargetStationId,
    setNavTarget,
    updatePlayerState,
    updateMarketQuantity,
    findStationById,
    startNewGame,
    purchaseUpgrade,
    totalCargoCapacity,
    // Quest related exports
    emitQuestEvent,
    addQuestItem,
    removeQuestItem,
    questEngine: questEngine, // Expose the engine instance
    emancipationScore,
  };
}
