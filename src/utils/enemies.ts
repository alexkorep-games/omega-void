import { CargoHold } from "../game/types";
import { InfiniteWorldManager } from "../game/world/InfiniteWorldManager";
import { CommodityDefinition } from "../game/Market";

// Helper to calculate cargo value (copy from logic.ts)
function calculateCargoValue(
  cargoHold: CargoHold,
  commodityDefinitions: CommodityDefinition[]
): number {
  let totalValue = 0;
  for (const itemKey in cargoHold) {
    const quantity = cargoHold[itemKey];
    const commodityDef = commodityDefinitions.find((c) => c.key === itemKey);
    if (commodityDef && quantity) {
      totalValue += quantity * commodityDef.basePrice;
    }
  }
  return totalValue;
}

// Helper to get tech level number (copy from Market.ts)
function getTechLevelNumber(tl: string): number {
  if (typeof tl === "string" && tl.startsWith("TL")) {
    return parseInt(tl.replace("TL", ""), 10);
  }
  return 0;
}

/**
 * Calculates the dynamic maximum number of enemies based on cargo value and last docked station tech level.
 */
export function getDynamicMaxEnemies(
  cargoHold: CargoHold,
  commodityDefinitions: CommodityDefinition[],
  lastDockedStationId: string | null,
  worldManager: InfiniteWorldManager
): number {
  const cargoValue = calculateCargoValue(cargoHold, commodityDefinitions);
  let maxEnemiesFromCargo: number;
  const CARGO_VALUE_MIN_THRESHOLD = 100;
  const CARGO_VALUE_MAX_THRESHOLD = 50000;
  const MAX_ENEMIES_AT_MAX_CARGO = 20;

  if (cargoValue < CARGO_VALUE_MIN_THRESHOLD) {
    maxEnemiesFromCargo = 0;
  } else if (cargoValue >= CARGO_VALUE_MAX_THRESHOLD) {
    maxEnemiesFromCargo = MAX_ENEMIES_AT_MAX_CARGO;
  } else {
    // Logarithmic scaling for values between min and max threshold
    const logFactor =
      Math.log(cargoValue / CARGO_VALUE_MIN_THRESHOLD) /
      Math.log(CARGO_VALUE_MAX_THRESHOLD / CARGO_VALUE_MIN_THRESHOLD);
    maxEnemiesFromCargo = Math.round(logFactor * MAX_ENEMIES_AT_MAX_CARGO);
  }

  let techLevelNumber = 0; // Default to lowest tech (TL0) for no reduction
  if (lastDockedStationId) {
    const lastStation = worldManager.getStationById(lastDockedStationId);
    if (lastStation) {
      techLevelNumber = getTechLevelNumber(lastStation.techLevel);
    }
  }

  const techReductionFactor = techLevelNumber * 0.1; // 10% reduction per tech level
  const dynamicMaxEnemies = Math.max(
    1, // At least 1 enemy should spawn
    Math.round(maxEnemiesFromCargo * (1 - techReductionFactor))
  );
  return dynamicMaxEnemies;
}
