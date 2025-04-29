// src/hooks/useGameState.ts
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { IGameState, ITouchState, IStation } from "../game/types";
import { initialGameState } from "../game/state";
import { updateGameStateLogic, createPlayer } from "../game/logic"; // Renamed import
import { InfiniteWorldManager } from "../game/world/InfiniteWorldManager";
import { loadPlayerPosition, savePlayerPosition } from "../utils/storage";
import { SAVE_COORDS_INTERVAL } from "../game/config";
import { Player } from "../game/entities/Player"; // Import Player class for repositioning

/**
 * Hook to manage the overall game state, including entities, world, and updates.
 * It integrates the core game logic and world management.
 */
export function useGameState() {
  const [gameState, setGameState] = useState<IGameState>(initialGameState);
  const worldManager = useMemo(() => new InfiniteWorldManager({}), []);
  const saveIntervalId = useRef<number | null>(null);

  // --- State Transition Actions ---
  const initiateDocking = useCallback((stationId: string) => {
    console.log("Action: Initiate Docking with", stationId);
    setGameState((prev) => ({
      ...prev,
      gameView: "docking",
      dockingStationId: stationId,
      animationState: { ...prev.animationState, type: "docking", progress: 0 },
    }));
  }, []);

  const completeDocking = useCallback(() => {
    console.log("Action: Complete Docking");
    setGameState((prev) => ({
      ...prev,
      gameView: "docked",
      animationState: { ...prev.animationState, type: null, progress: 0 },
    }));
  }, []);

  const initiateUndocking = useCallback(() => {
    console.log("Action: Initiate Undocking");
    setGameState((prev) => ({
      ...prev,
      gameView: "undocking",
      // Keep dockingStationId during animation
      animationState: {
        ...prev.animationState,
        type: "undocking",
        progress: 0,
      },
    }));
  }, []);

  const completeUndocking = useCallback(() => {
    console.log("Action: Complete Undocking");
    setGameState((prev) => {
      let playerX = prev.player.x;
      let playerY = prev.player.y;

      // Find the station player just undocked from to reposition player
      const station = prev.visibleBackgroundObjects.find(
        (obj) => obj.type === "station" && obj.id === prev.dockingStationId
      ) as IStation | undefined;
      if (station) {
        const undockDist = station.radius + prev.player.radius + 20; // Appear slightly away
        const angle = Math.random() * Math.PI * 2; // Appear at a random angle
        playerX = station.x + Math.cos(angle) * undockDist;
        playerY = station.y + Math.sin(angle) * undockDist;
      } else {
        console.warn(
          "Could not find station",
          prev.dockingStationId,
          "to reposition player after undocking."
        );
      }

      // Ensure player is still an instance
      const updatedPlayer =
        prev.player instanceof Player
          ? prev.player
          : new Player(prev.player.x, prev.player.y); // Re-instantiate if needed

      updatedPlayer.x = playerX;
      updatedPlayer.y = playerY;
      updatedPlayer.vx = 0; // Reset velocity
      updatedPlayer.vy = 0;

      return {
        ...prev,
        player: updatedPlayer, // Place the updated player back into state
        gameView: "playing",
        dockingStationId: null, // Clear station ID
        animationState: { ...prev.animationState, type: null, progress: 0 },
      };
    });
  }, []); // Add dependencies if needed, but should be stable

  // --- Initialization ---
  useEffect(() => {
    const initialPosition = loadPlayerPosition();
    setGameState((prevState) => ({
      ...prevState,
      player: createPlayer(initialPosition.x, initialPosition.y),
      isInitialized: true,
    }));

    // Setup periodic saving
    if (saveIntervalId.current) clearInterval(saveIntervalId.current);
    saveIntervalId.current = setInterval(() => {
      setGameState((currentSyncState) => {
        // Only save if the game is in a state where player coords are relevant
        if (
          currentSyncState.gameView === "playing" ||
          currentSyncState.gameView === "docked"
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
  }, [worldManager]); // worldManager is stable

  // --- Core Update Callback ---
  const updateGame = useCallback(
    (
      deltaTime: number,
      now: number,
      currentTouchState: ITouchState | undefined // Now optional
    ) => {
      setGameState((prevGameState) => {
        if (!prevGameState.isInitialized) {
          return prevGameState;
        }

        // Pass state modification actions to the logic function
        const actions = {
          initiateDocking,
          completeDocking,
          completeUndocking,
        };

        // Call the core game logic update function
        return updateGameStateLogic(
          prevGameState,
          currentTouchState, // Pass touch state only if playing
          worldManager,
          deltaTime,
          now,
          actions // Provide actions to the logic
        );
      });
    },
    [worldManager, initiateDocking, completeDocking, completeUndocking] // Include actions in dependencies
  );

  // --- Helper Function ---
  const findStationById = useCallback(
    (stationId: string | null): IStation | null => {
      if (!stationId) return null;
      // Search within the currently visible objects first for efficiency
      const station = gameState.visibleBackgroundObjects.find(
        (obj): obj is IStation => obj.type === "station" && obj.id === stationId
      );
      // TODO: If not found in visible, potentially search cached cells in worldManager?
      // For now, assume it should be visible if docked/docking.
      return station || null;
    },
    [gameState.visibleBackgroundObjects]
  ); // Dependency on visible objects

  // Return state, update function, and actions/helpers
  return {
    gameState,
    updateGame,
    isInitialized: gameState.isInitialized,
    initiateDocking,
    completeDocking,
    initiateUndocking,
    completeUndocking,
    findStationById, // Expose the helper
  };
}
