// src/hooks/useGameState.ts
import { useCallback, useMemo, useRef, useEffect } from "react"; // Added useEffect
import { atom, useAtom } from "jotai";
import {
  IGameState,
  ITouchState,
  IStation,
  GameView,
  IPlayer,
  IPosition,
} from "../game/types"; // Added IPlayer, IPosition
import { initialGameState } from "../game/state"; // Still used for base structure
import { updateGameStateLogic, createPlayer } from "../game/logic";
import { InfiniteWorldManager } from "../game/world/InfiniteWorldManager";
import { loadGameState, saveGameState } from "../utils/storage"; // Use new functions
import {
  SAVE_STATE_INTERVAL,
  DEFAULT_STARTING_SHIELD,
  GAME_WIDTH,
  GAME_VIEW_HEIGHT,
  PLAYER_SIZE,
} from "../game/config"; // Added shield
import { Player } from "../game/entities/Player";
import {
  MarketGenerator,
  MarketSnapshot,
  CommodityState,
} from "../game/Market"; // Import Market components
import { distance } from "../utils/geometry"; // Import distance
// Import quest system components
import {
  QuestEngine,
  GameEvent,
  V01_QUEST_DEFINITIONS,
  QuestItemId,
  initialQuestState,
} from "../quests";
import { FIXED_STATIONS } from "../game/world/FixedStations"; // Import fixed stations

// Simple world seed for market generation for now
const WORLD_SEED = 12345;

// Define upgrade types and costs/max levels
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

/**
 * Hook to manage the overall game state, including entities, world, and updates.
 * It integrates the core game logic and world management.
 */
export function useGameState() {
  const [gameState, setGameStateInternal] = useAtom(gameStateAtom);
  // Ensure worldManager uses fixed stations
  const worldManager = useMemo(
    () => new InfiniteWorldManager({ fixedStations: FIXED_STATIONS }),
    []
  );
  const saveIntervalId = useRef<number | null>(null);
  // Initialize QuestEngine with definitions
  const questEngineRef = useRef(new QuestEngine(V01_QUEST_DEFINITIONS));

  // --- Calculate derived state: Total Cargo Capacity ---
  const totalCargoCapacity = useMemo(() => {
    return gameState.baseCargoCapacity + gameState.extraCargoCapacity;
  }, [gameState.baseCargoCapacity, gameState.extraCargoCapacity]);

  // --- Calculate emancipation score based on current quest state ---
  const emancipationScore = useMemo(() => {
    // Ensure quest state is initialized before calculating
    if (!gameState.questState || !gameState.questState.quests["freedom_v01"]) {
      return 0;
    }
    return questEngineRef.current.calculateQuestCompletion(
      "freedom_v01",
      gameState.questState
    );
  }, [gameState.questState]);

  // --- Helper to Set Game View ---
  const setGameView = useCallback(
    (newView: GameView) => {
      console.log(`Setting game view to: ${newView}`);
      setGameStateInternal((prev) => {
        // Prevent unnecessary state changes if view is the same
        if (prev.gameView === newView) return prev;

        // Clear viewTargetStationId when navigating away from details screen
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

  // --- Helper to Set View Target Station ID (for details screen) ---
  const setViewTargetStationId = useCallback(
    (stationId: string | null) => {
      setGameStateInternal((prev) => {
        if (prev.viewTargetStationId === stationId) return prev;
        return { ...prev, viewTargetStationId: stationId };
      });
    },
    [setGameStateInternal]
  );

  // --- Helper to Set Navigation Target ---
  const setNavTarget = useCallback(
    (stationId: string | null) => {
      console.log(`Setting nav target to: ${stationId}`);
      setGameStateInternal((prev) => {
        if (prev.navTargetStationId === stationId) return prev; // No change needed
        return { ...prev, navTargetStationId: stationId };
        // navTargetDirection and navTargetCoordinates will be updated in the main loop
      });
    },
    [setGameStateInternal]
  );

  // --- Callback to emit quest events and update quest state ---
  const emitQuestEvent = useCallback(
    (event: GameEvent) => {
      // Use setGameStateInternal to ensure updates are based on the latest state
      setGameStateInternal((prevState) => {
        // Ensure player exists and quest state is initialized
        if (!prevState.player || !prevState.questState) return prevState;

        // Pass the *previous* state as the context for the event check
        const currentContextState = { ...prevState };
        const nextQuestState = questEngineRef.current.update(
          prevState.questState,
          event,
          currentContextState
        );

        // If the quest state changed, update it and check for win condition
        if (nextQuestState !== prevState.questState) {
          // console.log("Quest state updated by event:", event.type); // Reduce console noise

          // Recalculate score based on the *new* quest state
          const newScore = questEngineRef.current.calculateQuestCompletion(
            "freedom_v01",
            nextQuestState
          );
          const isWon = newScore >= 100;

          // Only transition to 'won' if not already won
          const newGameView =
            isWon && prevState.gameView !== "won" ? "won" : prevState.gameView;

          if (newGameView === "won" && prevState.gameView !== "won") {
            console.log("WIN CONDITION MET! Emancipation Score >= 100%");
            // Optionally stop game loop or other actions here (loop stop handled in Game.tsx)
          }
          // Return the updated game state with the new quest state and potentially new game view
          return {
            ...prevState,
            questState: nextQuestState,
            gameView: newGameView,
          };
        }
        // If quest state didn't change, return the previous state
        return prevState;
      });
    },
    [setGameStateInternal]
  ); // Dependency on setGameStateInternal

  // --- Helper to Update Player State Fields ---
  // Provides a simpler way to update cash, cargo etc. from logic hooks
  const updatePlayerState = useCallback(
    (updater: (prevState: IGameState) => Partial<IGameState>) => {
      setGameStateInternal((prev) => {
        const changes = updater(prev);
        const nextState = { ...prev, ...changes };

        // Deep merge player object if provided
        if (changes.player && typeof changes.player === "object") {
          nextState.player = {
            ...(prev.player as IPlayer),
            ...(changes.player as Partial<IPlayer>),
          };
        }

        // Emit CREDITS_CHANGE event if cash was modified
        if (changes.cash !== undefined && changes.cash !== prev.cash) {
          const delta = changes.cash - prev.cash;
          // Use setTimeout to ensure event processes against the next state
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

        // Emit ITEM_ACQUIRED/REMOVED for regular cargo if needed by quests (e.g., deliver X machinery)
        // Compare previous and next cargo holds
        if (changes.cargoHold && changes.cargoHold !== prev.cargoHold) {
          const prevCargo = prev.cargoHold;
          const nextCargo = changes.cargoHold;

          // Check for added items (potential PURCHASE or other acquisition)
          nextCargo.forEach((qty, key) => {
            const prevQty = prevCargo.get(key) || 0;
            if (qty > prevQty) {
              // Assuming 'buy' for now, could be refined if needed
              setTimeout(
                () =>
                  emitQuestEvent({
                    type: "ITEM_ACQUIRED",
                    itemId: key,
                    quantity: qty - prevQty,
                    method: "buy",
                    stationId: prev.dockingStationId ?? "",
                  }),
                0
              );
            }
          });

          // Check for removed items (potential SELL or consumption/barter)
          prevCargo.forEach((qty, key) => {
            const nextQty = nextCargo.get(key) || 0;
            if (qty > nextQty) {
              // Assuming 'sell' for now, could be refined (e.g., barter in StationInfoScreen emits ITEM_REMOVED directly)
              setTimeout(
                () =>
                  emitQuestEvent({
                    type: "ITEM_REMOVED",
                    itemId: key,
                    quantity: qty - nextQty,
                    method: "sell",
                    stationId: prev.dockingStationId ?? "",
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
  ); // Add emitQuestEvent dependency

  // --- Helper to Update Market Quantity ---
  const updateMarketQuantity = useCallback(
    (key: string, change: number) => {
      setGameStateInternal((prev) => {
        if (!prev.market) return prev; // No market to update

        const currentTable = prev.market.table;
        const currentState = currentTable.get(key);

        if (!currentState) return prev; // Commodity not found

        const newTable = new Map<string, CommodityState>(currentTable);
        const newQuantity = Math.max(0, currentState.quantity + change);

        newTable.set(key, { ...currentState, quantity: newQuantity });
        const newMarket = new MarketSnapshot(prev.market.timestamp, newTable);
        // console.log("SETTING MARKET TO", newMarket); // Reduced logging noise
        return { ...prev, market: newMarket };
      });
    },
    [setGameStateInternal]
  );

  // --- Helper to Save Known Station Prices ---
  const saveStationPrices = useCallback(
    (stationId: string, prices: Map<string, number>) => {
      setGameStateInternal((prev) => {
        const newKnownPrices = new Map(prev.knownStationPrices);
        newKnownPrices.set(stationId, prices);
        // console.log(`Saving prices for ${stationId}:`, prices); // Debug
        return { ...prev, knownStationPrices: newKnownPrices };
      });
    },
    [setGameStateInternal]
  );

  // completeDocking doesn't need the ID passed anymore, it reads from state
  const completeDocking = useCallback(() => {
    console.log("Action: Complete Docking");
    let dockedStationId: string | null = null;
    setGameStateInternal((prev) => {
      dockedStationId = prev.dockingStationId;
      // ... (rest of docking logic as before) ...
      if (!dockedStationId) {
        console.error("Docking failed: No station ID");
        return {
          ...prev,
          gameView: "playing",
          animationState: { ...prev.animationState, type: null, progress: 0 },
        };
      }
      const station = worldManager.getStationById(dockedStationId);
      let newMarket: MarketSnapshot | null = null;
      if (station)
        newMarket = MarketGenerator.generate(station, WORLD_SEED, Date.now());
      // Use different seed?
      else
        console.error(`Could not find station ${dockedStationId} for market!`);
      const updatedDiscoveredStations = [...prev.discoveredStations];
      if (!updatedDiscoveredStations.includes(dockedStationId))
        updatedDiscoveredStations.push(dockedStationId);
      return {
        ...prev,
        gameView: "trade_select",
        animationState: { ...prev.animationState, type: null, progress: 0 },
        market: newMarket,
        lastDockedStationId: dockedStationId,
        discoveredStations: updatedDiscoveredStations,
      };
    });
    // Emit DOCK_FINISH event after state update is scheduled
    if (dockedStationId)
      setTimeout(
        () =>
          emitQuestEvent({
            type: "DOCK_FINISH",
            stationId: dockedStationId || "",
          }),
        0
      );
  }, [setGameStateInternal, worldManager, emitQuestEvent]);

  const initiateUndocking = useCallback(() => {
    console.log("Action: Initiate Undocking");
    console.log("SETTING MARKET TO NULL"); // Keep this for clarity
    setGameStateInternal((prev) => ({
      ...prev,
      gameView: "undocking",
      market: null, // Clear market data on undocking start
      // Keep dockingStationId during animation
      animationState: {
        type: "undocking", // Set type specifically
        progress: 0, // Reset progress
        duration: prev.animationState.duration, // Keep duration
      },
    }));
  }, [setGameStateInternal]);

  // --- Initialization ---
  const initializeGameState = useCallback(() => {
    if (gameState.isInitialized) {
      // console.log("Initialization already done, skipping."); // Less noisy
      return;
    }
    console.log("Initializing game state...");
    const loadedData = loadGameState(); // Loads all data including quests

    // Ensure loaded quest data is valid, otherwise use initial
    const validQuestState =
      loadedData.questState && typeof loadedData.questState === "object"
        ? loadedData.questState
        : initialQuestState;
    const validQuestInventory =
      loadedData.questInventory instanceof Map
        ? loadedData.questInventory
        : new Map<string, number>();

    // Calculate initial derived state from loaded data
    const initialExtraCargo = loadedData.cargoPodLevel * 5;
    const initialShootCooldownFactor = loadedData.hasAutoloader ? 0.5 : 1.0;

    setGameStateInternal((prevState) => {
      // Create player using loaded shield level for max shield calculation
      const loadedPlayer = createPlayer(
        loadedData.coordinates.x,
        loadedData.coordinates.y,
        loadedData.shieldCapacitorLevel // Pass loaded shield level
      );

      return {
        ...prevState,
        player: loadedPlayer, // Use loaded coords and calculated shield
        cash: loadedData.cash, // Use loaded cash
        cargoHold: loadedData.cargoHold, // Use loaded cargo (already a Map)
        lastDockedStationId: loadedData.lastDockedStationId, // Use loaded last docked station
        discoveredStations: loadedData.discoveredStations, // Use loaded discovered stations
        knownStationPrices: loadedData.knownStationPrices, // Use loaded prices
        // Load Upgrades
        cargoPodLevel: loadedData.cargoPodLevel,
        shieldCapacitorLevel: loadedData.shieldCapacitorLevel,
        engineBoosterLevel: loadedData.engineBoosterLevel,
        hasAutoloader: loadedData.hasAutoloader,
        hasNavComputer: loadedData.hasNavComputer,
        // Load Derived Upgrade Effects
        extraCargoCapacity: initialExtraCargo,
        shootCooldownFactor: initialShootCooldownFactor,
        // Load quest data
        questState: validQuestState,
        questInventory: validQuestInventory,
        isInitialized: true,
        // Reset other dynamic parts of state if necessary
        enemies: [],
        projectiles: [],
        visibleBackgroundObjects: [],
        camera: { x: 0, y: 0 }, // Will be updated by logic soon
        gameView: "playing", // Assume start in playing view unless docking/undocking state is also persisted (not done here)
        dockingStationId: null,
        animationState: { ...initialGameState.animationState }, // Reset animation
        respawnTimer: 0,
        market: null,
        navTargetStationId: null, // Ensure nav target is cleared on load
        navTargetDirection: null,
        navTargetCoordinates: null,
        navTargetDistance: null,
        viewTargetStationId: null,
      };
    });

    // Clear any existing interval before starting a new one
    if (saveIntervalId.current) clearInterval(saveIntervalId.current);

    saveIntervalId.current = setInterval(() => {
      // Use a stable reference to the state for saving,
      // by getting the latest state *inside* the interval callback
      setGameStateInternal((currentSyncState) => {
        // Check if player exists and has coordinates before saving
        if (
          currentSyncState.player &&
          typeof currentSyncState.player.x === "number" &&
          typeof currentSyncState.player.y === "number"
        ) {
          saveGameState({
            coordinates: {
              x: currentSyncState.player.x,
              y: currentSyncState.player.y,
            },
            cash: currentSyncState.cash,
            cargoHold: currentSyncState.cargoHold,
            lastDockedStationId: currentSyncState.lastDockedStationId,
            discoveredStations: currentSyncState.discoveredStations, // Save discovered stations
            knownStationPrices: currentSyncState.knownStationPrices, // Save known prices
            // Save Upgrades
            cargoPodLevel: currentSyncState.cargoPodLevel,
            shieldCapacitorLevel: currentSyncState.shieldCapacitorLevel,
            engineBoosterLevel: currentSyncState.engineBoosterLevel,
            hasAutoloader: currentSyncState.hasAutoloader,
            hasNavComputer: currentSyncState.hasNavComputer,
            // Save quest data
            questState: currentSyncState.questState,
            questInventory: currentSyncState.questInventory,
          });
        } else {
          // Should not happen after initialization
          console.warn("Attempted to save state but player data was invalid.");
        }
        return currentSyncState; // Interval must return the state for Jotai's setter
      });
    }, SAVE_STATE_INTERVAL); // Use the renamed constant

    // Return cleanup function for the interval
    return () => {
      if (saveIntervalId.current) {
        clearInterval(saveIntervalId.current);
        console.log("Cleaned up save interval.");
        saveIntervalId.current = null; // Ensure ref is cleared
      }
    };
  }, [setGameStateInternal, gameState.isInitialized]); // Add gameState.isInitialized dependency to prevent re-running if already initialized

  // --- Core Update Callback ---
  const updateGame = useCallback(
    (
      deltaTime: number,
      now: number,
      currentTouchState: ITouchState | undefined
    ) => {
      setGameStateInternal((currentGameState) => {
        // Skip update if not initialized or game is won
        if (
          !currentGameState.isInitialized ||
          currentGameState.gameView === "won"
        )
          return currentGameState;

        // --- Calculate Navigation Data ---
        let navTargetDirection: number | null = null;
        let navTargetCoordinates: IPosition | null = null;
        let navTargetDistance: number | null = null; // Calculate distance here
        if (
          currentGameState.navTargetStationId &&
          currentGameState.player // Ensure player exists
        ) {
          const targetStation = worldManager.getStationById(
            currentGameState.navTargetStationId
          );
          if (targetStation) {
            const dx = targetStation.x - currentGameState.player.x;
            const dy = targetStation.y - currentGameState.player.y;
            navTargetDirection = Math.atan2(dy, dx);
            navTargetCoordinates = { x: targetStation.x, y: targetStation.y };
            // Calculate distance
            navTargetDistance = distance(
              currentGameState.player.x,
              currentGameState.player.y,
              targetStation.x,
              targetStation.y
            );
          } else {
            // Target station not found (e.g., out of range, error), clear nav target
            console.warn(
              `Nav target station ${currentGameState.navTargetStationId} not found. Clearing navigation.`
            );
            return {
              ...currentGameState, // Return early to avoid using stale data
              navTargetStationId: null,
              navTargetDirection: null,
              navTargetCoordinates: null,
              navTargetDistance: null, // Clear distance too
            };
          }
        }

        // --- Run the core game logic ---
        // Pass the calculated nav data to the logic state
        const stateForLogic = {
          ...currentGameState,
          navTargetDirection,
          navTargetCoordinates,
          navTargetDistance, // Pass distance to logic (though it might recalculate)
        };

        const nextLogicState = updateGameStateLogic(
          stateForLogic,
          currentTouchState,
          worldManager,
          deltaTime,
          now
        );

        // --- Check for State Transitions based on logic results ---

        // 1. Docking Initiation Triggered?
        if (
          currentGameState.gameView === "playing" &&
          !currentGameState.dockingStationId &&
          nextLogicState.dockingStationId && // Logic signals docking start
          nextLogicState.gameView === "playing" // Ensure logic didn't already change view (e.g. to destroyed)
        ) {
          console.log("Hook: Detected docking initiation signal.");

          // Ensure player object and velocity stop is correctly handled
          let updatedPlayer = nextLogicState.player;
          if (updatedPlayer instanceof Player) {
            updatedPlayer.vx = 0;
            updatedPlayer.vy = 0;
          } else if (updatedPlayer) {
            // Check existence
            // Pass shield level
            updatedPlayer = createPlayer(
              updatedPlayer.x,
              updatedPlayer.y,
              currentGameState.shieldCapacitorLevel
            );
            updatedPlayer.angle =
              currentGameState.player?.angle ?? -Math.PI / 2;
            // Shield level set in createPlayer
            updatedPlayer.vx = 0;
            updatedPlayer.vy = 0;
            console.warn(
              "Player object was not an instance during docking check. Recreated."
            );
          }

          // Return the new state for docking directly
          return {
            ...nextLogicState, // Includes the dockingStationId from logic
            player: updatedPlayer, // Use the potentially recreated/updated player
            gameView: "docking", // Set the view
            animationState: {
              type: "docking", // Set animation type
              progress: 0,
              duration: currentGameState.animationState.duration, // Use duration from current state
            },
            market: null, // Clear market
          };
        }
        // 2. Docking Animation Finished?
        else if (
          currentGameState.gameView === "docking" &&
          currentGameState.animationState.type === "docking" &&
          nextLogicState.animationState.type === null // Logic signaled animation end
        ) {
          console.log("Hook: Detected docking animation completion.");
          const stationId = currentGameState.dockingStationId; // Get ID from the state *before* logic potentially cleared it
          const station = stationId
            ? worldManager.getStationById(stationId)
            : null;
          let newMarket: MarketSnapshot | null = null;

          // Add to discovered list (using ID from current state before logic)
          const updatedDiscoveredStations = [
            ...currentGameState.discoveredStations,
          ];
          if (stationId && !updatedDiscoveredStations.includes(stationId)) {
            updatedDiscoveredStations.push(stationId);
            console.log(
              `Added ${stationId} to discovered stations on docking completion.`
            );
          }

          if (station) {
            const stationIdentifier = station.name || `ID ${stationId}`;
            console.log(`Generating market for ${stationIdentifier}`);
            newMarket = MarketGenerator.generate(
              station,
              WORLD_SEED,
              Date.now()
            );
          } else {
            console.error(
              `Cannot complete docking: Station ${stationId} not found!`
            );
          }

          console.log("SETTING MARKET TO", newMarket);
          // Return the new state for completed docking
          return {
            ...nextLogicState, // Base on logic results (animation type is null)
            gameView: "trade_select", // Transition to neutral docked view
            market: newMarket,
            lastDockedStationId: currentGameState.dockingStationId, // Store last docked station ID *here*
            discoveredStations: updatedDiscoveredStations, // Update discovered stations list
            // dockingStationId remains from nextLogicState (which should be same as current)
            animationState: {
              ...nextLogicState.animationState,
              type: null,
              progress: 0,
            }, // Ensure clean animation state
          };
        }
        // 3. Undocking Animation Finished?
        else if (
          currentGameState.gameView === "undocking" &&
          currentGameState.animationState.type === "undocking" &&
          nextLogicState.animationState.type === null // Logic signaled animation end
        ) {
          console.log("Hook: Detected undocking animation completion.");
          // Reposition player logic
          let playerX = nextLogicState.player?.x ?? 0;
          let playerY = nextLogicState.player?.y ?? 0;
          let playerAngle = nextLogicState.player?.angle ?? -Math.PI / 2;
          const stationId = currentGameState.dockingStationId; // Get ID from state *before* logic potentially cleared it
          const station = stationId
            ? worldManager.getStationById(stationId)
            : null;

          if (station) {
            const undockDist =
              station.radius +
              (currentGameState.player?.radius ?? PLAYER_SIZE / 2) +
              20; // Use current radius vals or default
            const exitAngle = station.angle + Math.PI; // Opposite docking entrance
            playerX = station.x + Math.cos(exitAngle) * undockDist;
            playerY = station.y + Math.sin(exitAngle) * undockDist;
            playerAngle = exitAngle; // Face away from station center
          } else {
            console.warn("Undocking: Station not found for repositioning.");
          }

          // Ensure player is an instance and update its properties
          let updatedPlayer = nextLogicState.player;
          if (!(updatedPlayer instanceof Player) && updatedPlayer) {
            // Pass shield level
            updatedPlayer = createPlayer(
              updatedPlayer.x,
              updatedPlayer.y,
              currentGameState.shieldCapacitorLevel
            );
            // shieldLevel set in createPlayer
          } else if (!updatedPlayer) {
            // Should not happen if logic returns a player state
            // Pass shield level
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

          console.log("SETTING MARKET TO NULL"); // Confirm market clear
          // Return the new state for completed undocking
          return {
            ...nextLogicState, // Base on logic results (animation type is null)
            player: updatedPlayer, // Use the updated player object
            gameView: "playing",
            dockingStationId: null, // Clear station ID
            market: null, // Ensure market is cleared
            animationState: {
              ...nextLogicState.animationState,
              type: null,
              progress: 0,
            }, // Ensure clean animation state
          };
        }
        // 4. Destruction sequence detected by logic
        else if (
          currentGameState.gameView === "playing" &&
          nextLogicState.gameView === "destroyed"
        ) {
          console.log("Hook: Detected destruction transition from logic.");
          // Logic already set the view and respawn timer.
          // We might want to clear touch state here immediately.
          // resetTouchState(); // Assuming resetTouchState is available in scope or passed in
          return {
            ...nextLogicState,
            // Ensure other state is consistent with destruction
            projectiles: [],
            enemies: [],
            // Keep player object for position reference during animation
          };
        }
        // 5. Respawn completed by logic
        else if (
          currentGameState.gameView === "destroyed" &&
          nextLogicState.gameView === "playing"
        ) {
          console.log("Hook: Detected respawn completion from logic.");
          // Logic already reset player, view, etc.
          // Just return the state from logic.
          return nextLogicState;
        }

        // --- Final State Check (Win Condition) ---
        // Check win condition again after all updates for the frame
        const finalScore = questEngineRef.current.calculateQuestCompletion(
          "freedom_v01",
          nextLogicState.questState
        );
        if (finalScore >= 100 && nextLogicState.gameView !== "won") {
          console.log(
            "WIN CONDITION MET (End of Frame)! Emancipation Score >= 100%"
          );
          return { ...nextLogicState, gameView: "won" }; // Transition to 'won' state
        }

        // --- No major state transition detected, just return logic results ---
        // Update nav data calculated at the start
        return {
          ...nextLogicState,
          navTargetDirection,
          navTargetCoordinates,
          navTargetDistance,
        };
      }); // End setGameStateInternal
    },
    [setGameStateInternal, worldManager, emitQuestEvent, addQuestItem]
  ); // End updateGame useCallback

  // --- Upgrade Purchase Logic ---
  const purchaseUpgrade = useCallback(
    (upgradeKey: UpgradeKey): boolean => {
      let purchased = false;
      setGameStateInternal((prev) => {
        const config = UPGRADE_CONFIG[upgradeKey];
        if (!config) return prev; // Invalid key

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
          return prev; // Already max level
        }

        const cost = config.costs[currentLevel]; // Cost for the *next* level
        if (prev.cash < cost) {
          console.log(
            `Insufficient cash for ${upgradeKey}. Need ${cost}, have ${prev.cash}`
          );
          return prev; // Cannot afford
        }

        // Apply state changes based on upgrade type
        let updatedState = { ...prev };
        updatedState.cash -= cost;
        const nextLevel = currentLevel + 1;

        switch (upgradeKey) {
          case "cargoPod":
            updatedState.cargoPodLevel = nextLevel;
            updatedState.extraCargoCapacity = nextLevel * 5;
            break;
          case "shieldCapacitor":
            updatedState.shieldCapacitorLevel = nextLevel;
            if (updatedState.player) {
              const baseShield = DEFAULT_STARTING_SHIELD;
              updatedState.player.maxShield =
                baseShield * (1 + nextLevel * 0.25);
              // Optionally replenish shield fully on upgrade? Or just increase max? Let's just increase max for now.
              // updatedState.player.shieldLevel = updatedState.player.maxShield;
            }
            break;
          case "engineBooster":
            updatedState.engineBoosterLevel = nextLevel;
            // Speed effect is applied in Player.update
            break;
          case "autoloader":
            updatedState.hasAutoloader = true;
            updatedState.shootCooldownFactor = 0.5;
            break;
          case "navComputer":
            updatedState.hasNavComputer = true;
            // Display effect is in HUD
            break;
        }
        // Emit event after state update is scheduled
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
      return purchased; // Indicate if purchase was successful
    },
    [setGameStateInternal, emitQuestEvent]
  );

  // --- Helper Function ---
  const findStationById = useCallback(
    (stationId: string | null): IStation | null => {
      if (!stationId) return null;
      // Use worldManager to get the station directly
      return worldManager.getStationById(stationId);
    },
    [worldManager] // Depends only on worldManager
  );

  // --- Add a quest item to the inventory and emit event ---
  const addQuestItem = useCallback(
    (itemId: QuestItemId, quantity: number = 1) => {
      setGameStateInternal((prev) => {
        const currentCount = prev.questInventory.get(itemId) || 0;
        const newInventory = new Map(prev.questInventory);
        newInventory.set(itemId, currentCount + quantity);
        // Emit event *after* state update is scheduled
        // Use setTimeout to ensure the event processes against the *next* state
        setTimeout(
          () =>
            emitQuestEvent({
              type: "ITEM_ACQUIRED",
              itemId,
              quantity,
              method: "reward",
            }),
          0
        ); // Assuming 'reward' for now
        console.log(
          `Added quest item: ${itemId} (x${quantity}). New total: ${newInventory.get(
            itemId
          )}`
        );
        return { ...prev, questInventory: newInventory };
      });
    },
    [setGameStateInternal, emitQuestEvent]
  );

  // --- Remove a quest item from the inventory and emit event ---
  const removeQuestItem = useCallback(
    (itemId: QuestItemId, quantity: number = 1) => {
      let success = false;
      setGameStateInternal((prev) => {
        const currentCount = prev.questInventory.get(itemId) || 0;
        if (currentCount < quantity) {
          console.warn(
            `Cannot remove quest item ${itemId}: Have ${currentCount}, need ${quantity}`
          );
          success = false;
          return prev; // Not enough items, return previous state
        }
        const newInventory = new Map(prev.questInventory);
        const newCount = currentCount - quantity;
        if (newCount <= 0) {
          newInventory.delete(itemId);
        } else {
          newInventory.set(itemId, newCount);
        }
        success = true;
        // Emit event *after* state update is scheduled
        setTimeout(
          () =>
            emitQuestEvent({
              type: "ITEM_REMOVED",
              itemId,
              quantity,
              method: "consumed",
            }),
          0
        ); // Assuming 'consumed'
        console.log(
          `Removed quest item: ${itemId} (x${quantity}). New total: ${
            newInventory.get(itemId) ?? 0
          }`
        );
        return { ...prev, questInventory: newInventory };
      });
      return success; // Note: this returns success based on the state *before* the async update completes
    },
    [setGameStateInternal, emitQuestEvent]
  );

  const startNewGame = useCallback(() => {
    console.log("Action: Start New Game");

    // Stop the current save interval if it's running
    if (saveIntervalId.current) {
      clearInterval(saveIntervalId.current);
      saveIntervalId.current = null;
    }

    // Optionally clear the entire saved state from localStorage
    // localStorage.removeItem(LOCAL_STORAGE_GAME_STATE_KEY);

    // Reset state to defaults
    const defaultPosition = { x: 0, y: 0 };
    const defaultCash = initialGameState.cash; // Get default from initial state
    const defaultCargo = new Map<string, number>(); // Empty map
    const defaultLastDocked = null;
    const defaultDiscoveredStations: string[] = []; // Empty array
    const defaultKnownPrices = new Map<string, Map<string, number>>();
    // Reset quest data to initial state
    const defaultQuestState = initialQuestState;
    const defaultQuestInventory = new Map<string, number>();

    setGameStateInternal((prev) => ({
      ...initialGameState, // Start with initial structure and defaults
      // Overwrite specific fields with fresh values
      player: createPlayer(defaultPosition.x, defaultPosition.y, 0), // Create player with 0 shield level initially
      cash: defaultCash,
      cargoHold: defaultCargo,
      lastDockedStationId: defaultLastDocked,
      discoveredStations: defaultDiscoveredStations, // Clear discovered stations
      knownStationPrices: defaultKnownPrices, // Clear known prices
      // Reset upgrades
      cargoPodLevel: 0,
      shieldCapacitorLevel: 0,
      engineBoosterLevel: 0,
      hasAutoloader: false,
      hasNavComputer: false,
      extraCargoCapacity: 0,
      shootCooldownFactor: 1.0,
      // Reset quest data
      questState: defaultQuestState,
      questInventory: defaultQuestInventory,
      gameView: "playing", // Start directly in playing view
      isInitialized: true, // It's now initialized with new game state
      // Clear any lingering dynamic state
      enemies: [],
      projectiles: [],
      visibleBackgroundObjects: [],
      camera: { x: 0 - GAME_WIDTH / 2, y: 0 - GAME_VIEW_HEIGHT / 2 }, // Center camera on 0,0
      dockingStationId: null,
      animationState: {
        type: null,
        progress: 0,
        duration: prev.animationState.duration,
      },
      respawnTimer: 0,
      market: null,
      navTargetStationId: null, // Clear nav target
      navTargetDirection: null,
      navTargetCoordinates: null,
      navTargetDistance: null,
      viewTargetStationId: null, // Clear view target
      lastEnemySpawnTime: 0, // Reset timers/counters if needed
      lastShotTime: 0,
      enemyIdCounter: 0,
    }));

    // Immediately save the reset state
    saveGameState({
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
      // Save reset quest data
      questState: defaultQuestState,
      questInventory: defaultQuestInventory,
    });

    // Restart the save interval
    saveIntervalId.current = setInterval(() => {
      setGameStateInternal((currentSyncState) => {
        if (
          currentSyncState.player &&
          typeof currentSyncState.player.x === "number"
        ) {
          saveGameState({
            coordinates: {
              x: currentSyncState.player.x,
              y: currentSyncState.player.y,
            },
            cash: currentSyncState.cash,
            cargoHold: currentSyncState.cargoHold,
            lastDockedStationId: currentSyncState.lastDockedStationId,
            discoveredStations: currentSyncState.discoveredStations, // Save discovered stations
            knownStationPrices: currentSyncState.knownStationPrices, // Save known prices
            // Save Upgrades
            cargoPodLevel: currentSyncState.cargoPodLevel,
            shieldCapacitorLevel: currentSyncState.shieldCapacitorLevel,
            engineBoosterLevel: currentSyncState.engineBoosterLevel,
            hasAutoloader: currentSyncState.hasAutoloader,
            hasNavComputer: currentSyncState.hasNavComputer,
            // Save quest data
            questState: currentSyncState.questState,
            questInventory: currentSyncState.questInventory,
          });
        }
        return currentSyncState;
      });
    }, SAVE_STATE_INTERVAL);
  }, [setGameStateInternal]);

  return {
    initializeGameState,
    gameState,
    updateGame,
    isInitialized: gameState.isInitialized,
    completeDocking,
    initiateUndocking,
    setGameView,
    setViewTargetStationId, // Expose this
    setNavTarget, // Expose this
    updatePlayerState,
    updateMarketQuantity,
    findStationById,
    startNewGame,
    saveStationPrices, // Expose the new function
    purchaseUpgrade, // Expose upgrade purchase function
    totalCargoCapacity, // Expose derived cargo capacity
    // Quest related exports
    emitQuestEvent,
    addQuestItem,
    removeQuestItem,
    questEngine: questEngineRef.current, // Expose engine instance for helpers like getObjectiveProgressText
    emancipationScore, // Expose calculated score
  };
}
