import { describe, test, expect } from "vitest";
import { createPlayer, updateGameStateLogic, handleBeaconActivationAndUpdateQuest } from "./logic";
import { IBeacon, IGameState } from "./types";
import { InfiniteWorldManager } from "./world/InfiniteWorldManager";
import * as C from "./config";
import { MarketSnapshot } from "./Market";

// Minimal mock for InfiniteWorldManager
class MockWorldManager implements Partial<InfiniteWorldManager> {
  getObjectsInView() {
    return [];
  }
  getStationById() {
    return null;
  }
  getEnemiesToDespawn() {
    return [];
  }
}
const worldManager = new MockWorldManager() as unknown as InfiniteWorldManager;

// Mock for InfiniteWorldManager with beacon handling
class MockWorldManagerWithBeacons implements Partial<InfiniteWorldManager> {
  private beacons: Record<string, { isActive: boolean }> = {
    beacon_nw_key1: { isActive: false },
    beacon_ne_key2: { isActive: false },
  };

  getBeaconById(id: string) {
    return this.beacons[id] ? { id, ...this.beacons[id] } as IBeacon : null;
  }

  updateBeaconState(id: string, isActive: boolean) {
    if (this.beacons[id]) {
      this.beacons[id].isActive = isActive;
    }
  }
}
const worldManagerWithBeacons = new MockWorldManagerWithBeacons() as unknown as InfiniteWorldManager;

// Helper to build a baseline game state
function makeBaseState(): IGameState {
  const market: MarketSnapshot = new MarketSnapshot(Date.now(), {});

  return {
    player: createPlayer(10, 20),
    enemies: [],
    projectiles: [],
    enemyIdCounter: 1,
    lastEnemySpawnTime: 0,
    lastShotTime: 0,
    visibleBackgroundObjects: [],
    activeDestructionAnimations: [],
    cargoHold: {},
    camera: { x: 0, y: 0 },
    gameView: "playing" as const,
    respawnTimer: 0,
    dockingStationId: null,
    lastDockedStationId: null,
    animationState: { type: null, progress: 0, duration: 0 },
    cash: 0,
    isInitialized: true,
    cargoCapacity: 100,
    market,
  } as unknown as IGameState;
}

describe("logic.ts", () => {
  test("createPlayer sets position and defaults", () => {
    const p = createPlayer(5, 7);
    expect(p.x).toBe(5);
    expect(p.y).toBe(7);
    expect(p.radius).toBeDefined();
    expect(p.shieldLevel).toBe(C.DEFAULT_STARTING_SHIELD);
  });

  test("playing update with no input is no-op", () => {
    const state = makeBaseState();
    const now = performance.now();
    const { newState } = updateGameStateLogic(
      state,
      undefined,
      worldManager,
      16,
      now
    );
    // No enemies, no projectiles, view remains playing
    expect(newState.gameView).toBe("playing");
    expect(newState.enemies).toHaveLength(0);
    expect(newState.projectiles).toHaveLength(0);
    // Camera follows player
    expect(newState.camera.x).toBeCloseTo(state.player.x - C.GAME_WIDTH / 2);
  });

  test("respawn after destroyed state resets player & clears enemies/projectiles", () => {
    const base = makeBaseState();
    const deadState: IGameState = {
      ...base,
      gameView: "destroyed",
      respawnTimer: 50,
    };
    const now = performance.now();
    // advance more than respawnTimer
    const { newState } = updateGameStateLogic(
      deadState,
      undefined,
      worldManager,
      100,
      now
    );
    expect(newState.gameView).toBe("playing");
    expect(newState.respawnTimer).toBe(0);
    expect(newState.enemies).toHaveLength(0);
    expect(newState.projectiles).toHaveLength(0);
    // New player instance at some position (not NaN)
    expect(newState.player.x).not.toBeNaN();
    expect(newState.player.shieldLevel).toBe(C.DEFAULT_STARTING_SHIELD);
  });
});

describe("handleBeaconActivationAndUpdateQuest", () => {
  test("activates a beacon and updates quest state", () => {
    const initialState: IGameState = {
      ...makeBaseState(),
      questState: {
        quests: {
          freedom_v01: {
            reach_beacon_nw: { done: false },
            beaconKeys: { current: 0, done: false },
          },
        },
      },
    };

    const { updatedState, questStateModified } =
      handleBeaconActivationAndUpdateQuest(
        initialState,
        "beacon_nw_key1",
        worldManagerWithBeacons
      );

    expect(questStateModified).toBe(true);
    expect(updatedState.questState.quests.freedom_v01.reach_beacon_nw.done).toBe(true);
    expect(updatedState.questState.quests.freedom_v01.beaconKeys.current).toBe(1);
    expect(worldManagerWithBeacons.getBeaconById("beacon_nw_key1")?.isActive).toBe(true);
  });

  test("does not modify quest state if beacon is already active", () => {
    worldManagerWithBeacons.updateBeaconState("beacon_nw_key1", true);

    const initialState: IGameState = {
      ...makeBaseState(),
      questState: {
        quests: {
          freedom_v01: {
            reach_beacon_nw: { done: true },
            beaconKeys: { current: 1, done: false },
          },
        },
      },
    };

    const { updatedState, questStateModified } =
      handleBeaconActivationAndUpdateQuest(
        initialState,
        "beacon_nw_key1",
        worldManagerWithBeacons
      );

    expect(questStateModified).toBe(false);
    expect(updatedState.questState).toEqual(initialState.questState);
  });

  test("handles missing beacon gracefully", () => {
    const initialState: IGameState = makeBaseState();

    const { updatedState, questStateModified } =
      handleBeaconActivationAndUpdateQuest(
        initialState,
        "nonexistent_beacon",
        worldManagerWithBeacons
      );

    expect(questStateModified).toBe(false);
    expect(updatedState).toEqual(initialState);
  });

  test("updates beaconKeys objective when all beacons are activated", () => {
    const initialState: IGameState = {
      ...makeBaseState(),
      questState: {
        quests: {
          freedom_v01: {
            reach_beacon_nw: { done: true },
            reach_beacon_ne: { done: false },
            beaconKeys: { current: 1, done: false },
          },
        },
      },
    };

    const { updatedState, questStateModified } =
      handleBeaconActivationAndUpdateQuest(
        initialState,
        "beacon_ne_key2",
        worldManagerWithBeacons
      );

    expect(questStateModified).toBe(true);
    expect(updatedState.questState.quests.freedom_v01.reach_beacon_ne.done).toBe(true);
    expect(updatedState.questState.quests.freedom_v01.beaconKeys.current).toBe(2);
    expect(updatedState.questState.quests.freedom_v01.beaconKeys.done).toBe(false);
  });
});
