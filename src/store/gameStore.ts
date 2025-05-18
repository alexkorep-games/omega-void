// src/store/gameStore.ts
import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";
import {
  IGameColdState,
  ITouchState,
  GameView,
  IPlayer,
  IPosition,
  CommodityTable,
  ChatMessage,
} from "../game/types";
import { initialGameState } from "../game/state";
import {
  createPlayer,
  calculateNextGameState,
  questEngine,
} from "../game/logic";
import { InfiniteWorldManager } from "../game/world/InfiniteWorldManager";
import {
  DEFAULT_STARTING_SHIELD,
  GAME_WIDTH,
  GAME_VIEW_HEIGHT,
  LOCAL_STORAGE_GAME_STATE_KEY,
} from "../game/config";
import { MarketGenerator, MarketSnapshot, COMMODITIES } from "../game/Market";
import { initialQuestState } from "../quests";
import { FULL_DIALOG_DATA } from "../game/dialog";
import { UPGRADE_CONFIG, UpgradeKey } from "../game/upgradesConfig";
import { Player } from "../game/entities/Player";

const WORLD_SEED = 12345;

// Helper to extract IGameColdState from GameStore
function getColdStateFromStore(storeState: GameStore): IGameColdState {
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _worldManager,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    initializeGameState,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateGame,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    startNewGame,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setGameView,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setViewTargetStationId,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setNavTarget,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    initiateUndocking,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updatePlayerState,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateMarketQuantity,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    purchaseUpgrade,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _emitQuestEvent,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getOrInitializeStationMarketData,
    ...coldState
  } = storeState;
  return coldState;
}

const updateChatLogInternal = (
  currentColdState: IGameColdState
): IGameColdState => {
  // ... (implementation remains the same)
  const newChatLog = [...currentColdState.chatLog];
  let newLastProcessedDialogId = currentColdState.lastProcessedDialogId;
  let changesMade = false;

  for (let i = 0; i < FULL_DIALOG_DATA.length; i++) {
    const dialogEntry = FULL_DIALOG_DATA[i];
    const alreadyAdded = newChatLog.some((msg) => msg.id === dialogEntry.id);

    if (
      dialogEntry.id > newLastProcessedDialogId &&
      currentColdState.cash >= dialogEntry.moneyThreshold
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
      if (dialogEntry.id > currentColdState.lastProcessedDialogId) {
        changesMade = true;
      }
    } else if (
      dialogEntry.id > newLastProcessedDialogId &&
      currentColdState.cash < dialogEntry.moneyThreshold
    ) {
      break;
    }
  }

  if (changesMade) {
    newChatLog.sort((a, b) => (a.id as number) - (b.id as number));
    return {
      ...currentColdState,
      chatLog: newChatLog,
      lastProcessedDialogId: newLastProcessedDialogId,
    };
  }
  return currentColdState;
};

interface GameStateActions {
  _worldManager: InfiniteWorldManager; // This will be initialized once and should not be part of persisted state
  initializeGameState: () => void;
  updateGame: (
    deltaTime: number,
    now: number,
    currentTouchState?: ITouchState
  ) => void;
  startNewGame: () => void;
  setGameView: (newView: GameView) => void;
  setViewTargetStationId: (stationId: string | null) => void;
  setNavTarget: (stationId: string | null) => void;
  initiateUndocking: () => void;
  updatePlayerState: (
    updater: (prevColdState: IGameColdState) => Partial<IGameColdState>
  ) => void;
  updateMarketQuantity: (commodityKey: string, change: number) => void;
  purchaseUpgrade: (upgradeKey: UpgradeKey) => boolean;
  _emitQuestEvent: () => void;
  getOrInitializeStationMarketData: (
    stationId: string | null
  ) => MarketSnapshot | null;
}

export type GameStore = IGameColdState & GameStateActions;

// Initialize worldManager outside the persist callback so it's a stable instance
const worldManagerInstance = new InfiniteWorldManager();

const useGameStore = create<GameStore>()(
  devtools(
    persist(
      (set, get) => {
        // `emitQuestEventInternal` uses `get()` and `set()`, so it needs to be defined here
        const emitQuestEventInternal = () => {
          set((prevFullStoreState) => {
            const prevColdState = getColdStateFromStore(prevFullStoreState);
            if (!prevColdState.player || !prevColdState.questState) {
              return {};
            }
            const nextQuestState = questEngine.update(
              prevColdState.questState,
              prevColdState
            );

            if (nextQuestState !== prevColdState.questState) {
              const newScore = questEngine.calculateQuestCompletion(
                "freedom_v01",
                nextQuestState
              );
              const isWon = newScore >= 100;
              const newGameView =
                isWon && prevColdState.gameView !== "won"
                  ? "won"
                  : prevColdState.gameView;
              return {
                questState: nextQuestState,
                gameView: newGameView,
              };
            }
            return {};
          });
        };

        return {
          // Spread initial data state
          ...initialGameState,
          // Assign the stable worldManagerInstance
          _worldManager: worldManagerInstance,

          initializeGameState: () => {
            // This function is called after rehydration.
            // The state from `get()` here will be the rehydrated plain object state.
            set((rehydratedFullStoreState) => {
              // We only proceed if it's not already initialized in this session
              // (e.g. `isInitialized` might be true from localStorage, but we need to make player an instance)
              if (
                rehydratedFullStoreState.isInitialized &&
                rehydratedFullStoreState.player instanceof Player
              ) {
                // Already initialized in this session (e.g. HMR), or rehydration created an instance (less likely)
                // However, it's safer to always re-instance player if not an instance.
              }

              const rehydratedColdState = getColdStateFromStore(
                rehydratedFullStoreState
              );

              let playerInstance: IPlayer;
              // Check if player is already an instance (e.g., if initializeGameState is called multiple times by mistake)
              // OR if it's a plain object from rehydration.
              if (
                rehydratedColdState.player &&
                !(rehydratedColdState.player instanceof Player)
              ) {
                console.log("Re-instantiating player from rehydrated data.");
                playerInstance = createPlayer(
                  rehydratedColdState.player.x,
                  rehydratedColdState.player.y,
                  rehydratedColdState.shieldCapacitorLevel
                );
                playerInstance.shieldLevel = playerInstance.maxShield; // Ensure shield is full on new instance
              } else if (rehydratedColdState.player instanceof Player) {
                console.log("Player is already an instance.");
                playerInstance = rehydratedColdState.player; // Use existing instance
                // Still ensure shield is set correctly based on capacitor level
                playerInstance.maxShield =
                  DEFAULT_STARTING_SHIELD *
                  (1 + rehydratedColdState.shieldCapacitorLevel * 0.25);
                // Optional: If you want to reset shield to max on load: playerInstance.shieldLevel = playerInstance.maxShield;
                // Or keep the rehydrated shieldLevel if it was saved and that's desired behavior.
                // For simplicity, let's assume we reset to max based on current capacitor level.
                playerInstance.shieldLevel =
                  rehydratedColdState.player.shieldLevel ||
                  playerInstance.maxShield;
              } else {
                // This case should ideally not happen if initialGameState.player is an instance.
                console.warn(
                  "Player data missing during initialization, creating new default player."
                );
                playerInstance = createPlayer(0, 0, 0); // Fallback
              }

              const initialCameraX = playerInstance.x - GAME_WIDTH / 2;
              const initialCameraY = playerInstance.y - GAME_VIEW_HEIGHT / 2;

              const updatedCoreColdState: Partial<IGameColdState> = {
                player: playerInstance,
                isInitialized: true, // Mark as initialized for this session
                camera: { x: initialCameraX, y: initialCameraY },
                animationState: {
                  ...rehydratedColdState.animationState,
                  type: null,
                  progress: 0,
                },
                shootCooldownFactor: rehydratedColdState.hasAutoloader
                  ? 0.5
                  : 1.0,
              };

              const tempCombinedColdState = {
                ...rehydratedColdState,
                ...updatedCoreColdState,
              };
              const finalColdStateWithChat = updateChatLogInternal(
                tempCombinedColdState
              );

              // Return the complete IGameColdState part. Zustand will merge this.
              return finalColdStateWithChat;
            });
          },

          updateGame: (
            deltaTime: number,
            now: number,
            currentTouchState?: ITouchState
          ) => {
            set((currentFullStoreState) => {
              const currentColdState = getColdStateFromStore(
                currentFullStoreState
              );
              // CRITICAL: Ensure worldManager is the correct instance from `get()`
              const wm = get()._worldManager;
              if (!wm || typeof wm.getObjectsInView !== "function") {
                console.error(
                  "CRITICAL: _worldManager is invalid in updateGame!",
                  wm
                );
                // Potentially re-assign if it helps, though this indicates a deeper issue
                // if (worldManagerInstance && typeof worldManagerInstance.getObjectsInView === 'function') {
                //   set(s => ({...s, _worldManager: worldManagerInstance})); // Try to fix it for next tick
                // }
                return {}; // Avoid further errors this tick
              }

              if (
                !currentColdState.isInitialized ||
                currentColdState.gameView === "won"
              ) {
                return {};
              }
              // Ensure player is an instance before passing to logic
              let playerToPass = currentColdState.player;
              if (!(playerToPass instanceof Player)) {
                // This is the problematic scenario from the logs
                console.warn(
                  "Player was not an instance in updateGame prep. Re-instantiating.",
                  playerToPass
                );
                playerToPass = createPlayer(
                  playerToPass.x,
                  playerToPass.y,
                  currentColdState.shieldCapacitorLevel
                );
                // Potentially copy other relevant fields like angle, vx, vy if they are critical for the first frame
                playerToPass.shieldLevel =
                  currentColdState.player.shieldLevel || playerToPass.maxShield;

                // Update the state immediately with the instanced player for future calls within this tick if any
                // This is a bit of a patch; ideally, initializeGameState should prevent this.
                const patchedColdState = {
                  ...currentColdState,
                  player: playerToPass,
                };

                let nextColdState = calculateNextGameState(
                  patchedColdState, // Pass patched state
                  deltaTime,
                  now,
                  currentTouchState,
                  wm, // Use the validated wm
                  emitQuestEventInternal
                );
                nextColdState = updateChatLogInternal(nextColdState);
                return nextColdState; // Return full cold state
              }

              let nextColdState = calculateNextGameState(
                currentColdState,
                deltaTime,
                now,
                currentTouchState,
                wm, // Use the validated wm
                emitQuestEventInternal
              );
              nextColdState = updateChatLogInternal(nextColdState);
              return nextColdState; // Return full cold state
            });
          },

          // ... (startNewGame, setGameView, setViewTargetStationId, setNavTarget, initiateUndocking are likely okay)
          // Ensure they return the full IGameColdState after modifications if they modify it.
          // Or return Partial<IGameColdState> for changes.
          // For simplicity and consistency with how updateGame works, returning the full modified cold state part is safer.

          startNewGame: () => {
            const defaultPosition: IPosition = { x: 0, y: 0 };
            const defaultCash = initialGameState.cash;
            const newPlayer = createPlayer(
              defaultPosition.x,
              defaultPosition.y,
              0
            );

            set((prevFullStoreState) => {
              const intermediateColdState: IGameColdState = {
                ...initialGameState,
                player: newPlayer,
                cash: defaultCash,
                cargoHold: {},
                lastDockedStationId: null,
                discoveredStations: [],
                knownStationPrices: {},
                knownStationQuantities: {},
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
                  duration: prevFullStoreState.animationState.duration,
                },
              };
              return updateChatLogInternal(intermediateColdState);
            });
          },

          setGameView: (newView: GameView) => {
            set((prevFullStoreState) => {
              const prevColdState = getColdStateFromStore(prevFullStoreState);
              if (prevColdState.gameView === newView) return {};
              const changes: Partial<IGameColdState> = { gameView: newView };
              changes.viewTargetStationId =
                newView === "station_details"
                  ? prevColdState.viewTargetStationId
                  : null;
              if (newView === "playing" || newView === "trade_select") {
                changes.animationState = {
                  ...prevColdState.animationState,
                  type: null,
                  progress: 0,
                };
              }
              return changes;
            });
          },
          setViewTargetStationId: (stationId: string | null) =>
            set({ viewTargetStationId: stationId }),
          setNavTarget: (stationId: string | null) =>
            set({
              navTargetStationId: stationId,
              navTargetDirection: null,
              navTargetCoordinates: null,
              navTargetDistance: null,
            }),
          initiateUndocking: () =>
            set((prev) => ({
              gameView: "undocking",
              market: null,
              viewTargetStationId: null,
              animationState: {
                type: "undocking",
                progress: 0,
                duration: prev.animationState.duration,
              },
            })),

          updatePlayerState: (updater) => {
            set((prevFullStoreState) => {
              const prevColdState = getColdStateFromStore(prevFullStoreState);
              const changesFromUpdater = updater(prevColdState); // Updater provides Partial<IGameColdState>
              const nextPotentialColdState: IGameColdState = {
                ...prevColdState,
                ...changesFromUpdater,
              };
              // Ensure player sub-object is merged correctly if it's part of changesFromUpdater
              if (changesFromUpdater.player && prevColdState.player) {
                nextPotentialColdState.player = {
                  ...(prevColdState.player as IPlayer), // Cast to ensure IPlayer properties
                  ...(changesFromUpdater.player as Partial<IPlayer>),
                };
              }
              const finalNewColdState = updateChatLogInternal(
                nextPotentialColdState
              );
              if (
                changesFromUpdater.cash !== undefined &&
                changesFromUpdater.cash !== prevColdState.cash
              ) {
                queueMicrotask(() => get()._emitQuestEvent());
              }
              // Return the entire new cold state. Zustand will diff and merge.
              return finalNewColdState;
            });
          },

          purchaseUpgrade: (upgradeKey: UpgradeKey): boolean => {
            let purchased = false;
            set((prevFullStoreState) => {
              const prevColdState = getColdStateFromStore(prevFullStoreState);
              const config = UPGRADE_CONFIG[upgradeKey];
              if (!config) return {}; // No change if config invalid
              let currentLevel = 0;
              switch (upgradeKey) {
                case "cargoPod":
                  currentLevel = prevColdState.cargoPodLevel;
                  break;
                case "shieldCapacitor":
                  currentLevel = prevColdState.shieldCapacitorLevel;
                  break;
                case "engineBooster":
                  currentLevel = prevColdState.engineBoosterLevel;
                  break;
                case "autoloader":
                  currentLevel = prevColdState.hasAutoloader ? 1 : 0;
                  break;
                case "navComputer":
                  currentLevel = prevColdState.hasNavComputer ? 1 : 0;
                  break;
                default:
                  return {};
              }
              if (currentLevel >= config.maxLevel) return {};
              const cost = config.costs[currentLevel];
              if (prevColdState.cash < cost) return {};

              purchased = true;
              const changesCollector: Partial<IGameColdState> = {
                cash: prevColdState.cash - cost,
              };
              const nextLevel = currentLevel + 1;
              switch (upgradeKey) {
                case "cargoPod":
                  changesCollector.cargoPodLevel = nextLevel;
                  break;
                case "shieldCapacitor":
                  changesCollector.shieldCapacitorLevel = nextLevel;
                  if (prevColdState.player) {
                    // Ensure player exists before trying to update it
                    const baseShield = DEFAULT_STARTING_SHIELD;
                    const newMaxShield = baseShield * (1 + nextLevel * 0.25);
                    // Create a partial player update object
                    changesCollector.player = {
                      ...prevColdState.player,
                      maxShield: newMaxShield,
                      shieldLevel: newMaxShield,
                    };
                  }
                  break;
                case "engineBooster":
                  changesCollector.engineBoosterLevel = nextLevel;
                  break;
                case "autoloader":
                  changesCollector.hasAutoloader = true;
                  changesCollector.shootCooldownFactor = 0.5;
                  break;
                case "navComputer":
                  changesCollector.hasNavComputer = true;
                  break;
              }

              // Apply changes to a copy of prevColdState
              const nextPotentialColdState: IGameColdState = {
                ...prevColdState,
                ...changesCollector,
              };
              // If player was partially updated, merge it correctly
              if (changesCollector.player && prevColdState.player) {
                nextPotentialColdState.player = {
                  ...(prevColdState.player as IPlayer),
                  ...(changesCollector.player as Partial<IPlayer>),
                };
              }

              const finalNewColdState = updateChatLogInternal(
                nextPotentialColdState
              );
              queueMicrotask(() => get()._emitQuestEvent()); // For cash change
              return finalNewColdState; // Return the full new cold state
            });
            return purchased;
          },

          updateMarketQuantity: (commodityKey: string, change: number) => {
            set((prevFullStoreState) => {
              const prevColdState = getColdStateFromStore(prevFullStoreState);
              if (!prevColdState.dockingStationId) return {};
              const stationId = prevColdState.dockingStationId;
              const knownStationQuantitiesForStation =
                prevColdState.knownStationQuantities[stationId] ?? {};
              const currentQuantity =
                knownStationQuantitiesForStation[commodityKey] ?? 0;
              const newQuantity = Math.max(0, currentQuantity + change);
              const updatedStationQuantities = {
                ...knownStationQuantitiesForStation,
                [commodityKey]: newQuantity,
              };
              const newKnownStationQuantities = {
                ...prevColdState.knownStationQuantities,
                [stationId]: updatedStationQuantities,
              };
              let newMarketSnapshot: MarketSnapshot | null = null;
              const prices = prevColdState.knownStationPrices[stationId];
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
                newMarketSnapshot = new MarketSnapshot(
                  Date.now(),
                  tableForSnapshot
                );
              }
              // Return only the changed properties
              return {
                knownStationQuantities: newKnownStationQuantities,
                market: newMarketSnapshot,
              };
            });
          },

          _emitQuestEvent: emitQuestEventInternal,

          getOrInitializeStationMarketData: (
            stationId: string | null
          ): MarketSnapshot | null => {
            // This function reads state with get() and potentially calls set() for initialization.
            // It should be okay as is, but ensure set() calls within it are minimal and targeted.
            const currentFullStoreState = get();
            if (!stationId) return null;
            const station =
              currentFullStoreState._worldManager.getStationById(stationId);
            if (!station) return null;

            let currentPrices =
              currentFullStoreState.knownStationPrices[stationId];
            let currentQuantities =
              currentFullStoreState.knownStationQuantities[stationId];
            let pricesChangedInStore = false;
            let quantitiesChangedInStore = false;

            if (!currentPrices || Object.keys(currentPrices).length === 0) {
              const initialMarketData = MarketGenerator.generate(
                station,
                WORLD_SEED,
                0
              );
              const pricesToStore: Record<string, number> = {};
              for (const key in initialMarketData.table)
                pricesToStore[key] = initialMarketData.table[key].price;
              currentPrices = pricesToStore;
              set((prev) => ({
                knownStationPrices: {
                  ...prev.knownStationPrices,
                  [stationId]: pricesToStore,
                },
              }));
              pricesChangedInStore = true;
            }
            if (
              !currentQuantities ||
              Object.keys(currentQuantities).length === 0
            ) {
              const initialMarketData = MarketGenerator.generate(
                station,
                WORLD_SEED,
                0
              );
              const quantitiesToStore: Record<string, number> = {};
              for (const key in initialMarketData.table)
                quantitiesToStore[key] = initialMarketData.table[key].quantity;
              currentQuantities = quantitiesToStore;
              set((prev) => ({
                knownStationQuantities: {
                  ...prev.knownStationQuantities,
                  [stationId]: quantitiesToStore,
                },
              }));
              quantitiesChangedInStore = true;
            }

            const freshestState =
              pricesChangedInStore || quantitiesChangedInStore
                ? get()
                : currentFullStoreState;
            const finalPrices =
              freshestState.knownStationPrices[stationId] || {};
            const finalQuantities =
              freshestState.knownStationQuantities[stationId] || {};

            const marketTableForSnapshot: CommodityTable = {};
            for (const commodityDef of COMMODITIES) {
              const key = commodityDef.key;
              if (
                finalPrices[key] !== undefined &&
                finalQuantities[key] !== undefined
              ) {
                marketTableForSnapshot[key] = {
                  price: finalPrices[key],
                  quantity: finalQuantities[key],
                };
              }
            }
            return new MarketSnapshot(Date.now(), marketTableForSnapshot);
          },
        };
      },
      {
        name: LOCAL_STORAGE_GAME_STATE_KEY,
        storage: createJSONStorage(() => localStorage),
        partialize: (fullStoreStateToPersist) => {
          // Exclude _worldManager and actions from persisted state
          const {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            _worldManager,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            initializeGameState,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            updateGame,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            startNewGame,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            setGameView,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            setViewTargetStationId,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            setNavTarget,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            initiateUndocking,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            updatePlayerState,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            updateMarketQuantity,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            purchaseUpgrade,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            _emitQuestEvent,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            getOrInitializeStationMarketData,
            ...coldStateToPersist
          } = fullStoreStateToPersist;

          // Ensure player is a plain object for serialization
          if (coldStateToPersist.player instanceof Player) {
            const plainPlayer = { ...(coldStateToPersist.player as Player) }; // Spread instance to plain object
            return { ...coldStateToPersist, player: plainPlayer };
          }
          return coldStateToPersist; // This is IGameColdState
        },
        onRehydrateStorage: () => (rehydratedColdState) => {
          if (rehydratedColdState) {
            console.log(
              "Zustand state rehydrated. isInitialized from storage:",
              rehydratedColdState.isInitialized
            );
            // `initializeGameState` will be called on app mount.
            // It's important that rehydratedColdState.isInitialized being true
            // doesn't prevent initializeGameState from properly instancing the player.
            // We can temporarily set isInitialized to false here to force re-instantiation if needed,
            // or ensure initializeGameState handles it robustly.
            // Forcing re-init for player instantiation:
            // set({ isInitialized: false }); // This would make initializeGameState run fully
          }
        },
      }
    )
  )
);

export default useGameStore;
