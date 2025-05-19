import { describe, test, expect } from "vitest";
import { InfiniteWorldManager } from "./InfiniteWorldManager";
import { IWorldManagerConfig } from "../types";

// Mock configuration for testing
const mockConfig: IWorldManagerConfig = {
  cellSize: 100,
  seedPrime1: 73856093,
  seedPrime2: 19349663,
  seedPrime3: 83492791,
  starBaseDensity: 0.1,
  minStarSize: 1,
  maxStarSize: 3,
  starColor: "white",
  stationProbability: 0.5,
  minStationSize: 5,
  averageStationSize: 10,
  stationColor: "gray",
  stationTypes: ["coriolis"],
  viewBufferFactor: 1.5,
  economyTypes: ["Agricultural", "Industrial"],
  techLevels: ["TL1", "TL2"],
};

describe("InfiniteWorldManager", () => {
  test("should initialize with default configuration", () => {
    const manager = new InfiniteWorldManager();
    expect(manager).toBeDefined();
  });

  test("should generate objects for a cell", () => {
    const manager = new InfiniteWorldManager(mockConfig);
    const objects = manager["_generateObjectsForCell"](0, 0);
    expect(objects).toBeInstanceOf(Array);
    expect(objects.length).toBeGreaterThan(0);
  });

  test("should retrieve objects in view", () => {
    const manager = new InfiniteWorldManager(mockConfig);
    const objects = manager.getObjectsInView(0, 0, 200, 200);
    expect(objects).toBeInstanceOf(Array);
    expect(objects.length).toBeGreaterThan(0);
  });

  test("should retrieve a station by ID", () => {
    const manager = new InfiniteWorldManager(mockConfig);
    const objects = manager["_generateObjectsForCell"](0, 0);
    const station = objects.find((obj) => obj.type === "station");
    if (station) {
      const retrievedStation = manager.getStationById(station.id);
      expect(retrievedStation).toBeDefined();
      expect(retrievedStation?.id).toBe(station.id);
    }
  });

  test("should determine enemies to despawn", () => {
    const manager = new InfiniteWorldManager(mockConfig);
    const enemies = [
      { id: "enemy_1", x: 0, y: 0, angle: 0, size: 10, radius: 5, color: "red" },
      { id: "enemy_2", x: 500, y: 500, angle: 0, size: 10, radius: 5, color: "red" },
    ];
    const despawned = manager.getEnemiesToDespawn(enemies, 0, 0, 100);
    expect(despawned).toContain("enemy_2");
    expect(despawned).not.toContain("enemy_1");
  });
});