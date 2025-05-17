// src/hooks/useGameState.ts
import { useCallback, useMemo, useRef } from "react";
import { atom, useAtom } from "jotai";
import {
  IGameState,
  ITouchState,
  IStation,
  GameView,
  IPosition,
  CommodityTable,
  QuestInventory,
  ChatMessage,
  IGameColdState,
  IGameHotState,
} from "../game/types";
import {
  initialGameColdState,
  initialGameHotState,
  initialGameState,
} from "../game/state";
import {
  createPlayer,
  calculateNextGameState,
  questEngine,
} from "../game/logic";
import { InfiniteWorldManager } from "../game/world/InfiniteWorldManager";
import { loadGameState, saveGameState, SaveData } from "../utils/storage";
import {
  SAVE_STATE_INTERVAL,
  DEFAULT_STARTING_SHIELD,
  GAME_WIDTH,
  GAME_VIEW_HEIGHT,
} from "../game/config";
import { MarketGenerator, MarketSnapshot, COMMODITIES } from "../game/Market";
import { initialQuestState } from "../quests";
import { FULL_DIALOG_DATA } from "../game/dialog";

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

const gameStateAtom = atom<IGameColdState>(initialGameColdState);
const WORLD_SEED = 12345; // Define WORLD_SEED if not already globally available

// Helper function to update chat log based on cash and progress
const updateChatLogInternal = (
  currentState: IGameColdState
): IGameColdState => {
  const newChatLog = [...currentState.chatLog];
  let newLastProcessedDialogId = currentState.lastProcessedDialogId;
  let changesMade = false;

  for (let i = 0; i < FULL_DIALOG_DATA.length; i++) {
    const dialogEntry = FULL_DIALOG_DATA[i];
    const alreadyAdded = newChatLog.some((msg) => msg.id === dialogEntry.id);

    if (
      dialogEntry.id > newLastProcessedDialogId &&
      currentState.cash >= dialogEntry.moneyThreshold
    ) {
      if (dialogEntry.sender !== "thinking" && !alreadyAdded) {
        const senderType: ChatMessage["sender"] =
          dialogEntry.sender === "commander"
            ? "user"
            : dialogEntry.sender === "bot"
            ? "ai"
            : "system";

        const chatMessage: ChatMessage = {
          id: dialogEntry.id,
          sender: senderType,
          text: dialogEntry.text,
          timestamp: Date.now(),
        };
        newChatLog.push(chatMessage);
        changesMade = true;
      }
      newLastProcessedDialogId = Math.max(
        newLastProcessedDialogId,
        dialogEntry.id
      );
      if (dialogEntry.id > currentState.lastProcessedDialogId) {
        changesMade = true;
      }
    } else if (
      dialogEntry.id > newLastProcessedDialogId &&
      currentState.cash < dialogEntry.moneyThreshold
    ) {
      break;
    }
  }

  if (changesMade) {
    newChatLog.sort((a, b) => (a.id as number) - (b.id as number));
  }

  if (changesMade) {
    return {
      ...currentState,
      chatLog: newChatLog,
      lastProcessedDialogId: newLastProcessedDialogId,
    };
  }
  return currentState;
};

export function useGameState() {
  const [gameColdState, setGameStateInternal] = useAtom(gameStateAtom);
  const gameHotStateRef = useRef<IGameHotState>(initialGameHotState);
  const worldManager = useMemo(() => new InfiniteWorldManager(), []);
  const saveIntervalId = useRef<number | null>(null);

  const gameState: IGameState = {
    hot: gameHotStateRef.current,
    cold: gameColdState,
  };

  const totalCargoCapacity = useMemo(() => {
    const cargoPodBonus = gameState.cold.cargoPodLevel * 5;
    return gameState.cold.baseCargoCapacity + cargoPodBonus;
  }, [gameState.cold.baseCargoCapacity, gameState.cold.cargoPodLevel]);

  const emancipationScore = useMemo(() => {
    if (
      !gameState.cold.questState ||
      !gameState.cold.questState.quests["freedom_v01"]
    ) {
      return 0;
    }
    return questEngine.calculateQuestCompletion(
      "freedom_v01",
      gameState.cold.questState
    );
  }, [gameState.cold.questState]);

  const setGameView = useCallback(
    (newView: GameView) => {
      setGameStateInternal((prev) => {
        if (prev.gameView === newView) return prev;
        const nextViewTargetStationId =
          newView === "station_details" ? prev.viewTargetStationId : null;
        return {
          ...prev,
          gameView: newView,
          viewTargetStationId: nextViewTargetStationId,
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
      setGameStateInternal((prev) => {
        if (prev.navTargetStationId === stationId) return prev;
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

  const emitQuestEvent = useCallback(() => {
    setGameStateInternal((prevState) => {
      if (!gameHotStateRef.current.player || !prevState.questState) {
        return prevState;
      }
      const currentContextState = { ...prevState };
      const nextQuestState = questEngine.update(
        prevState.questState,
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

        return {
          ...prevState,
          questState: nextQuestState,
          gameView: newGameView,
        };
      }
      return prevState;
    });
  }, [setGameStateInternal]);

  const replenishShield = () => {
    const player = gameHotStateRef.current.player;
    const shieldLevel = player?.shieldLevel ?? 0; // Default to 0 if player undefined (shouldn't happen)
    const maxShield = player?.maxShield ?? 100; // Get max shield
    const shieldToReplenish = Math.max(0, maxShield - shieldLevel); // Replenish up to maxShield
    const replenishCost = shieldToReplenish * 1; // 1 CR per 1% (relative to 100)
    setGameStateInternal((prev) => {
      if (!player) return prev;
      player.shieldLevel = player.maxShield;
      return {
        ...prev,
        cash: prev.cash - replenishCost,
      };
    });
  };

  const buyCargo = useCallback(
    (cargoType: string, amount: number) => {
      setGameStateInternal((prev) => {
        if (prev.cash < amount) return prev;
        const newCargo = (prev.cargoHold[cargoType] ?? 0) + amount;
        return {
          ...prev,
          cash: prev.cash - amount,
          cargoHold: {
            ...prev.cargoHold,
            [cargoType]: newCargo,
          },
        };
      });
    },
    [setGameStateInternal]
  );

  const sellCargo = useCallback(
    (cargoType: string, amount: number, earnings: number) => {
      setGameStateInternal((prev) => {
        const currentAmount = prev.cargoHold[cargoType] ?? 0;
        if (currentAmount < amount) return prev;
        const newCargo = currentAmount - amount;
        const newCargoHold = {
          ...prev.cargoHold,
          [cargoType]: newCargo,
        };
        if (newCargo <= 0) {
          delete newCargoHold[cargoType];
        }
        return {
          ...prev,
          cash: prev.cash + earnings,
          cargoHold: newCargoHold,
        };
      });
    },
    [setGameStateInternal]
  );

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
          default:
            return prev;
        }

        if (currentLevel >= config.maxLevel) return prev;
        const cost = config.costs[currentLevel];
        if (prev.cash < cost) return prev;

        purchased = true;
        let updatedState = { ...prev };
        updatedState.cash -= cost;
        const nextLevel = currentLevel + 1;

        switch (upgradeKey) {
          case "cargoPod":
            updatedState.cargoPodLevel = nextLevel;
            break;
          case "shieldCapacitor": {
            updatedState.shieldCapacitorLevel = nextLevel;
            const player = gameHotStateRef.current.player;
            if (player) {
              const baseShield = DEFAULT_STARTING_SHIELD;
              const newMaxShield = baseShield * (1 + nextLevel * 0.25);
              player.maxShield = newMaxShield;
              player.shieldLevel = newMaxShield;
            }
            break;
          }
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

        updatedState = updateChatLogInternal(updatedState);
        return updatedState;
      });
      return purchased;
    },
    [setGameStateInternal]
  );

  const updateMarketQuantity = useCallback(
    (commodityKey: string, change: number) => {
      setGameStateInternal((prev) => {
        if (!prev.dockingStationId) return prev;

        const stationId = prev.dockingStationId;
        const knownStationQuantitiesForStation =
          prev.knownStationQuantities[stationId] ?? {};
        const currentQuantity =
          knownStationQuantitiesForStation[commodityKey] ?? 0;
        const newQuantity = Math.max(0, currentQuantity + change);

        const updatedStationQuantities = {
          ...knownStationQuantitiesForStation,
          [commodityKey]: newQuantity,
        };
        const newKnownStationQuantities = {
          ...prev.knownStationQuantities,
          [stationId]: updatedStationQuantities,
        };

        // Rebuild the market snapshot for the current station
        let newMarketSnapshot: MarketSnapshot | null = null;
        const prices = prev.knownStationPrices[stationId];
        if (prices) {
          const tableForSnapshot: CommodityTable = {};
          for (const commDef of COMMODITIES) {
            const commKey = commDef.key;
            if (
              prices[commKey] !== undefined &&
              updatedStationQuantities[commKey] !== undefined
            ) {
              tableForSnapshot[commKey] = {
                price: prices[commKey],
                quantity: updatedStationQuantities[commKey],
              };
            }
          }
          newMarketSnapshot = new MarketSnapshot(Date.now(), tableForSnapshot);
        }

        return {
          ...prev,
          knownStationQuantities: newKnownStationQuantities,
          market: newMarketSnapshot,
        };
      });
    },
    [setGameStateInternal]
  );

  const getOrInitializeStationMarketData = useCallback(
    (stationId: string | null): MarketSnapshot | null => {
      if (!stationId) return null;

      let currentPrices = gameState.cold.knownStationPrices[stationId];
      let currentQuantities = gameState.cold.knownStationQuantities[stationId];
      const station = worldManager.getStationById(stationId);

      if (!station) return null;

      let needsStateUpdate = false;
      const newKnownPrices = { ...gameState.cold.knownStationPrices };
      const newKnownQuantities = { ...gameState.cold.knownStationQuantities };

      if (!currentPrices || !currentQuantities) {
        const initialMarketData = MarketGenerator.generate(
          station,
          WORLD_SEED,
          0
        );
        if (!currentPrices) {
          const pricesToStore: Record<string, number> = {};
          for (const key in initialMarketData.table) {
            pricesToStore[key] = initialMarketData.table[key].price;
          }
          newKnownPrices[station.id] = pricesToStore;
          currentPrices = pricesToStore;
          needsStateUpdate = true;
        }
        if (!currentQuantities) {
          const quantitiesToStore: Record<string, number> = {};
          for (const key in initialMarketData.table) {
            quantitiesToStore[key] = initialMarketData.table[key].quantity;
          }
          newKnownQuantities[station.id] = quantitiesToStore;
          currentQuantities = quantitiesToStore;
          needsStateUpdate = true;
        }
      }

      if (needsStateUpdate) {
        setGameStateInternal((prev) => ({
          ...prev,
          knownStationPrices: newKnownPrices,
          knownStationQuantities: newKnownQuantities,
        }));
      }

      const marketTableForSnapshot: CommodityTable = {};
      if (currentPrices && currentQuantities) {
        for (const commodityDef of COMMODITIES) {
          const key = commodityDef.key;
          if (
            currentPrices[key] !== undefined &&
            currentQuantities[key] !== undefined
          ) {
            marketTableForSnapshot[key] = {
              price: currentPrices[key],
              quantity: currentQuantities[key],
            };
          }
        }
      }
      return new MarketSnapshot(Date.now(), marketTableForSnapshot);
    },
    [
      gameState.cold.knownStationPrices,
      gameState.cold.knownStationQuantities,
      worldManager,
      setGameStateInternal,
    ]
  );

  const initiateUndocking = useCallback(() => {
    setGameStateInternal((prev) => {
      return {
        ...prev,
        gameView: "undocking",
        market: null,
        viewTargetStationId: null,
        animationState: {
          type: "undocking",
          progress: 0,
          duration: prev.animationState.duration,
        },
      };
    });
  }, [setGameStateInternal]);

  const findStationById = useCallback(
    (stationId: string | null): IStation | null => {
      if (!stationId) return null;
      return worldManager.getStationById(stationId);
    },
    [worldManager]
  );

  const initializeGameState = useCallback(() => {
    if (gameState.cold.isInitialized) {
      return () => {};
    }
    const loadedData = loadGameState();
    const validQuestState =
      loadedData.questState &&
      typeof loadedData.questState === "object" &&
      loadedData.questState.quests
        ? loadedData.questState
        : initialQuestState;
    const validQuestInventory: QuestInventory =
      loadedData.questInventory && typeof loadedData.questInventory === "object"
        ? loadedData.questInventory
        : {};
    const loadedChatLog = loadedData.chatLog || [];
    const loadedLastProcessedDialogId =
      loadedData.lastProcessedDialogId !== undefined
        ? loadedData.lastProcessedDialogId
        : -1;
    const initialShootCooldownFactor = loadedData.hasAutoloader ? 0.5 : 1.0;
    const loadedPlayer = createPlayer(
      loadedData.coordinates.x,
      loadedData.coordinates.y,
      loadedData.shieldCapacitorLevel
    );
    loadedPlayer.shieldLevel = loadedPlayer.maxShield;
    const initialCameraX = loadedData.coordinates.x - GAME_WIDTH / 2;
    const initialCameraY = loadedData.coordinates.y - GAME_VIEW_HEIGHT / 2;

    gameHotStateRef.current.player = loadedPlayer;
    gameHotStateRef.current.camera = {
      x: initialCameraX,
      y: initialCameraY,
    };

    setGameStateInternal((prevState) => {
      const intermediateState: IGameColdState = {
        ...initialGameState.cold,
        cash: loadedData.cash,
        cargoHold: loadedData.cargoHold ?? {},
        lastDockedStationId: loadedData.lastDockedStationId,
        discoveredStations: loadedData.discoveredStations ?? [],
        knownStationPrices: loadedData.knownStationPrices ?? {},
        knownStationQuantities: loadedData.knownStationQuantities ?? {}, // Load known quantities
        cargoPodLevel: loadedData.cargoPodLevel,
        shieldCapacitorLevel: loadedData.shieldCapacitorLevel,
        engineBoosterLevel: loadedData.engineBoosterLevel,
        hasAutoloader: loadedData.hasAutoloader,
        hasNavComputer: loadedData.hasNavComputer,
        shootCooldownFactor: initialShootCooldownFactor,
        questState: validQuestState,
        questInventory: validQuestInventory,
        chatLog: loadedChatLog,
        lastProcessedDialogId: loadedLastProcessedDialogId,
        isInitialized: true,
        gameView: "playing",
        animationState: {
          ...prevState.animationState,
          type: null,
          progress: 0,
        },
      };
      return updateChatLogInternal(intermediateState);
    });

    if (saveIntervalId.current) clearInterval(saveIntervalId.current);
    saveIntervalId.current = setInterval(() => {
      setGameStateInternal((currentSyncState) => {
        const player = gameHotStateRef.current.player;
        if (player && typeof player.x === "number") {
          const dataToSave: SaveData = {
            coordinates: {
              x: player.x,
              y: player.y,
            },
            cash: currentSyncState.cash,
            cargoHold: currentSyncState.cargoHold,
            lastDockedStationId: currentSyncState.lastDockedStationId,
            discoveredStations: currentSyncState.discoveredStations,
            knownStationPrices: currentSyncState.knownStationPrices,
            knownStationQuantities: currentSyncState.knownStationQuantities, // Save known quantities
            cargoPodLevel: currentSyncState.cargoPodLevel,
            shieldCapacitorLevel: currentSyncState.shieldCapacitorLevel,
            engineBoosterLevel: currentSyncState.engineBoosterLevel,
            hasAutoloader: currentSyncState.hasAutoloader,
            hasNavComputer: currentSyncState.hasNavComputer,
            questState: currentSyncState.questState,
            questInventory: currentSyncState.questInventory,
            chatLog: currentSyncState.chatLog,
            lastProcessedDialogId: currentSyncState.lastProcessedDialogId,
          };
          saveGameState(dataToSave);
        }
        return currentSyncState;
      });
    }, SAVE_STATE_INTERVAL);

    return () => {
      if (saveIntervalId.current) {
        clearInterval(saveIntervalId.current);
        saveIntervalId.current = null;
      }
    };
  }, [setGameStateInternal, gameState.cold.isInitialized]);

  const updateGame = useCallback(
    (deltaTime: number, now: number, currentTouchState?: ITouchState) => {
      setGameStateInternal((currentColdGameState) => {
        const currentGameState = {
          cold: currentColdGameState,
          hot: gameHotStateRef.current,
        };
        const nextState = calculateNextGameState(
          currentGameState,
          deltaTime,
          now,
          currentTouchState,
          worldManager,
          emitQuestEvent
        );
        gameHotStateRef.current = nextState.hot;
        const nextColdState = updateChatLogInternal(nextState.cold);
        if (JSON.stringify(nextColdState) === JSON.stringify(currentColdGameState)) {
          return currentColdGameState;
        }
        return nextColdState;
      });
    },
    [setGameStateInternal, worldManager, emitQuestEvent]
  );

  const startNewGame = useCallback(() => {
    if (saveIntervalId.current) {
      clearInterval(saveIntervalId.current);
      saveIntervalId.current = null;
    }
    const defaultPosition: IPosition = { x: 0, y: 0 };
    const defaultCash = initialGameState.cold.cash;
    const newPlayer = createPlayer(defaultPosition.x, defaultPosition.y, 0);

    setGameStateInternal((prev) => {
      const intermediateState: IGameState = {
        ...initialGameState,
        hot: {
          ...initialGameState.hot,
          player: newPlayer,
          camera: {
            x: defaultPosition.x - GAME_WIDTH / 2,
            y: defaultPosition.y - GAME_VIEW_HEIGHT / 2,
          },
        },
        cold: {
          ...initialGameState.cold,
          cash: defaultCash,
          cargoHold: {},
          lastDockedStationId: null,
          discoveredStations: [],
          knownStationPrices: {},
          knownStationQuantities: {}, // Reset known quantities
          cargoPodLevel: 0,
          shieldCapacitorLevel: 0,
          engineBoosterLevel: 0,
          hasAutoloader: false,
          hasNavComputer: false,
          shootCooldownFactor: 1.0,
          questState: initialQuestState,
          questInventory: {},
          chatLog: [],
          lastProcessedDialogId: -1,
          gameView: "playing",
          isInitialized: true,
          animationState: {
            type: null,
            progress: 0,
            duration: prev.animationState.duration,
          },
        },
      };

      gameHotStateRef.current = intermediateState.hot;
      return updateChatLogInternal(intermediateState.cold);
    });

    setGameStateInternal((currentFreshState) => {
      const dataToSave: SaveData = {
        coordinates: {
          x: gameHotStateRef.current.player.x,
          y: gameHotStateRef.current.player.y,
        },
        cash: currentFreshState.cash,
        cargoHold: currentFreshState.cargoHold,
        lastDockedStationId: currentFreshState.lastDockedStationId,
        discoveredStations: currentFreshState.discoveredStations,
        knownStationPrices: currentFreshState.knownStationPrices,
        knownStationQuantities: currentFreshState.knownStationQuantities,
        cargoPodLevel: currentFreshState.cargoPodLevel,
        shieldCapacitorLevel: currentFreshState.shieldCapacitorLevel,
        engineBoosterLevel: currentFreshState.engineBoosterLevel,
        hasAutoloader: currentFreshState.hasAutoloader,
        hasNavComputer: currentFreshState.hasNavComputer,
        questState: currentFreshState.questState,
        questInventory: currentFreshState.questInventory,
        chatLog: currentFreshState.chatLog,
        lastProcessedDialogId: currentFreshState.lastProcessedDialogId,
      };
      saveGameState(dataToSave);
      return currentFreshState;
    });

    saveIntervalId.current = setInterval(() => {
      setGameStateInternal((currentSyncState) => {
        const player = gameHotStateRef.current.player;
        if (
          player &&
          typeof player.x === "number"
        ) {
          const dataToSave: SaveData = {
            coordinates: {
              x: player.x,
              y: player.y,
            },
            cash: currentSyncState.cash,
            cargoHold: currentSyncState.cargoHold,
            lastDockedStationId: currentSyncState.lastDockedStationId,
            discoveredStations: currentSyncState.discoveredStations,
            knownStationPrices: currentSyncState.knownStationPrices,
            knownStationQuantities: currentSyncState.knownStationQuantities, // Save known quantities
            cargoPodLevel: currentSyncState.cargoPodLevel,
            shieldCapacitorLevel: currentSyncState.shieldCapacitorLevel,
            engineBoosterLevel: currentSyncState.engineBoosterLevel,
            hasAutoloader: currentSyncState.hasAutoloader,
            hasNavComputer: currentSyncState.hasNavComputer,
            questState: currentSyncState.questState,
            questInventory: currentSyncState.questInventory,
            chatLog: currentSyncState.chatLog,
            lastProcessedDialogId: currentSyncState.lastProcessedDialogId,
          };
          saveGameState(dataToSave);
        }
        return currentSyncState;
      });
    }, SAVE_STATE_INTERVAL);
  }, [setGameStateInternal]);

  return {
    initializeGameState,
    gameState,
    updateGame,
    isInitialized: gameState.cold.isInitialized,
    initiateUndocking,
    setGameView,
    setViewTargetStationId,
    setNavTarget,
    updateMarketQuantity,
    startNewGame,
    purchaseUpgrade,
    findStationById,
    totalCargoCapacity,
    emitQuestEvent,
    questEngine: questEngine,
    emancipationScore,
    getOrInitializeStationMarketData,
    replenishShield,
    buyCargo,
    sellCargo,
  };
}
