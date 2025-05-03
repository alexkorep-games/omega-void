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
import {
  createPlayer,
  calculateNextGameState,
  questEngine,
} from "../game/logic";
import { InfiniteWorldManager } from "../game/world/InfiniteWorldManager";
import { loadGameState, saveGameState, SaveData } from "../utils/storage"; // Import SaveData type
import {
  SAVE_STATE_INTERVAL,
  DEFAULT_STARTING_SHIELD,
  GAME_WIDTH,
  GAME_VIEW_HEIGHT,
} from "../game/config";
import { MarketSnapshot } from "../game/Market";
import { GameEvent, QuestItemId, initialQuestState } from "../quests";
import { FIXED_STATIONS } from "../game/world/FixedStations";

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

const gameStateAtom = atom<IGameState>(initialGameState);

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
