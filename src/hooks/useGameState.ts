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
        console.log("SETTING MARKET TO", newMarket);
        return { ...prev, market: newMarket };
      });
    },
    [setGameStateInternal]
  );

  if (gameState.market) {
    console.log("gameState.market", gameState.market);
  }

  // --- State Transition Actions ---
  const initiateDocking = useCallback(
    (stationId: string) => {
      console.log("Action: Initiate Docking with", stationId);
      console.log("SETTING MARKET TO NULL");
      setGameStateInternal((prev) => ({
        ...prev,
        gameView: "docking",
        dockingStationId: stationId,
        animationState: {
          ...prev.animationState,
          type: "docking",
          progress: 0,
        },
        market: null, // Clear previous market on docking start
      }));
    },
    [setGameStateInternal]
  );

  const completeDocking = useCallback(() => {
    console.log("Action: Complete Docking");
    setGameStateInternal((prev) => {
      if (!prev.dockingStationId) {
        console.error("Cannot complete docking without a station ID!");
        return { ...prev, gameView: "playing" }; // Fallback?
      }
      // Find the station using its ID
      const station = worldManager.getStationById(prev.dockingStationId);
      let newMarket: MarketSnapshot | null = null;
      if (station) {
        console.log(`Generating market for ${station.name}`);
        // Generate market data for the docked station
        // Using Date.now() as a simple visit serial for jitter
        newMarket = MarketGenerator.generate(station, WORLD_SEED, Date.now());
      } else {
        console.error(
          `Could not find station ${prev.dockingStationId} to generate market!`
        );
      }

      console.log("SETTING MARKET TO", newMarket);
      return {
        ...prev,
        gameView: "buy_cargo", // Go directly to buy screen after docking
        animationState: { ...prev.animationState, type: null, progress: 0 },
        market: newMarket, // Set the generated market data
      };
    });
  }, [setGameStateInternal, worldManager]); // Depends on worldManager

  const initiateUndocking = useCallback(() => {
    console.log("Action: Initiate Undocking");
    console.log("SETTING MARKET TO NULL");
    setGameStateInternal((prev) => ({
      ...prev,
      gameView: "undocking",
      market: null, // Clear market data on undocking start
      // Keep dockingStationId during animation
      animationState: {
        ...prev.animationState,
        type: "undocking",
        progress: 0,
      },
    }));
  }, [setGameStateInternal]);

  const completeUndocking = useCallback(() => {
    console.log("Action: Complete Undocking");
    setGameStateInternal((prev) => {
      let playerX = prev.player.x;
      let playerY = prev.player.y;

      const station = worldManager.getStationById(prev.dockingStationId);
      if (station) {
        const undockDist = station.radius + prev.player.radius + 20;
        const angle = station.angle + Math.PI; // Appear opposite docking entrance
        playerX = station.x + Math.cos(angle) * undockDist;
        playerY = station.y + Math.sin(angle) * undockDist;
      } else {
        console.warn("Undocking: Station not found for repositioning.");
      }

      const updatedPlayer =
        prev.player instanceof Player
          ? prev.player
          : new Player(prev.player.x, prev.player.y);

      updatedPlayer.x = playerX;
      updatedPlayer.y = playerY;
      updatedPlayer.vx = 0;
      updatedPlayer.vy = 0;
      updatedPlayer.angle = (station?.angle ?? 0) + Math.PI - Math.PI / 2; // Face away from station

      console.log("SETTING MARKET TO NULL");
      return {
        ...prev,
        player: updatedPlayer,
        gameView: "playing",
        dockingStationId: null,
        market: null, // Ensure market is null
        animationState: { ...prev.animationState, type: null, progress: 0 },
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
          currentSyncState.gameView === "docked" // Also save when docked
        ) {
          savePlayerPosition({
            x: currentSyncState.player.x,
            y: currentSyncState.player.y,
          });
        }
        return currentSyncState;
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
      // We use setGameStateInternal here because updateGameStateLogic returns the *entire* next state
      setGameStateInternal((prevGameState) => {
        if (!prevGameState.isInitialized) {
          return prevGameState;
        }
        const actions = { initiateDocking, completeDocking, completeUndocking };
        return updateGameStateLogic(
          prevGameState,
          currentTouchState,
          worldManager,
          deltaTime,
          now,
          actions
        );
      });
    },
    [
      setGameStateInternal,
      initiateDocking,
      completeDocking,
      completeUndocking,
      worldManager,
    ]
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
