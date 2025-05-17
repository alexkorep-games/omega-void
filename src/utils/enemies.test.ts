import { describe, it, expect } from "vitest";
import { getDynamicMaxEnemies } from "./enemies";
import type { CargoHold } from "../game/types";
import type { CommodityDefinition } from "../game/Market";

// Minimal mock for InfiniteWorldManager
class MockWorldManager {
  private stationTechLevel: string | null;
  constructor(techLevel: string | null = null) {
    this.stationTechLevel = techLevel;
  }
  getStationById(stationId: string | null) {
    if (!stationId || this.stationTechLevel === null) return null;
    return { techLevel: this.stationTechLevel };
  }
}

describe("getDynamicMaxEnemies", () => {
  const commodityDefinitions: CommodityDefinition[] = [
    { key: "Water", basePrice: 10, baseQuantity: 100, unit: "t" },
    { key: "Gold", basePrice: 1000, baseQuantity: 10, unit: "kg" },
  ];

  it("returns 1 when cargo value is below threshold", () => {
    const cargoHold: CargoHold = { Water: 5 }; // 5*10=50 < 100
    const worldManager = new MockWorldManager("TL0");
    expect(
      getDynamicMaxEnemies(
        cargoHold,
        commodityDefinitions,
        null,
        worldManager as any
      )
    ).toBe(1);
  });

  it("returns 1 when cargo value is just above threshold and TL0", () => {
    const cargoHold: CargoHold = { Water: 11 }; // 11*10=110 > 100
    const worldManager = new MockWorldManager("TL0");
    expect(
      getDynamicMaxEnemies(
        cargoHold,
        commodityDefinitions,
        "station_0_0",
        worldManager as any
      )
    ).toBeGreaterThanOrEqual(1);
  });

  it("returns max enemies at max cargo value", () => {
    const cargoHold: CargoHold = { Gold: 100 }; // 100*1000=100000 > 50000
    const worldManager = new MockWorldManager("TL0");
    expect(
      getDynamicMaxEnemies(
        cargoHold,
        commodityDefinitions,
        "station_0_0",
        worldManager as any
      )
    ).toBe(20);
  });

  it("applies tech level reduction", () => {
    const cargoHold: CargoHold = { Gold: 50 }; // 50*1000=50000
    const worldManager = new MockWorldManager("TL5");
    // TL5 = 50% reduction, so 20 * 0.5 = 10
    expect(
      getDynamicMaxEnemies(
        cargoHold,
        commodityDefinitions,
        "station_0_0",
        worldManager as any
      )
    ).toBe(10);
  });

  it("returns at least 1 if cargo value > 0 and reduction would go below 1", () => {
    const cargoHold: CargoHold = { Water: 11 }; // 110 > 100, but low value
    const worldManager = new MockWorldManager("TL9"); // Nonexistent TL, should default to 0
    expect(
      getDynamicMaxEnemies(
        cargoHold,
        commodityDefinitions,
        "station_0_0",
        worldManager as any
      )
    ).toBeGreaterThanOrEqual(1);
  });

  it("returns 0 if cargo is empty", () => {
    const cargoHold: CargoHold = {};
    const worldManager = new MockWorldManager("TL0");
    expect(
      getDynamicMaxEnemies(
        cargoHold,
        commodityDefinitions,
        null,
        worldManager as any
      )
    ).toBe(0);
  });
});
