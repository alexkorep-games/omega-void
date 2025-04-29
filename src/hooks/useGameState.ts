// src/hooks/useGameState.ts
import { useCallback, useMemo, useRef } from "react";
import { atom, useAtom } from "jotai";
import { IGameState, ITouchState, IStation, GameView } from "../game/types";
import { initialGameState } from "../game/state";
import { updateGameStateLogic, createPlayer } from "../game/logic";
import { InfiniteWorldManager } from "../game/world/InfiniteWorldManager";
import { loadPlayerPosition, savePlayerPosition } from "../utils/storage";
import { SAVE_COORDS_INTERVAL } from "../game/config";
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
  const [gameState, setGameStateInternal] = useAtom(gameStateAtom); // Use Jotai atom for state management
  const worldManager = useMemo(() => new InfiniteWorldManager({}), []);
  const saveIntervalId = useRef<number | null>(null);

  // --- Helper to Set Game View ---
  const setGameView = useCallback(
    (newView: GameView) => {
      console.log(`Setting game view to: ${newView}`);
      setGameStateInternal((prev) => {
        // Prevent unnecessary state changes if view is the same
        if (prev.gameView === newView) return prev;
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

  // --- State Transition Actions ---
  const initiateDocking = useCallback(
    (stationId: string) => {
      console.log("Action: Initiate Docking with", stationId);
      console.log("SETTING MARKET TO NULL"); // Keep this for clarity
      setGameStateInternal((prev) => ({
        ...prev,
        gameView: "docking",
        dockingStationId: stationId,
        animationState: {
          type: "docking", // Set type specifically
          progress: 0, // Reset progress
          duration: prev.animationState.duration, // Keep duration
        },
        market: null, // Clear previous market on docking start
      }));
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
        ...prev,
        gameView: "buy_cargo", // Go directly to buy screen
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

  // completeUndocking also reads ID from state
  const completeUndocking = useCallback(() => {
    console.log("Action: Complete Undocking");
    setGameStateInternal((prev) => {
      // <-- prev has the dockingStationId
      let playerX = prev.player.x;
      let playerY = prev.player.y;
      let playerAngle = prev.player.angle;

      const station = prev.dockingStationId
        ? worldManager.getStationById(prev.dockingStationId)
        : null;

      if (station) {
        const undockDist = station.radius + prev.player.radius + 20;
        const exitAngle = station.angle + Math.PI; // Appear opposite docking entrance
        playerX = station.x + Math.cos(exitAngle) * undockDist;
        playerY = station.y + Math.sin(exitAngle) * undockDist;
        playerAngle = exitAngle - Math.PI / 2; // Face away from station entrance (adjust based on ship sprite)
      } else {
        console.warn("Undocking: Station not found for repositioning.");
      }

      // Ensure player is an instance before updating
      const updatedPlayer =
        prev.player instanceof Player
          ? prev.player // Reuse instance if possible
          : new Player(prev.player.x, prev.player.y); // Or create new if needed

      updatedPlayer.x = playerX;
      updatedPlayer.y = playerY;
      updatedPlayer.vx = 0; // Reset velocity
      updatedPlayer.vy = 0;
      updatedPlayer.angle = playerAngle;

      console.log("SETTING MARKET TO NULL"); // Ensure market is cleared
      return {
        ...prev,
        player: updatedPlayer,
        gameView: "playing",
        dockingStationId: null, // Clear station ID
        market: null, // Ensure market is null
        animationState: { ...prev.animationState, type: null, progress: 0 }, // Ensure animation state is reset
      };
    });
  }, [setGameStateInternal, worldManager]);

  // --- Initialization ---
  const initializeGameState = useCallback(() => {
    console.log("Initializing game state...");
    const initialPosition = loadPlayerPosition();
    setGameStateInternal((prevState) => ({
      ...prevState,
      player: createPlayer(initialPosition.x, initialPosition.y),
      isInitialized: true,
    }));

    if (saveIntervalId.current) clearInterval(saveIntervalId.current);
    saveIntervalId.current = setInterval(() => {
      setGameStateInternal((currentSyncState) => {
        if (
          currentSyncState.gameView === "playing" ||
          currentSyncState.gameView === "docked" || // Also save when docked (or in buy/sell)
          currentSyncState.gameView === "buy_cargo" ||
          currentSyncState.gameView === "sell_cargo"
        ) {
          savePlayerPosition({
            x: currentSyncState.player.x,
            y: currentSyncState.player.y,
          });
        }
        return currentSyncState; // Always return the state in the setter function
      });
    }, SAVE_COORDS_INTERVAL);

    return () => {
      if (saveIntervalId.current) {
        clearInterval(saveIntervalId.current);
        console.log("Cleaned up save interval.");
      }
    };
  }, [setGameStateInternal]);

  // --- Core Update Callback ---
  const updateGame = useCallback(
    (
      deltaTime: number,
      now: number,
      currentTouchState: ITouchState | undefined
    ) => {
      // Use setGameStateInternal with function form to ensure we base logic on the *actual* current state atom value
      setGameStateInternal((currentGameState) => {
        if (!currentGameState.isInitialized) {
          return currentGameState; // Not ready yet
        }

        // --- Run the core game logic ---
        // This function now ONLY calculates the next physical state
        const nextLogicState = updateGameStateLogic(
          currentGameState,
          currentTouchState,
          worldManager,
          deltaTime,
          now
          // No actions passed anymore
        );

        // --- Check for State Transitions based on logic results ---
        let stateToReturn = nextLogicState; // Start with the logic result

        // 1. Docking Initiation Triggered?
        // Check if logic set a dockingStationId when previously there wasn't one, and view is 'playing'
        if (
          currentGameState.gameView === "playing" &&
          !currentGameState.dockingStationId && // We weren't trying to dock before
          nextLogicState.dockingStationId // But the logic result indicates we should
        ) {
          console.log("Hook: Detected docking initiation signal.");
          // Logic indicated a docking collision occurred. Initiate docking.
          // This schedules the state change to gameView: 'docking' etc.
          initiateDocking(nextLogicState.dockingStationId);
          // We return the state from logic *before* docking starts visually.
          // initiateDocking's state update will handle the view switch.
        }
        // 2. Docking Animation Finished?
        // Check if the animation type changed from 'docking' to null
        else if (
          // Use 'else if' to avoid potential concurrent triggers
          currentGameState.gameView === "docking" && // We were docking
          currentGameState.animationState.type === "docking" && // Animation was running
          nextLogicState.animationState.type === null // Logic says animation just finished
        ) {
          console.log("Hook: Detected docking animation completion.");
          // Animation finished in logic. Complete the docking process.
          // This schedules the state change to gameView: 'buy_cargo', generates market etc.
          completeDocking(); // Reads ID from state internally now
          // Return the logic state (which has animationState.type = null).
          // completeDocking's state update will handle the view/market switch.
        }
        // 3. Undocking Animation Finished?
        // Check if animation type changed from 'undocking' to null
        else if (
          // Use 'else if'
          currentGameState.gameView === "undocking" && // We were undocking
          currentGameState.animationState.type === "undocking" && // Animation was running
          nextLogicState.animationState.type === null // Logic says animation just finished
        ) {
          console.log("Hook: Detected undocking animation completion.");
          // Complete the undocking process.
          // This schedules the state change to gameView: 'playing', repositions player etc.
          completeUndocking(); // Reads ID from state internally now
          // Return the logic state (which has animationState.type = null).
          // completeUndocking's state update will handle the view/position switch.
        }

        // --- No major state transition detected, just return logic results ---
        return stateToReturn;
      }); // End setGameStateInternal
    },
    [
      // Add the actions as dependencies now, as they are called directly within updateGame
      setGameStateInternal,
      worldManager,
      initiateDocking,
      completeDocking,
      completeUndocking,
    ]
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

  return {
    initializeGameState,
    gameState,
    updateGame,
    isInitialized: gameState.isInitialized,
    // Actions / Setters
    initiateDocking,
    completeDocking,
    initiateUndocking,
    completeUndocking,
    setGameView, // Expose the view setter
    updatePlayerState, // Expose generic updater
    updateMarketQuantity, // Expose market updater
    // Helpers
    findStationById,
  };
}
