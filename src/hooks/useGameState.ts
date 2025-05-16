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
  ChatMessage,
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
import { GameEvent, initialQuestState } from "../quests";
import { FULL_DIALOG_DATA } from "../game/dialog"; // Import dialog data

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

// Helper function to update chat log based on cash and progress
const updateChatLogInternal = (currentState: IGameState): IGameState => {
  const newChatLog = [...currentState.chatLog];
  let newLastProcessedDialogId = currentState.lastProcessedDialogId;
  let changesMade = false;

  for (let i = 0; i < FULL_DIALOG_DATA.length; i++) {
    const dialogEntry = FULL_DIALOG_DATA[i];
    // Check if this message ID has already been processed and added
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
        changesMade = true; // Mark that a new message was added
      }
      // Always update lastProcessedDialogId if threshold met, even for 'thinking'
      // to ensure we don't get stuck on a thinking block.
      newLastProcessedDialogId = Math.max(
        newLastProcessedDialogId,
        dialogEntry.id
      );
      // If we added a non-thinking message, changesMade is true.
      // If we only updated lastProcessedDialogId for a thinking block, ensure changesMade reflects that.
      if (dialogEntry.id > currentState.lastProcessedDialogId) {
        changesMade = true;
      }
    } else if (
      dialogEntry.id > newLastProcessedDialogId &&
      currentState.cash < dialogEntry.moneyThreshold
    ) {
      // Stop processing further dialog entries if cash isn't enough for the current one
      // AND this entry hasn't been processed yet.
      break;
    }
  }

  // Sort chatLog by ID to ensure order if messages were added out of sequence (e.g. due to load)
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
  const [gameState, setGameStateInternal] = useAtom(gameStateAtom);
  const worldManager = useMemo(() => new InfiniteWorldManager(), []);
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
        let nextState = { ...prev, ...changes };

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

        // let cashChanged = false; // Not needed if chat update happens generally
        if (changes.cash !== undefined && changes.cash !== prev.cash) {
          // cashChanged = true;
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
        // If cash changed, or for other general updates, refresh chat log
        // It's safer to run this generally after state updates that could influence chat triggers
        nextState = updateChatLogInternal(nextState);

        return nextState;
      });
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
        let updatedState = { ...prev }; // Copy state for modification
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
        // After purchase, update chat log as cash has changed
        updatedState = updateChatLogInternal(updatedState);
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
    console.warn(
      "Action: completeDocking called directly. Docking completion is usually handled by animation state transition in update loop."
    );
  }, []);

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
      return worldManager.getStationById(stationId);
    },
    [worldManager]
  );

  const initializeGameState = useCallback(() => {
    if (gameState.isInitialized) {
      return () => {};
    }

    console.log("Initializing game state...");
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

    setGameStateInternal((prevState) => {
      const intermediateState: IGameState = {
        ...initialGameState,
        player: loadedPlayer,
        cash: loadedData.cash,
        cargoHold: loadedData.cargoHold ?? {},
        lastDockedStationId: loadedData.lastDockedStationId,
        discoveredStations: loadedData.discoveredStations ?? [],
        knownStationPrices: loadedData.knownStationPrices ?? {},
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
        camera: { x: initialCameraX, y: initialCameraY },
        animationState: {
          ...prevState.animationState,
          type: null,
          progress: 0,
        },
      };
      return updateChatLogInternal(intermediateState);
    });

    console.log("Game state initialized.");

    if (saveIntervalId.current) {
      clearInterval(saveIntervalId.current);
    }
    saveIntervalId.current = setInterval(() => {
      setGameStateInternal((currentSyncState) => {
        if (
          currentSyncState.player &&
          typeof currentSyncState.player.x === "number" &&
          typeof currentSyncState.player.y === "number"
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
  }, [setGameStateInternal, gameState.isInitialized]);

  const updateGame = useCallback(
    (
      deltaTime: number,
      now: number,
      currentTouchState: ITouchState | undefined
    ) => {
      setGameStateInternal((currentGameState) => {
        let nextState = calculateNextGameState(
          currentGameState,
          deltaTime,
          now,
          currentTouchState,
          worldManager,
          emitQuestEvent
        );
        nextState = updateChatLogInternal(nextState);
        return nextState;
      });
    },
    [setGameStateInternal, worldManager, emitQuestEvent]
  );

  const startNewGame = useCallback(() => {
    console.log("Action: Starting New Game...");
    if (saveIntervalId.current) {
      clearInterval(saveIntervalId.current);
      saveIntervalId.current = null;
    }

    const defaultPosition: IPosition = { x: 0, y: 0 };
    const defaultCash = initialGameState.cash;
    const newPlayer = createPlayer(defaultPosition.x, defaultPosition.y, 0);

    setGameStateInternal((prev) => {
      const intermediateState: IGameState = {
        ...initialGameState,
        player: newPlayer,
        cash: defaultCash,
        cargoHold: {},
        lastDockedStationId: null,
        discoveredStations: [],
        knownStationPrices: {},
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
        camera: {
          x: defaultPosition.x - GAME_WIDTH / 2,
          y: defaultPosition.y - GAME_VIEW_HEIGHT / 2,
        },
        animationState: {
          type: null,
          progress: 0,
          duration: prev.animationState.duration,
        },
      };
      return updateChatLogInternal(intermediateState);
    });

    console.log("Game state reset for new game.");

    setGameStateInternal((currentFreshState) => {
      const dataToSave: SaveData = {
        coordinates: {
          x: currentFreshState.player.x,
          y: currentFreshState.player.y,
        },
        cash: currentFreshState.cash,
        cargoHold: currentFreshState.cargoHold,
        lastDockedStationId: currentFreshState.lastDockedStationId,
        discoveredStations: currentFreshState.discoveredStations,
        knownStationPrices: currentFreshState.knownStationPrices,
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
      console.log("Initial state for new game saved.");
      return currentFreshState;
    });

    saveIntervalId.current = setInterval(() => {
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
    isInitialized: gameState.isInitialized,
    completeDocking,
    initiateUndocking,
    setGameView,
    setViewTargetStationId,
    setNavTarget,
    updatePlayerState,
    updateMarketQuantity,
    startNewGame,
    purchaseUpgrade,
    findStationById,
    totalCargoCapacity,
    emitQuestEvent,
    questEngine: questEngine,
    emancipationScore,
  };
}
