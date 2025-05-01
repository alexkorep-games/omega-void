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
} from "../game/types";
import { initialGameState } from "../game/state";
import { updateGameStateLogic, createPlayer } from "../game/logic";
import { InfiniteWorldManager } from "../game/world/InfiniteWorldManager";
import { loadGameState, saveGameState } from "../utils/storage";
import {
  SAVE_STATE_INTERVAL,
  DEFAULT_STARTING_SHIELD,
  GAME_WIDTH,
  GAME_VIEW_HEIGHT,
  PLAYER_SIZE,
} from "../game/config";
import { Player } from "../game/entities/Player";
import {
  MarketGenerator,
  MarketSnapshot,
  CommodityState,
} from "../game/Market";
import { distance } from "../utils/geometry";
import {
  QuestEngine,
  GameEvent,
  V01_QUEST_DEFINITIONS,
  QuestItemId,
  initialQuestState,
} from "../quests";
import { FIXED_STATIONS } from "../game/world/FixedStations";

const WORLD_SEED = 12345;

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
const questEngine = new QuestEngine(V01_QUEST_DEFINITIONS);

export function useGameState() {
  const [gameState, setGameStateInternal] = useAtom(gameStateAtom);
  const worldManager = useMemo(
    () => new InfiniteWorldManager({ fixedStations: FIXED_STATIONS }),
    []
  );
  const saveIntervalId = useRef<number | null>(null);

  const totalCargoCapacity = useMemo(() => {
    return gameState.baseCargoCapacity + gameState.extraCargoCapacity;
  }, [gameState.baseCargoCapacity, gameState.extraCargoCapacity]);

  const emancipationScore = useMemo(() => {
    if (!gameState.questState || !gameState.questState.quests["freedom_v01"]) {
      return 0;
    }
    return questEngine.calculateQuestCompletion(
      "freedom_v01",
      gameState.questState
    );
  }, [gameState.questState]);

  const setGameView = useCallback(
    (newView: GameView) => {
      console.log(`Setting game view to: ${newView}`);
      setGameStateInternal((prev) => {
        if (prev.gameView === newView) return prev;
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
        return { ...prev, navTargetStationId: stationId };
      });
    },
    [setGameStateInternal]
  );

  // --- Declare emitQuestEvent FIRST ---
  const emitQuestEvent = useCallback(
    (event: GameEvent) => {
      setGameStateInternal((prevState) => {
        if (!prevState.player || !prevState.questState) return prevState;
        const currentContextState = { ...prevState };
        const nextQuestState = questEngine.update(
          prevState.questState,
          event,
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
          if (newGameView === "won" && prevState.gameView !== "won") {
            console.log("WIN CONDITION MET! Emancipation Score >= 100%");
          }
          return {
            ...prevState,
            questState: nextQuestState,
            gameView: newGameView,
          };
        }
        return prevState;
      });
    },
    [setGameStateInternal]
  );

  // --- Declare functions that DEPEND on emitQuestEvent ---
  const updatePlayerState = useCallback(
    (updater: (prevState: IGameState) => Partial<IGameState>) => {
      setGameStateInternal((prev) => {
        const changes = updater(prev);
        const nextState = { ...prev, ...changes };
        if (changes.player && typeof changes.player === "object") {
          nextState.player = {
            ...(prev.player as IPlayer),
            ...(changes.player as Partial<IPlayer>),
          };
        }
        if (changes.cash !== undefined && changes.cash !== prev.cash) {
          const delta = changes.cash - prev.cash;
          setTimeout(
            () =>
              emitQuestEvent({
                type: "CREDITS_CHANGE",
                delta,
                total: changes.cash as number,
              }),
            0
          );
        }
        if (changes.cargoHold && changes.cargoHold !== prev.cargoHold) {
          const prevCargo = prev.cargoHold;
          const nextCargo = changes.cargoHold;
          nextCargo.forEach((qty, key) => {
            const prevQty = prevCargo.get(key) || 0;
            if (qty > prevQty) {
              setTimeout(
                () =>
                  emitQuestEvent({
                    type: "ITEM_ACQUIRED",
                    itemId: key,
                    quantity: qty - prevQty,
                    method: "buy",
                    stationId: prev.dockingStationId ?? "",
                  }),
                0
              );
            }
          });
          prevCargo.forEach((qty, key) => {
            const nextQty = nextCargo.get(key) || 0;
            if (qty > nextQty) {
              setTimeout(
                () =>
                  emitQuestEvent({
                    type: "ITEM_REMOVED",
                    itemId: key,
                    quantity: qty - nextQty,
                    method: "sell",
                    stationId: prev.dockingStationId ?? "",
                  }),
                0
              );
            }
          });
        }
        return nextState;
      });
    },
    [setGameStateInternal, emitQuestEvent]
  ); // emitQuestEvent is now defined

  const addQuestItem = useCallback(
    (itemId: QuestItemId, quantity: number = 1) => {
      setGameStateInternal((prev) => {
        const currentCount = prev.questInventory.get(itemId) || 0;
        const newInventory = new Map(prev.questInventory);
        newInventory.set(itemId, currentCount + quantity);
        setTimeout(
          () =>
            emitQuestEvent({
              type: "ITEM_ACQUIRED",
              itemId,
              quantity,
              method: "reward",
            }),
          0
        );
        console.log(
          `Added quest item: ${itemId} (x${quantity}). New total: ${newInventory.get(
            itemId
          )}`
        );
        return { ...prev, questInventory: newInventory };
      });
    },
    [setGameStateInternal, emitQuestEvent]
  ); // emitQuestEvent is now defined

  const removeQuestItem = useCallback(
    (itemId: QuestItemId, quantity: number = 1) => {
      let success = false;
      setGameStateInternal((prev) => {
        const currentCount = prev.questInventory.get(itemId) || 0;
        if (currentCount < quantity) {
          console.warn(
            `Cannot remove quest item ${itemId}: Have ${currentCount}, need ${quantity}`
          );
          success = false;
          return prev;
        }
        const newInventory = new Map(prev.questInventory);
        const newCount = currentCount - quantity;
        if (newCount <= 0) {
          newInventory.delete(itemId);
        } else {
          newInventory.set(itemId, newCount);
        }
        success = true;
        setTimeout(
          () =>
            emitQuestEvent({
              type: "ITEM_REMOVED",
              itemId,
              quantity,
              method: "consumed",
            }),
          0
        );
        console.log(
          `Removed quest item: ${itemId} (x${quantity}). New total: ${
            newInventory.get(itemId) ?? 0
          }`
        );
        return { ...prev, questInventory: newInventory };
      });
      return success;
    },
    [setGameStateInternal, emitQuestEvent]
  ); // emitQuestEvent is now defined

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
        }
        if (currentLevel >= config.maxLevel) {
          console.log(`Upgrade ${upgradeKey} already at max level.`);
          return prev;
        }
        const cost = config.costs[currentLevel];
        if (prev.cash < cost) {
          console.log(
            `Insufficient cash for ${upgradeKey}. Need ${cost}, have ${prev.cash}`
          );
          return prev;
        }
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
            }
            break;
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
        setTimeout(
          () =>
            emitQuestEvent({
              type: "SHIP_UPGRADED",
              upgradeId: upgradeKey,
              level: nextLevel,
            }),
          0
        );
        purchased = true;
        console.log(
          `Purchased ${upgradeKey} Level ${nextLevel} for ${cost} CR.`
        );
        return updatedState;
      });
      return purchased;
    },
    [setGameStateInternal, emitQuestEvent]
  ); // emitQuestEvent is now defined

  // --- Other helpers (market, station, etc.) ---
  const updateMarketQuantity = useCallback(
    (key: string, change: number) => {
      setGameStateInternal((prev) => {
        if (!prev.market) return prev;
        const currentTable = prev.market.table;
        const currentState = currentTable.get(key);
        if (!currentState) return prev;
        const newTable = new Map<string, CommodityState>(currentTable);
        const newQuantity = Math.max(0, currentState.quantity + change);
        newTable.set(key, { ...currentState, quantity: newQuantity });
        const newMarket = new MarketSnapshot(prev.market.timestamp, newTable);
        return { ...prev, market: newMarket };
      });
    },
    [setGameStateInternal]
  );

  const saveStationPrices = useCallback(
    (stationId: string, prices: Map<string, number>) => {
      setGameStateInternal((prev) => {
        const newKnownPrices = new Map(prev.knownStationPrices);
        newKnownPrices.set(stationId, prices);
        return { ...prev, knownStationPrices: newKnownPrices };
      });
    },
    [setGameStateInternal]
  );

  const completeDocking = useCallback(() => {
    console.log("Action: Complete Docking");
    let dockedStationId: string | null = null;
    setGameStateInternal((prev) => {
      dockedStationId = prev.dockingStationId;
      if (!dockedStationId) {
        console.error("Docking failed: No station ID");
        return {
          ...prev,
          gameView: "playing",
          animationState: { ...prev.animationState, type: null, progress: 0 },
        };
      }
      const station = worldManager.getStationById(dockedStationId);
      let newMarket: MarketSnapshot | null = null;
      if (station)
        newMarket = MarketGenerator.generate(station, WORLD_SEED, Date.now());
      else
        console.error(`Could not find station ${dockedStationId} for market!`);
      const updatedDiscoveredStations = [...prev.discoveredStations];
      if (!updatedDiscoveredStations.includes(dockedStationId))
        updatedDiscoveredStations.push(dockedStationId);
      return {
        ...prev,
        gameView: "trade_select",
        animationState: { ...prev.animationState, type: null, progress: 0 },
        market: newMarket,
        lastDockedStationId: dockedStationId,
        discoveredStations: updatedDiscoveredStations,
      };
    });
    if (dockedStationId)
      setTimeout(
        () =>
          emitQuestEvent({
            type: "DOCK_FINISH",
            stationId: dockedStationId || "",
          }),
        0
      );
  }, [setGameStateInternal, worldManager, emitQuestEvent]); // emitQuestEvent is now defined

  const initiateUndocking = useCallback(() => {
    console.log("Action: Initiate Undocking");
    console.log("SETTING MARKET TO NULL");
    setGameStateInternal((prev) => ({
      ...prev,
      gameView: "undocking",
      market: null,
      animationState: {
        type: "undocking",
        progress: 0,
        duration: prev.animationState.duration,
      },
    }));
  }, [setGameStateInternal]);

  const findStationById = useCallback(
    (stationId: string | null): IStation | null => {
      if (!stationId) return null;
      return worldManager.getStationById(stationId);
    },
    [worldManager]
  );

  // --- Initialization (depends on addQuestItem etc. via load logic) ---
  const initializeGameState = useCallback(() => {
    if (gameState.isInitialized) return;
    console.log("Initializing game state...");
    const loadedData = loadGameState();
    const validQuestState =
      loadedData.questState && typeof loadedData.questState === "object"
        ? loadedData.questState
        : initialQuestState;
    const validQuestInventory =
      loadedData.questInventory instanceof Map
        ? loadedData.questInventory
        : new Map<string, number>();
    const initialExtraCargo = loadedData.cargoPodLevel * 5;
    const initialShootCooldownFactor = loadedData.hasAutoloader ? 0.5 : 1.0;
    setGameStateInternal((prevState) => {
      const loadedPlayer = createPlayer(
        loadedData.coordinates.x,
        loadedData.coordinates.y,
        loadedData.shieldCapacitorLevel
      );
      return {
        ...prevState,
        player: loadedPlayer,
        cash: loadedData.cash,
        cargoHold: loadedData.cargoHold,
        lastDockedStationId: loadedData.lastDockedStationId,
        discoveredStations: loadedData.discoveredStations,
        knownStationPrices: loadedData.knownStationPrices,
        cargoPodLevel: loadedData.cargoPodLevel,
        shieldCapacitorLevel: loadedData.shieldCapacitorLevel,
        engineBoosterLevel: loadedData.engineBoosterLevel,
        hasAutoloader: loadedData.hasAutoloader,
        hasNavComputer: loadedData.hasNavComputer,
        extraCargoCapacity: initialExtraCargo,
        shootCooldownFactor: initialShootCooldownFactor,
        questState: validQuestState,
        questInventory: validQuestInventory,
        isInitialized: true,
        enemies: [],
        projectiles: [],
        visibleBackgroundObjects: [],
        camera: { x: 0, y: 0 },
        gameView: "playing",
        dockingStationId: null,
        animationState: { ...initialGameState.animationState },
        respawnTimer: 0,
        market: null,
        navTargetStationId: null,
        navTargetDirection: null,
        navTargetCoordinates: null,
        navTargetDistance: null,
        viewTargetStationId: null,
      };
    });
    if (saveIntervalId.current) clearInterval(saveIntervalId.current);
    saveIntervalId.current = setInterval(() => {
      setGameStateInternal((currentSyncState) => {
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
            discoveredStations: currentSyncState.discoveredStations,
            knownStationPrices: currentSyncState.knownStationPrices,
            cargoPodLevel: currentSyncState.cargoPodLevel,
            shieldCapacitorLevel: currentSyncState.shieldCapacitorLevel,
            engineBoosterLevel: currentSyncState.engineBoosterLevel,
            hasAutoloader: currentSyncState.hasAutoloader,
            hasNavComputer: currentSyncState.hasNavComputer,
            questState: currentSyncState.questState,
            questInventory: currentSyncState.questInventory,
          });
        } else {
          console.warn("Attempted to save state but player data was invalid.");
        }
        return currentSyncState;
      });
    }, SAVE_STATE_INTERVAL);
    return () => {
      if (saveIntervalId.current) {
        clearInterval(saveIntervalId.current);
        console.log("Cleaned up save interval.");
        saveIntervalId.current = null;
      }
    };
  }, [setGameStateInternal, gameState.isInitialized]); // Keep dependency

  // --- Define updateGame AFTER its dependencies (addQuestItem etc) ---
  const updateGame = useCallback(
    (
      deltaTime: number,
      now: number,
      currentTouchState: ITouchState | undefined
    ) => {
      setGameStateInternal((currentGameState) => {
        if (
          !currentGameState.isInitialized ||
          currentGameState.gameView === "won"
        )
          return currentGameState;

        let navTargetDirection: number | null = null;
        let navTargetCoordinates: IPosition | null = null;
        let navTargetDistance: number | null = null;
        let activatedBeaconId: string | null = null; // Track activated beacon

        if (currentGameState.navTargetStationId && currentGameState.player) {
          const targetStation = worldManager.getStationById(
            currentGameState.navTargetStationId
          );
          if (targetStation) {
            const dx = targetStation.x - currentGameState.player.x;
            const dy = targetStation.y - currentGameState.player.y;
            navTargetDirection = Math.atan2(dy, dx);
            navTargetCoordinates = { x: targetStation.x, y: targetStation.y };
            navTargetDistance = distance(
              currentGameState.player.x,
              currentGameState.player.y,
              targetStation.x,
              targetStation.y
            );
          } else {
            console.warn(
              `Nav target station ${currentGameState.navTargetStationId} not found. Clearing navigation.`
            );
            return {
              ...currentGameState,
              navTargetStationId: null,
              navTargetDirection: null,
              navTargetCoordinates: null,
              navTargetDistance: null,
            };
          }
        }

        const stateForLogic = {
          ...currentGameState,
          navTargetDirection,
          navTargetCoordinates,
          navTargetDistance,
        };
        const {
          newState: nextLogicState,
          activatedBeaconId: beaconIdFromLogic,
        } = updateGameStateLogic(
          stateForLogic,
          currentTouchState,
          worldManager,
          deltaTime,
          now
        );
        activatedBeaconId = beaconIdFromLogic; // Capture beacon ID from logic

        // --- Beacon Activation Side Effects ---
        if (activatedBeaconId) {
          console.log(`Hook: Beacon ${activatedBeaconId} activated.`);
          worldManager.updateBeaconState(activatedBeaconId, true); // Update world manager's beacon state
          // Add quest item for the beacon key - use addQuestItem directly
          addQuestItem("beacon_key", 1);
          // Emit WAYPOINT_REACHED event using emitQuestEvent
          const beacon = worldManager.getBeaconById(activatedBeaconId);
          if (beacon) {
            emitQuestEvent({
              type: "WAYPOINT_REACHED",
              waypointId: activatedBeaconId,
              coord: { x: beacon.x, y: beacon.y },
            });
          }
        }

        // --- Handle State Transitions (Docking, Undocking, Destruction, Respawn) ---
        if (
          currentGameState.gameView === "playing" &&
          !currentGameState.dockingStationId &&
          nextLogicState.dockingStationId &&
          nextLogicState.gameView === "playing"
        ) {
          console.log("Hook: Detected docking initiation signal.");
          let updatedPlayer = nextLogicState.player;
          if (updatedPlayer instanceof Player) {
            updatedPlayer.vx = 0;
            updatedPlayer.vy = 0;
          } else if (updatedPlayer) {
            updatedPlayer = createPlayer(
              updatedPlayer.x,
              updatedPlayer.y,
              currentGameState.shieldCapacitorLevel
            );
            updatedPlayer.angle =
              currentGameState.player?.angle ?? -Math.PI / 2;
            updatedPlayer.vx = 0;
            updatedPlayer.vy = 0;
            console.warn(
              "Player object was not an instance during docking check. Recreated."
            );
          }
          return {
            ...nextLogicState,
            player: updatedPlayer,
            gameView: "docking",
            animationState: {
              type: "docking",
              progress: 0,
              duration: currentGameState.animationState.duration,
            },
            market: null,
          };
        } else if (
          currentGameState.gameView === "docking" &&
          currentGameState.animationState.type === "docking" &&
          nextLogicState.animationState.type === null
        ) {
          console.log("Hook: Detected docking animation completion.");
          const stationId = currentGameState.dockingStationId;
          const station = stationId
            ? worldManager.getStationById(stationId)
            : null;
          let newMarket: MarketSnapshot | null = null;
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
          return {
            ...nextLogicState,
            gameView: "trade_select",
            market: newMarket,
            lastDockedStationId: currentGameState.dockingStationId,
            discoveredStations: updatedDiscoveredStations,
            animationState: {
              ...nextLogicState.animationState,
              type: null,
              progress: 0,
            },
          };
        } else if (
          currentGameState.gameView === "undocking" &&
          currentGameState.animationState.type === "undocking" &&
          nextLogicState.animationState.type === null
        ) {
          console.log("Hook: Detected undocking animation completion.");
          let playerX = nextLogicState.player?.x ?? 0;
          let playerY = nextLogicState.player?.y ?? 0;
          let playerAngle = nextLogicState.player?.angle ?? -Math.PI / 2;
          const stationId = currentGameState.dockingStationId;
          const station = stationId
            ? worldManager.getStationById(stationId)
            : null;
          if (station) {
            const undockDist =
              station.radius +
              (currentGameState.player?.radius ?? PLAYER_SIZE / 2) +
              20;
            const exitAngle = station.angle + Math.PI;
            playerX = station.x + Math.cos(exitAngle) * undockDist;
            playerY = station.y + Math.sin(exitAngle) * undockDist;
            playerAngle = exitAngle;
          } else {
            console.warn("Undocking: Station not found for repositioning.");
          }
          let updatedPlayer = nextLogicState.player;
          if (!(updatedPlayer instanceof Player) && updatedPlayer) {
            updatedPlayer = createPlayer(
              updatedPlayer.x,
              updatedPlayer.y,
              currentGameState.shieldCapacitorLevel
            );
          } else if (!updatedPlayer) {
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
          console.log("SETTING MARKET TO NULL");
          return {
            ...nextLogicState,
            player: updatedPlayer,
            gameView: "playing",
            dockingStationId: null,
            market: null,
            animationState: {
              ...nextLogicState.animationState,
              type: null,
              progress: 0,
            },
          };
        } else if (
          currentGameState.gameView === "playing" &&
          nextLogicState.gameView === "destroyed"
        ) {
          console.log("Hook: Detected destruction transition from logic.");
          return { ...nextLogicState, projectiles: [], enemies: [] };
        } else if (
          currentGameState.gameView === "destroyed" &&
          nextLogicState.gameView === "playing"
        ) {
          console.log("Hook: Detected respawn completion from logic.");
          return nextLogicState;
        }

        // --- Final State Check (Win Condition) ---
        const finalScore = questEngine.calculateQuestCompletion(
          "freedom_v01",
          nextLogicState.questState
        );
        if (finalScore >= 100 && nextLogicState.gameView !== "won") {
          console.log(
            "WIN CONDITION MET (End of Frame)! Emancipation Score >= 100%"
          );
          return { ...nextLogicState, gameView: "won" };
        }

        return {
          ...nextLogicState,
          navTargetDirection,
          navTargetCoordinates,
          navTargetDistance,
        };
      });
      // Make sure all dependencies needed by updateGame are listed *and defined before it*
    },
    [setGameStateInternal, worldManager, emitQuestEvent, addQuestItem]
  );

  const startNewGame = useCallback(() => {
    console.log("Action: Start New Game");
    if (saveIntervalId.current) {
      clearInterval(saveIntervalId.current);
      saveIntervalId.current = null;
    }
    const defaultPosition = { x: 0, y: 0 };
    const defaultCash = initialGameState.cash;
    const defaultCargo = new Map<string, number>();
    const defaultLastDocked = null;
    const defaultDiscoveredStations: string[] = [];
    const defaultKnownPrices = new Map<string, Map<string, number>>();
    const defaultQuestState = initialQuestState;
    const defaultQuestInventory = new Map<string, number>();
    setGameStateInternal((prev) => ({
      ...initialGameState,
      player: createPlayer(defaultPosition.x, defaultPosition.y, 0),
      cash: defaultCash,
      cargoHold: defaultCargo,
      lastDockedStationId: defaultLastDocked,
      discoveredStations: defaultDiscoveredStations,
      knownStationPrices: defaultKnownPrices,
      cargoPodLevel: 0,
      shieldCapacitorLevel: 0,
      engineBoosterLevel: 0,
      hasAutoloader: false,
      hasNavComputer: false,
      extraCargoCapacity: 0,
      shootCooldownFactor: 1.0,
      questState: defaultQuestState,
      questInventory: defaultQuestInventory,
      gameView: "playing",
      isInitialized: true,
      enemies: [],
      projectiles: [],
      visibleBackgroundObjects: [],
      camera: { x: 0 - GAME_WIDTH / 2, y: 0 - GAME_VIEW_HEIGHT / 2 },
      dockingStationId: null,
      animationState: {
        type: null,
        progress: 0,
        duration: prev.animationState.duration,
      },
      respawnTimer: 0,
      market: null,
      navTargetStationId: null,
      navTargetDirection: null,
      navTargetCoordinates: null,
      navTargetDistance: null,
      viewTargetStationId: null,
      lastEnemySpawnTime: 0,
      lastShotTime: 0,
      enemyIdCounter: 0,
    }));
    saveGameState({
      coordinates: defaultPosition,
      cash: defaultCash,
      cargoHold: defaultCargo,
      lastDockedStationId: defaultLastDocked,
      discoveredStations: defaultDiscoveredStations,
      knownStationPrices: defaultKnownPrices,
      cargoPodLevel: 0,
      shieldCapacitorLevel: 0,
      engineBoosterLevel: 0,
      hasAutoloader: false,
      hasNavComputer: false,
      questState: defaultQuestState,
      questInventory: defaultQuestInventory,
    });
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
            discoveredStations: currentSyncState.discoveredStations,
            knownStationPrices: currentSyncState.knownStationPrices,
            cargoPodLevel: currentSyncState.cargoPodLevel,
            shieldCapacitorLevel: currentSyncState.shieldCapacitorLevel,
            engineBoosterLevel: currentSyncState.engineBoosterLevel,
            hasAutoloader: currentSyncState.hasAutoloader,
            hasNavComputer: currentSyncState.hasNavComputer,
            questState: currentSyncState.questState,
            questInventory: currentSyncState.questInventory,
          });
        }
        return currentSyncState;
      });
    }, SAVE_STATE_INTERVAL);
  }, [setGameStateInternal]);

  // --- Return Hook API ---
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
    findStationById,
    startNewGame,
    saveStationPrices,
    purchaseUpgrade,
    totalCargoCapacity,
    // Quest related exports
    emitQuestEvent,
    addQuestItem,
    removeQuestItem,
    questEngine: questEngine,
    emancipationScore,
  };
}
