// src/game/Market.ts — Commodity & Market logic for Elite‑style trading
// Adapted for Game 2

// Import types from the single source of truth
import {
  IStation,
  EconomyType,
  TechLevel,
  CommodityTable,
  CommodityState, // Import the shared type
} from "./types";
import { SeedablePRNG } from "./world/SeedablePRNG"; // Use Game 2 PRNG

// CommodityDefinition remains the same
export interface CommodityDefinition {
  /** Unique key / name */
  key: string;
  /** Base average price in credits */
  basePrice: number;
  /** Base average quantity available */
  baseQuantity: number;
  /** Unit of measurement (tonnes, kilograms, grams) */
  unit: "t" | "kg" | "g";
  /** Economy production map: price∆ / quantity multiplier */
  econEffect?: Partial<Record<EconomyType, { dp: number; qMult: number }>>;
  /** Minimum tech level required before a planet can *ever* stock it */
  minTechLevel?: TechLevel;
}

// Map Tech Level string to number for comparison
export function getTechLevelNumber(tl: TechLevel): number {
  return parseInt(tl.replace("TL", ""), 10);
}

// COMMODITIES array remains the same
export const COMMODITIES: CommodityDefinition[] = [
  {
    key: "Food",
    basePrice: 6,
    baseQuantity: 40,
    unit: "t",
    econEffect: {
      "Poor Agricultural": { dp: -1, qMult: 1.3 },
      Agricultural: { dp: -1, qMult: 1.4 },
      "Rich Agricultural": { dp: -2, qMult: 1.6 },
      "Poor Industrial": { dp: +1, qMult: 0.7 },
      Industrial: { dp: +1, qMult: 0.6 },
      "Rich Industrial": { dp: +2, qMult: 0.5 },
    },
  },
  {
    key: "Textiles",
    basePrice: 8,
    baseQuantity: 35,
    unit: "t",
    econEffect: {
      "Poor Agricultural": { dp: -1, qMult: 1.2 },
      Agricultural: { dp: -1, qMult: 1.2 },
      "Rich Agricultural": { dp: -2, qMult: 1.3 },
      Industrial: { dp: +1, qMult: 0.6 },
    },
  },
  {
    key: "Radioactives",
    basePrice: 20,
    baseQuantity: 15,
    unit: "t",
    minTechLevel: "TL3",
  },
  {
    key: "Liquor", // Renamed
    basePrice: 25,
    baseQuantity: 20,
    unit: "t",
    econEffect: {
      "Rich Agricultural": { dp: -3, qMult: 1.5 },
    },
  },
  {
    key: "Luxuries",
    basePrice: 90,
    baseQuantity: 5,
    unit: "t",
    minTechLevel: "TL4",
    econEffect: {
      "Rich Industrial": { dp: -5, qMult: 1.5 },
    },
  },
  {
    key: "Computers",
    basePrice: 100,
    baseQuantity: 4,
    unit: "t",
    minTechLevel: "TL3",
    econEffect: {
      "High Tech": { dp: -20, qMult: 3.0 },
      "Rich Industrial": { dp: -10, qMult: 2.0 },
      Industrial: { dp: -5, qMult: 1.2 },
      "Poor Agricultural": { dp: +25, qMult: 0.1 },
      "Rich Agricultural": { dp: +20, qMult: 0.15 },
    },
  },
  {
    key: "Machinery",
    basePrice: 60,
    baseQuantity: 10,
    unit: "t",
    minTechLevel: "TL2",
    econEffect: {
      Industrial: { dp: -5, qMult: 1.8 },
      "Rich Industrial": { dp: -8, qMult: 2.2 },
    },
  },
  {
    key: "Alloys",
    basePrice: 32,
    baseQuantity: 25,
    unit: "t",
    econEffect: {
      "Poor Industrial": { dp: -2, qMult: 1.3 },
      Industrial: { dp: 0, qMult: 1.1 },
    },
  },
  {
    key: "Firearms",
    basePrice: 75,
    baseQuantity: 8,
    unit: "t",
    minTechLevel: "TL4",
    econEffect: {
      "Rich Industrial": { dp: -8, qMult: 1.4 },
    },
  },
  {
    key: "Furs",
    basePrice: 70,
    baseQuantity: 6,
    unit: "t",
    econEffect: {
      "Poor Agricultural": { dp: -8, qMult: 2.2 },
      "Rich Agricultural": { dp: -10, qMult: 2.5 },
      "High Tech": { dp: +15, qMult: 0.2 },
    },
  },
  {
    key: "Minerals",
    basePrice: 12,
    baseQuantity: 30,
    unit: "t",
    econEffect: {},
  },
  {
    key: "Gold",
    basePrice: 160,
    baseQuantity: 1,
    unit: "kg", // Changed unit
    econEffect: {},
    minTechLevel: "TL5",
  },
  {
    key: "Platinum",
    basePrice: 200,
    baseQuantity: 0.5,
    unit: "kg",
    minTechLevel: "TL6",
    econEffect: {},
  }, // Example
  {
    key: "Gem-Stones",
    basePrice: 20,
    baseQuantity: 10,
    unit: "g",
    minTechLevel: "TL4",
    econEffect: {},
  }, // Example
  {
    key: "Alien Items",
    basePrice: 60,
    baseQuantity: 2,
    unit: "t",
    minTechLevel: "TL7",
    econEffect: {
      "High Tech": { dp: -10, qMult: 1.5 },
    },
  }, // Example
];

// Utility Helpers remain the same
/** Helper to get the unit definition for a commodity */
export const getCommodityUnit = (key: string): CommodityDefinition["unit"] => {
  const commodityDef = COMMODITIES.find((c) => c.key === key);
  return commodityDef?.unit || "t"; // Default to tonnes if not found
};

/** Helper to get the weight in tonnes for 1 unit of a commodity */
export const getTonnesPerUnit = (key: string): number => {
  const unit = getCommodityUnit(key);
  if (unit === "kg") return 0.001;
  if (unit === "g") return 0.000001;
  return 1;
};

// Market snapshot class using CommodityTable (Record)
export class MarketSnapshot {
  readonly timestamp: number;
  readonly table: CommodityTable; // Use the Record type

  constructor(timestamp: number, table: CommodityTable) {
    this.timestamp = timestamp;
    this.table = table;
  }

  /** Get price+stock for a given commodity key */
  get(key: string): CommodityState | undefined {
    return this.table[key]; // Direct access for Record
  }

  /** Iterate through all commodities */
  entries(): [string, CommodityState][] {
    return Object.entries(this.table); // Use Object.entries for Record
  }
}

// Market Generator remains mostly the same, but creates a Record
export class MarketGenerator {
  static generate(
    station: IStation,
    worldSeed: number,
    visitSerial = 0
  ): MarketSnapshot {
    const seed = MarketGenerator.combineSeed(
      worldSeed,
      station.coordinates.x,
      station.coordinates.y,
      visitSerial
    );
    const rng = new SeedablePRNG(seed);

    const table: CommodityTable = {}; // Initialize as empty object (Record)

    for (const c of COMMODITIES) {
      if (
        c.minTechLevel &&
        getTechLevelNumber(station.techLevel) <
          getTechLevelNumber(c.minTechLevel)
      ) {
        continue;
      }

      const econAdj = c.econEffect?.[station.economyType];
      const dPrice = econAdj?.dp ?? 0;
      const qMult = econAdj?.qMult ?? 1;

      const techLevelNum = getTechLevelNumber(station.techLevel);
      const techAdj = (techLevelNum - 3) * 2;

      let price = Math.max(1, c.basePrice + dPrice - techAdj);
      let quantity = Math.round(c.baseQuantity * qMult);

      const priceJitter = (rng.random() - 0.5) * 0.1;
      const qtyJitter = (rng.random() - 0.5) * 0.2;

      price = Math.max(1, Math.round(price * (1 + priceJitter)));
      quantity = Math.max(0, Math.round(quantity * (1 + qtyJitter)));

      if (quantity === 0 && c.baseQuantity === 0) continue;
      if (c.baseQuantity === 0 && qMult <= 1 && quantity > 0) quantity = 0;
      if (quantity === 0 && qMult > 0) continue; // Don't add if 0 qty

      if (quantity > 0 || price > 0) {
        // Assign directly to the Record
        table[c.key] = { price, quantity }; // This now matches CommodityState type
      }
    }

    return new MarketSnapshot(visitSerial, table); // Pass the Record
  }

  // Helper combineSeed remains the same
  private static combineSeed(
    worldSeed: number,
    x: number,
    y: number,
    visitSerial: number
  ): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    let h = worldSeed ^ (ix << 16) ^ (iy << 8) ^ visitSerial;
    h = (h ^ (h >>> 15)) * 0x2c1b3c6d;
    h = (h ^ (h >>> 12)) * 0x297a2d39;
    h = h ^ (h >>> 15);
    return ((h >>> 0) % 2147483647) + 1; // Make positive and non-zero
  }
}
