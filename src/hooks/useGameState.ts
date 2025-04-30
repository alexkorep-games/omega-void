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
  const worldManager = useMemo(() => new InfiniteWorldManager({}), []);
  const saveIntervalId = useRef<number | null>(null);

  // --- Calculate derived state: Total Cargo Capacity ---
  const totalCargoCapacity = useMemo(() => {
    return gameState.baseCargoCapacity + gameState.extraCargoCapacity;
  }, [gameState.baseCargoCapacity, gameState.extraCargoCapacity]);

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

  // --- Helper to Update Player State Fields ---
  // Provides a simpler way to update cash, cargo etc. from logic hooks
  const updatePlayerState = useCallback(
    (updater: (prevState: IGameState) => Partial<IGameState>) => {
      setGameStateInternal((prev) => {
        const changes = updater(prev);
        // If the player object itself is being updated, ensure it's merged correctly
        if (changes.player && typeof changes.player === "object") {
          return {
            ...prev,
            ...changes,
            player: {
              ...(prev.player as IPlayer), // Spread existing player state
              ...(changes.player as Partial<IPlayer>), // Apply partial updates
            },
          };
        }
        // Otherwise, just apply the top-level changes
        return { ...prev, ...changes };
      });
    },
    [setGameStateInternal]
  );

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
    setGameStateInternal((prev) => {
      // <-- prev has the dockingStationId
      if (!prev.dockingStationId) {
        console.error("Cannot complete docking without a station ID in state!");
        return {
          ...prev,
          gameView: "playing",
          animationState: { ...prev.animationState, type: null, progress: 0 },
        }; // Fallback
      }
      const station = worldManager.getStationById(prev.dockingStationId);
      let newMarket: MarketSnapshot | null = null;
      if (station) {
        // Use station name or ID parts for logging
        const stationIdentifier = station.name || `ID ${prev.dockingStationId}`;
        console.log(`Generating market for ${stationIdentifier}`);
        newMarket = MarketGenerator.generate(station, WORLD_SEED, Date.now());
      } else {
        console.error(
          `Could not find station ${prev.dockingStationId} to generate market!`
        );
      }

      // Add station to discovered list if not already present
      let updatedDiscoveredStations = [...prev.discoveredStations];
      if (!updatedDiscoveredStations.includes(prev.dockingStationId)) {
        updatedDiscoveredStations.push(prev.dockingStationId);
        console.log(`Added ${prev.dockingStationId} to discovered stations.`);
      }

      console.log("SETTING MARKET TO", newMarket);
      return {
        ...prev, // Use the state before animation finished to get dockingStationId
        gameView: "trade_select",
        animationState: { ...prev.animationState, type: null, progress: 0 }, // Ensure animation state is reset
        market: newMarket,
        lastDockedStationId: prev.dockingStationId, // Store the last docked station
        discoveredStations: updatedDiscoveredStations, // Update discovered stations
      };
    });
  }, [setGameStateInternal, worldManager]); // Depends on worldManager

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
    const loadedData = loadGameState();

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
        if (!currentGameState.isInitialized) {
          return currentGameState;
        }

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
    [setGameStateInternal, worldManager]
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
        console.log(
          `Purchased ${upgradeKey} Level ${nextLevel} for ${cost} CR.`
        );
        purchased = true;
        return updatedState;
      });
      return purchased; // Indicate if purchase was successful
    },
    [setGameStateInternal]
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
  };
}
