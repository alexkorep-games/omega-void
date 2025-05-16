import { describe, test, expect } from "vitest";
import { createPlayer, updateGameStateLogic } from "./logic"; // Removed handleBeaconActivationAndUpdateQuest from import
import { IGameState } from "./types"; // Removed IBeacon as it's not directly tested here anymore
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
  // Removed getBeaconById and updateBeaconState mocks as they are removed from InfiniteWorldManager
}
const worldManager = new MockWorldManager() as unknown as InfiniteWorldManager;

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
    expect(newState.gameView).toBe("playing");
    expect(newState.enemies).toHaveLength(0);
    expect(newState.projectiles).toHaveLength(0);
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
    expect(newState.player.x).not.toBeNaN();
    expect(newState.player.shieldLevel).toBe(C.DEFAULT_STARTING_SHIELD);
  });
});
