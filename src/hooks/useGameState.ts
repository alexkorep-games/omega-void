// src/hooks/useGameState.ts
import { useCallback, useMemo, useRef } from "react";
import { atom, useAtom } from "jotai";
import { IGameState, ITouchState, IStation, GameView } from "../game/types";
import { initialGameState } from "../game/state"; // Still used for base structure
import { updateGameStateLogic, createPlayer } from "../game/logic";
import { InfiniteWorldManager } from "../game/world/InfiniteWorldManager";
import { loadGameState, saveGameState } from "../utils/storage"; // Use new functions
import { SAVE_STATE_INTERVAL } from "../game/config"; // Renamed constant
import { Player } from "../game/entities/Player";
import {
  MarketGenerator,
  MarketSnapshot,
  CommodityState,
} from "../game/Market"; // Import Market components

// Simple world seed for market generation for now
const WORLD_SEED = 12345;

const gameStateAtom = atom<IGameState>(initialGameState);

/**
 * Hook to manage the overall game state, including entities, world, and updates.
 * It integrates the core game logic and world management.
 */
export function useGameState() {
  const [gameState, setGameStateInternal] = useAtom(gameStateAtom);
  const worldManager = useMemo(() => new InfiniteWorldManager({}), []);
  const saveIntervalId = useRef<number | null>(null);

  // --- Helper to Set Game View ---
  const setGameView = useCallback(
    (newView: GameView) => {
      console.log(`Setting game view to: ${newView}`);
      setGameStateInternal((prev) => {
        // Prevent unnecessary state changes if view is the same
        if (prev.gameView === newView) return prev;
        console.log(`Game view updated to: ${newView}`);
        return { ...prev, gameView: newView };
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

      console.log("SETTING MARKET TO", newMarket);
      return {
        ...prev, // Use the state before animation finished to get dockingStationId
        gameView: "docked", // Go to neutral docked view
        animationState: { ...prev.animationState, type: null, progress: 0 }, // Ensure animation state is reset
        market: newMarket,
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
      console.log("Initialization already done, skipping.");
      return;
    }

    console.log("Initializing game state...");
    const loadedData = loadGameState();

    setGameStateInternal((prevState) => ({
      ...prevState,
      player: createPlayer(loadedData.coordinates.x, loadedData.coordinates.y), // Use loaded coords
      cash: loadedData.cash, // Use loaded cash
      cargoHold: loadedData.cargoHold, // Use loaded cargo (already a Map)
      isInitialized: true,
      // Reset other dynamic parts of state if necessary
      enemies: [],
      projectiles: [],
      visibleBackgroundObjects: [],
      camera: { x: 0, y: 0 }, // Will be updated by logic soon
      gameView: "playing", // Assume start in playing view unless docking/undocking state is also persisted (not done here)
      dockingStationId: null,
      animationState: { ...initialGameState.animationState }, // Reset animation
      market: null,
    }));

    // Clear any existing interval before starting a new one
    if (saveIntervalId.current) clearInterval(saveIntervalId.current);

    saveIntervalId.current = setInterval(() => {
      // Use a stable reference to the state for saving,
      // by getting the latest state *inside* the interval callback
      // Note: Using the atom's read function directly might be another approach,
      // but setGameStateInternal allows reading the *current* state before setting.
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
          });
        } else {
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

        // --- Run the core game logic ---
        const nextLogicState = updateGameStateLogic(
          currentGameState,
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
          nextLogicState.dockingStationId
        ) {
          console.log(
            "Hook: Detected docking initiation signal. Applying state change directly."
          );
          // Ensure player velocity is stopped *immediately* in the logic state
          if (nextLogicState.player instanceof Player) {
            nextLogicState.player.vx = 0;
            nextLogicState.player.vy = 0; // Correctly assign to the logic state's player
          } else {
            // If player is not an instance, create a new one with stopped velocity
            nextLogicState.player = new Player(
              nextLogicState.player.x,
              nextLogicState.player.y
            );
            nextLogicState.player.angle = currentGameState.player.angle; // Preserve angle
            nextLogicState.player.vx = 0;
            nextLogicState.player.vy = 0;
            console.warn(
              "Player object was not an instance during docking collision check. Recreated."
            );
          }

          // Return the new state for docking directly
          return {
            ...nextLogicState, // Includes the mutated player and dockingStationId
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
          nextLogicState.animationState.type === null
        ) {
          console.log(
            "Hook: Detected docking animation completion. Applying state change directly."
          );
          const stationId = currentGameState.dockingStationId; // Get ID from the state *before* logic potentially cleared it
          const station = stationId
            ? worldManager.getStationById(stationId)
            : null;
          let newMarket: MarketSnapshot | null = null;
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
            gameView: "docked", // Transition to neutral docked view
            market: newMarket,
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
          nextLogicState.animationState.type === null
        ) {
          console.log(
            "Hook: Detected undocking animation completion. Applying state change directly."
          );
          // Reposition player logic
          let playerX = nextLogicState.player.x;
          let playerY = nextLogicState.player.y;
          let playerAngle = nextLogicState.player.angle;
          const stationId = currentGameState.dockingStationId; // Get ID from state *before* logic potentially cleared it
          const station = stationId
            ? worldManager.getStationById(stationId)
            : null;

          if (station) {
            const undockDist =
              station.radius + currentGameState.player.radius + 20; // Use current radius vals
            const exitAngle = station.angle + Math.PI; // Opposite docking entrance
            playerX = station.x + Math.cos(exitAngle) * undockDist;
            playerY = station.y + Math.sin(exitAngle) * undockDist;
            playerAngle = exitAngle + Math.PI / 2; // Face away from station center (sprite dependent)
          } else {
            console.warn("Undocking: Station not found for repositioning.");
          }

          // Ensure player is an instance and update its properties
          const updatedPlayer =
            nextLogicState.player instanceof Player
              ? nextLogicState.player // Reuse if already instance
              : new Player(nextLogicState.player.x, nextLogicState.player.y); // Create if plain object

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

        // --- No major state transition detected, just return logic results ---
        return nextLogicState; // Return the state from logic if no transitions occurred
      }); // End setGameStateInternal
    },
    [setGameStateInternal, worldManager]
  ); // End updateGame useCallback

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

    // Reset state to defaults
    const defaultPosition = { x: 0, y: 0 };
    const defaultCash = initialGameState.cash; // Get default from initial state
    const defaultCargo = new Map<string, number>(); // Empty map

    setGameStateInternal((prev) => ({
      ...initialGameState, // Start with initial structure and defaults
      // Overwrite specific fields with fresh values
      player: createPlayer(defaultPosition.x, defaultPosition.y),
      cash: defaultCash,
      cargoHold: defaultCargo,
      gameView: "playing", // Start directly in playing view
      isInitialized: true, // It's now initialized with new game state
      // Clear any lingering dynamic state
      enemies: [],
      projectiles: [],
      visibleBackgroundObjects: [],
      camera: { x: 0 - 360 / 2, y: 0 - (640 - 120) / 2 }, // Center camera on 0,0
      dockingStationId: null,
      animationState: {
        type: null,
        progress: 0,
        duration: prev.animationState.duration,
      },
      market: null,
      lastEnemySpawnTime: 0, // Reset timers/counters if needed
      lastShotTime: 0,
      enemyIdCounter: 0,
    }));

    // Immediately save the reset state
    saveGameState({
      coordinates: defaultPosition,
      cash: defaultCash,
      cargoHold: defaultCargo,
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
    updatePlayerState,
    updateMarketQuantity,
    findStationById,
    startNewGame,
  };
}
