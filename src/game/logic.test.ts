import { describe, test, expect } from "vitest";
import { createPlayer, updateGameStateLogic } from "./logic";
import { IGameState } from "./types";
import { InfiniteWorldManager } from "./world/InfiniteWorldManager";
import * as C from "./config";
import { CommodityState, MarketSnapshot } from "./Market";

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

// Helper to build a baseline game state
function makeBaseState(): IGameState {
  const market: MarketSnapshot = {
    timestamp: Date.now(),
    table: new Map<string, CommodityState>(),
    get(key: string) {
      return this.table.get(key);
    },
    entries() {
      return this.table.entries();
    },
  };

  return {
    player: createPlayer(10, 20),
    enemies: [],
    projectiles: [],
    enemyIdCounter: 1,
    lastEnemySpawnTime: 0,
    lastShotTime: 0,
    visibleBackgroundObjects: [],
    activeDestructionAnimations: [],
    cargoHold: new Map(),
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
  };
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
    const newState = updateGameStateLogic(state, undefined, worldManager, 16, now);
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
    const result = updateGameStateLogic(deadState, undefined, worldManager, 100, now);
    expect(result.gameView).toBe("playing");
    expect(result.respawnTimer).toBe(0);
    expect(result.enemies).toHaveLength(0);
    expect(result.projectiles).toHaveLength(0);
    // New player instance at some position (not NaN)
    expect(result.player.x).not.toBeNaN();
    expect(result.player.shieldLevel).toBe(C.DEFAULT_STARTING_SHIELD);
  });
});
