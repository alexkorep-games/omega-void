/* eslint-disable @typescript-eslint/no-unused-vars */
// src/hooks/useGameState.ts
import { useCallback, useMemo } from "react";
import useGameStore, { GameStore } from "../store/gameStore"; // Import GameStore type
import { IStation, IGameColdState } from "../game/types";
import { questEngine } from "../game/logic";

// Helper to extract IGameColdState from GameStore, can be defined here or imported
function getColdStateFromStoreHook(storeState: GameStore): IGameColdState {
  const {
    _worldManager,
    initializeGameState,
    updateGame,
    startNewGame,
    setGameView,
    setViewTargetStationId,
    setNavTarget,
    initiateUndocking,
    updatePlayerState,
    updateMarketQuantity,
    purchaseUpgrade,
    _emitQuestEvent,

    getOrInitializeStationMarketData,
    ...coldState
  } = storeState;
  return coldState;
}

export function useGameState() {
  // Select the full store state once
  const fullStoreState = useGameStore((state) => state);

  // Memoize the extraction of the cold state (data part)
  // This ensures components consuming `gameState` only re-render when data actually changes
  const gameData = useMemo(
    () => getColdStateFromStoreHook(fullStoreState),
    [fullStoreState]
  );

  // Destructure actions from the full store state
  const {
    _worldManager, // Keep for findStationById
    initializeGameState: storeInitializeGameState,
    updateGame: storeUpdateGame,
    startNewGame: storeStartNewGame,
    setGameView: storeSetGameView,
    setViewTargetStationId: storeSetViewTargetStationId,
    setNavTarget: storeSetNavTarget,
    initiateUndocking: storeInitiateUndocking,
    updatePlayerState: storeUpdatePlayerState,
    updateMarketQuantity: storeUpdateMarketQuantity,
    purchaseUpgrade: storePurchaseUpgrade,
    _emitQuestEvent: storeEmitQuestEvent,
    getOrInitializeStationMarketData: storeGetOrInitializeStationMarketData,
  } = fullStoreState;

  const totalCargoCapacity = useMemo(() => {
    const cargoPodBonus = gameData.cargoPodLevel * 5; // Use gameData
    return gameData.baseCargoCapacity + cargoPodBonus;
  }, [gameData.baseCargoCapacity, gameData.cargoPodLevel]);

  const emancipationScore = useMemo(() => {
    if (!gameData.questState || !gameData.questState.quests["freedom_v01"]) {
      // Use gameData
      return 0;
    }
    return questEngine.calculateQuestCompletion(
      "freedom_v01",
      gameData.questState // Use gameData
    );
  }, [gameData.questState]);

  const findStationById = useCallback(
    (stationId: string | null): IStation | null => {
      if (!stationId) return null;
      return _worldManager.getStationById(stationId); // _worldManager is stable from fullStoreState
    },
    [_worldManager]
  );

  const emitQuestEvent = useCallback(() => {
    storeEmitQuestEvent();
  }, [storeEmitQuestEvent]);

  return {
    initializeGameState: storeInitializeGameState,
    gameState: gameData, // Now this is IGameColdState
    updateGame: storeUpdateGame,
    isInitialized: gameData.isInitialized, // From gameData
    initiateUndocking: storeInitiateUndocking,
    setGameView: storeSetGameView,
    setViewTargetStationId: storeSetViewTargetStationId,
    setNavTarget: storeSetNavTarget,
    updatePlayerState: storeUpdatePlayerState,
    updateMarketQuantity: storeUpdateMarketQuantity,
    startNewGame: storeStartNewGame,
    purchaseUpgrade: storePurchaseUpgrade,
    findStationById,
    totalCargoCapacity,
    emitQuestEvent,
    questEngine: questEngine,
    emancipationScore,
    getOrInitializeStationMarketData: storeGetOrInitializeStationMarketData,
  };
}
