// src/game/Market.ts

// Import types from the single source of truth
import { MIN_STATION_SIZE } from "./config";
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

// COMMODITIES array - Expanded with more items and wider price range
export const COMMODITIES: CommodityDefinition[] = [
  // --- Basic Necessities ---
  {
    key: "Water",
    basePrice: 3, // Very cheap
    baseQuantity: 50,
    unit: "t",
    econEffect: {
      "Poor Agricultural": { dp: 0, qMult: 1.2 },
      Agricultural: { dp: -1, qMult: 1.5 },
      "Rich Agricultural": { dp: -1, qMult: 1.7 },
      "Poor Industrial": { dp: +1, qMult: 0.8 },
      Industrial: { dp: +1, qMult: 0.7 },
      "Rich Industrial": { dp: +2, qMult: 0.6 },
    },
  },
  {
    key: "Food",
    basePrice: 10, // Slightly higher base price
    baseQuantity: 40,
    unit: "t",
    econEffect: {
      "Poor Agricultural": { dp: -2, qMult: 1.3 },
      Agricultural: { dp: -3, qMult: 1.4 },
      "Rich Agricultural": { dp: -5, qMult: 1.6 },
      "Poor Industrial": { dp: +3, qMult: 0.7 },
      Industrial: { dp: +4, qMult: 0.6 },
      "Rich Industrial": { dp: +6, qMult: 0.5 },
      "High Tech": { dp: +5, qMult: 0.4 },
    },
  },
  // --- Raw Materials ---
  {
    key: "Minerals",
    basePrice: 20, // Increased base price
    baseQuantity: 30,
    unit: "t",
    econEffect: {
      "Poor Industrial": { dp: +2, qMult: 0.8 }, // Consumed by industry
      Industrial: { dp: +3, qMult: 0.6 },
      "Rich Industrial": { dp: +5, qMult: 0.4 },
    },
  },
  {
    key: "Alloys",
    basePrice: 75, // Increased base price
    baseQuantity: 25,
    unit: "t",
    minTechLevel: "TL2",
    econEffect: {
      "Poor Industrial": { dp: -5, qMult: 1.3 }, // Produced by industry
      Industrial: { dp: -10, qMult: 1.5 },
      "Rich Industrial": { dp: -15, qMult: 1.8 },
      "High Tech": { dp: -5, qMult: 1.2 }, // Also produced/used
    },
  },
  {
    key: "Rare Gases",
    basePrice: 350,
    baseQuantity: 8,
    unit: "t",
    minTechLevel: "TL5",
    econEffect: {
      "High Tech": { dp: -20, qMult: 1.6 }, // Consumed/Produced? Let's say produced
      Industrial: { dp: +10, qMult: 0.5 }, // Consumed?
    },
  },
  {
    key: "Radioactives",
    basePrice: 150, // Increased base price
    baseQuantity: 15,
    unit: "t",
    minTechLevel: "TL3",
    econEffect: {
      "High Tech": { dp: -15, qMult: 1.3 },
      "Rich Industrial": { dp: -10, qMult: 1.1 },
      Industrial: { dp: +5, qMult: 0.8 },
    },
  },
  // --- Agricultural Goods ---
  {
    key: "Textiles",
    basePrice: 15, // Increased base price
    baseQuantity: 35,
    unit: "t",
    econEffect: {
      "Poor Agricultural": { dp: -2, qMult: 1.2 },
      Agricultural: { dp: -3, qMult: 1.3 },
      "Rich Agricultural": { dp: -5, qMult: 1.5 },
      Industrial: { dp: +3, qMult: 0.6 },
      "Rich Industrial": { dp: +5, qMult: 0.4 },
    },
  },
  {
    key: "Liquor",
    basePrice: 50, // Increased base price
    baseQuantity: 20,
    unit: "t",
    econEffect: {
      "Rich Agricultural": { dp: -10, qMult: 1.5 },
      Agricultural: { dp: -5, qMult: 1.2 },
      "Rich Industrial": { dp: +8, qMult: 0.7 }, // Higher demand maybe
    },
  },
  {
    key: "Furs",
    basePrice: 180, // Increased base price
    baseQuantity: 6,
    unit: "t",
    econEffect: {
      "Poor Agricultural": { dp: -15, qMult: 2.2 },
      Agricultural: { dp: -20, qMult: 2.0 },
      "Rich Agricultural": { dp: -30, qMult: 2.5 },
      "High Tech": { dp: +25, qMult: 0.2 },
      "Rich Industrial": { dp: +20, qMult: 0.5 },
    },
  },
  // --- Industrial Goods ---
  {
    key: "Machinery",
    basePrice: 120, // Increased base price
    baseQuantity: 10,
    unit: "t",
    minTechLevel: "TL2",
    econEffect: {
      "Poor Industrial": { dp: -5, qMult: 1.2 },
      Industrial: { dp: -15, qMult: 1.8 },
      "Rich Industrial": { dp: -25, qMult: 2.2 },
      "Poor Agricultural": { dp: +10, qMult: 0.5 }, // Needs machinery
      Agricultural: { dp: +8, qMult: 0.6 },
    },
  },
  {
    key: "Medicines",
    basePrice: 80,
    baseQuantity: 10,
    unit: "t",
    minTechLevel: "TL3",
    econEffect: {
      "High Tech": { dp: -10, qMult: 1.5 },
      "Rich Industrial": { dp: -5, qMult: 1.2 },
      "Poor Agricultural": { dp: +10, qMult: 0.8 }, // Higher demand?
      "Poor Industrial": { dp: +8, qMult: 0.9 }, // Higher demand?
    },
  },
  {
    key: "Robots",
    basePrice: 1500, // High value industrial item
    baseQuantity: 3,
    unit: "t", // Assuming bulk or large robots
    minTechLevel: "TL5",
    econEffect: {
      "High Tech": { dp: -150, qMult: 2.5 },
      "Rich Industrial": { dp: -100, qMult: 1.8 },
      Industrial: { dp: -50, qMult: 1.2 },
      Agricultural: { dp: +80, qMult: 0.3 }, // Demand for automation
    },
  },
  // --- High-Tech Goods ---
  {
    key: "Computers",
    basePrice: 400, // Significantly increased base price
    baseQuantity: 4,
    unit: "t", // Bulk components/systems
    minTechLevel: "TL3",
    econEffect: {
      "High Tech": { dp: -80, qMult: 3.0 },
      "Rich Industrial": { dp: -40, qMult: 2.0 },
      Industrial: { dp: -20, qMult: 1.2 },
      "Poor Agricultural": { dp: +100, qMult: 0.1 },
      "Rich Agricultural": { dp: +80, qMult: 0.15 },
    },
  },
  {
    key: "Adv Components", // Advanced Electronics / Quantum Processors etc.
    basePrice: 1800,
    baseQuantity: 2,
    unit: "kg", // More valuable per mass
    minTechLevel: "TL6",
    econEffect: {
      "High Tech": { dp: -200, qMult: 3.5 },
      "Rich Industrial": { dp: +100, qMult: 0.5 }, // Consumes them
    },
  },
  // --- Luxury & Rare Goods ---
  {
    key: "Luxuries",
    basePrice: 500, // Increased base price
    baseQuantity: 5,
    unit: "t",
    minTechLevel: "TL4",
    econEffect: {
      "Rich Industrial": { dp: -50, qMult: 1.5 },
      "High Tech": { dp: -40, qMult: 1.3 },
      "Rich Agricultural": { dp: -30, qMult: 1.2 }, // Some luxury production
      "Poor Industrial": { dp: +50, qMult: 0.3 }, // High demand, low supply
      "Poor Agricultural": { dp: +60, qMult: 0.2 },
    },
  },
  {
    key: "Gem-Stones",
    basePrice: 80, // Increased base price per gram
    baseQuantity: 10, // Base 10g available
    unit: "g",
    minTechLevel: "TL4",
    econEffect: {
      // Maybe slightly more common near mining/industrial?
      "Rich Industrial": { dp: +10, qMult: 0.8 }, // Demand for jewelry
      "High Tech": { dp: +15, qMult: 0.7 }, // Demand for tech uses?
    },
  },
  {
    key: "Gold",
    basePrice: 300, // Increased base price per kg
    baseQuantity: 1, // Base 1kg available
    unit: "kg",
    econEffect: {
      "Rich Industrial": { dp: +20, qMult: 0.9 }, // Demand
      "High Tech": { dp: +30, qMult: 0.8 }, // Demand
    },
    minTechLevel: "TL5",
  },
  {
    key: "Platinum",
    basePrice: 550, // Increased base price per kg
    baseQuantity: 0.5, // Base 0.5kg available
    unit: "kg",
    minTechLevel: "TL6",
    econEffect: {
      "High Tech": { dp: -30, qMult: 1.2 }, // Used in tech
      "Rich Industrial": { dp: +20, qMult: 0.9 },
    },
  },
  // --- Weapons & Illicit Goods (adjust names/themes as needed) ---
  {
    key: "Firearms",
    basePrice: 300, // Increased base price
    baseQuantity: 8,
    unit: "t", // Could be kg/g if representing advanced personal weapons
    minTechLevel: "TL4",
    econEffect: {
      "Rich Industrial": { dp: -30, qMult: 1.4 }, // Production
      "Poor Industrial": { dp: -10, qMult: 1.1 },
      // Demand might increase in poorer/less stable systems - game logic could handle this
    },
  },
  {
    key: "Controlled Substances", // Or "Controlled Substances", "Spices" etc.
    basePrice: 2500, // High value
    baseQuantity: 0.8, // Low quantity
    unit: "kg", // Valuable per kg
    minTechLevel: "TL4", // Requires some processing
    econEffect: {
      // Often produced illicitly, hard to model with economy type
      // Let's assume higher demand in rich places, maybe some prod in poor?
      "Poor Agricultural": { dp: -100, qMult: 1.1 }, // Hidden labs?
      "Poor Industrial": { dp: -150, qMult: 1.2 }, // Hidden labs?
      "Rich Industrial": { dp: +200, qMult: 0.5 }, // High demand
      "High Tech": { dp: +150, qMult: 0.6 }, // High demand
    },
  },
  // --- Very Rare & Exotic ---
  {
    key: "Alien Items",
    basePrice: 1200, // Increased base price
    baseQuantity: 1, // Even lower base quantity
    unit: "t", // Assuming bulky artifacts or tech pieces
    minTechLevel: "TL7",
    econEffect: {
      "High Tech": { dp: -150, qMult: 1.8 }, // Interest/Research
    },
  },
  {
    key: "Bio-Samples", // Rare genetic material, exotic lifeforms etc.
    basePrice: 3000,
    baseQuantity: 0.2, // Very rare
    unit: "kg",
    minTechLevel: "TL6",
    econEffect: {
      "High Tech": { dp: -300, qMult: 2.0 }, // Research demand/production
      "Rich Agricultural": { dp: -100, qMult: 1.2 }, // Potential source
    },
  },
  {
    key: "Antimatter", // Extremely rare and valuable
    basePrice: 8000, // Very high base price
    baseQuantity: 0.05, // Extremely low quantity (50g base)
    unit: "g",
    minTechLevel: "TL8", // Requires top-tier tech
    econEffect: {
      "High Tech": { dp: -1000, qMult: 4.0 }, // Only produced/handled here, massive multiplier needed
    },
  },
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

// Apply normal distribution jitter for price (Box-Muller transform)
function normalRandom(rng: SeedablePRNG): number {
  let u = 0,
    v = 0;
  while (u === 0) u = rng.random();
  while (v === 0) v = rng.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

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

// Market Generator
export class MarketGenerator {
  /**
   * Generates the definitive (fixed prices, initial quantities) market data for a station.
   * Prices are generated once. Initial quantities are also fixed based on this generation.
   * The actual current quantity will be stored and managed elsewhere (e.g., in IGameState.knownStationQuantities).
   * @param station The station for which to generate market data.
   * @param worldSeed The global world seed.
   * @param fixedSeedSuffix A constant suffix for the seed specific to this station (e.g., 0) to ensure deterministic output.
   * @returns A MarketSnapshot containing the fixed prices and *initial* quantities.
   */
  static generate(
    station: IStation,
    worldSeed: number,
    fixedSeedSuffix: number = 0
  ): MarketSnapshot {
    const seed = MarketGenerator.combineSeed(
      worldSeed,
      station.coordinates.x,
      station.coordinates.y,
      fixedSeedSuffix
    );
    const rng = new SeedablePRNG(seed);

    const table: CommodityTable = {}; // Initialize as empty object (Record)

    for (const c of COMMODITIES) {
      // Check Tech Level requirement
      if (
        c.minTechLevel &&
        getTechLevelNumber(station.techLevel) <
          getTechLevelNumber(c.minTechLevel)
      ) {
        continue; // Skip commodity if tech level is too low
      }

      // Get economy adjustments
      const econAdj = c.econEffect?.[station.economyType];
      const dPrice = econAdj?.dp ?? 0; // Price delta based on economy
      const qMult = econAdj?.qMult ?? 1; // Quantity multiplier based on economy

      // Tech level adjustment
      const techLevelNum = getTechLevelNumber(station.techLevel);
      const techAdj = (techLevelNum - 3) * (c.basePrice * 0.02);

      // Calculate base price for this station
      let price = Math.max(1, c.basePrice + dPrice - techAdj);

      // --- New: Quantity mean is proportional to station.size^2 ---
      // Default to 1 if station.size is missing
      const stationSize = station.size || 1;
      // Mean quantity is baseQuantity * qMult * (station.size^2)
      const meanQuantity = c.baseQuantity * qMult * (stationSize / MIN_STATION_SIZE) ** 2;
      // Standard deviation: 20% of mean (adjust as needed)
      const stddevQuantity = meanQuantity * 0.2;
      // Draw from normal distribution (clamp to >= 0)
      let quantity = Math.max(0, Math.round(meanQuantity + normalRandom(rng) * stddevQuantity));

      // Price jitter as before
      const priceJitter = normalRandom(rng) * 0.20 * price; // stddev = 20% of price
      price = Math.max(1, Math.round(price + priceJitter));

      // Filtering Logic
      if (c.baseQuantity === 0 && qMult <= 1 && quantity > 0) {
        quantity = 0;
      }
      const intendedQuantity = c.baseQuantity * qMult;
      if (intendedQuantity <= 0 && quantity <= 0) {
        continue;
      }

      if (price > 0) {
        // This generated 'quantity' is the *initial maximum quantity*.
        table[c.key] = { price, quantity };
      }
    }
    // The timestamp here reflects when this *definitive initial data* was generated (or could be 0).
    // The actual MarketSnapshot used in UI will have a current timestamp.
    return new MarketSnapshot(0, table);
  }

  private static combineSeed(
    worldSeed: number,
    x: number,
    y: number,
    suffix: number
  ): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    let h = worldSeed;
    h = h * 31 + ix;
    h = h * 31 + iy;
    h = h * 31 + suffix;
    h ^= h >>> 16;
    h *= 0x85ebca6b;
    h ^= h >>> 13;
    h *= 0xc2b2ae35;
    h ^= h >>> 16;
    return ((h >>> 0) % 2147483647) + 1;
  }
}
