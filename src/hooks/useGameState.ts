// src/hooks/useGameState.ts
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { IGameState } from "../game/types";
import { initialGameState } from "../game/state";
import { updateGameState, createPlayer } from "../game/logic";
import { InfiniteWorldManager } from "../game/world/InfiniteWorldManager";
import { loadPlayerPosition, savePlayerPosition } from "../utils/storage";
import { SAVE_COORDS_INTERVAL } from "../game/config";
import { useTouchInput } from "./useTouchInput"; // Import useTouchInput

/**
 * Hook to manage the overall game state, including entities, world, and updates.
 * It integrates the core game logic and world management.
 */
export function useGameState() {
  const [gameState, setGameState] = useState<IGameState>(initialGameState);
  const worldManager = useMemo(
    () =>
      new InfiniteWorldManager({
        /* config */
      }),
    []
  );
  const saveIntervalId = useRef<number | null>(null);

  // Initialize player position and start saving interval
  useEffect(() => {
    const initialPosition = loadPlayerPosition();
    setGameState((prevState) => ({
      ...prevState,
      player: createPlayer(initialPosition.x, initialPosition.y),
      isInitialized: true, // Mark as initialized
    }));

    // Setup periodic saving
    if (saveIntervalId.current) clearInterval(saveIntervalId.current);
    saveIntervalId.current = setInterval(() => {
      // Use setGameState's callback form to get the latest state
      // without needing gameState in the dependency array of this effect.
      setGameState((currentSyncState) => {
        savePlayerPosition({
          x: currentSyncState.player.x,
          y: currentSyncState.player.y,
        });
        return currentSyncState; // No state change needed here
      });
    }, SAVE_COORDS_INTERVAL);

    // Cleanup interval on unmount
    return () => {
      if (saveIntervalId.current) {
        clearInterval(saveIntervalId.current);
        console.log("Cleaned up save interval.");
      }
    };
  }, [worldManager]); // worldManager is stable due to useMemo

  /**
   * The core update callback passed to useGameLoop.
   * Uses useCallback to ensure the function reference is stable.
   * It takes the latest touchState as an argument.
   */
  const updateGame: (
    deltaTime: number,
    now: number,
    currentTouchState: ReturnType<typeof useTouchInput>
  ) => void = useCallback(
    (deltaTime, now, currentTouchState) => {
      // Only run updates if the game state has been initialized
      setGameState((prevGameState) => {
        if (!prevGameState.isInitialized) {
          return prevGameState; // Skip update if not ready
        }
        // Pass the current touch state to the main logic function
        return updateGameState(
          prevGameState,
          currentTouchState,
          worldManager,
          deltaTime,
          now
        );
      });
    },
    [worldManager]
  ); // worldManager is stable

  // Return the state and the update function generator
  return {
    gameState,
    updateGame,
    isInitialized: gameState.isInitialized,
  };
}
