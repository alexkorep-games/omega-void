import { IMarketSnapshot, CommodityTable } from "../types";

/**
 * Represents a snapshot of market prices and supply/demand at a specific time.
 */
export class MarketSnapshot implements IMarketSnapshot {
  timestamp: number;
  // table: Map<string, CommodityState>; // OLD
  table: CommodityTable; // NEW - CommodityTable is now Record<string, CommodityState>

  // constructor(timestamp: number, table: Map<string, CommodityState>) { // OLD
  constructor(timestamp: number, table: CommodityTable) { // NEW
    this.timestamp = timestamp;
    this.table = table; // Should now be a Record
  }

  // Add methods if needed, e.g., getPrice(commodityId), getSupply(commodityId)
  getPrice(commodityId: string): number | undefined {
    // return this.table.get(commodityId)?.price; // OLD
    return this.table[commodityId]?.price; // NEW
  }

  getSupply(commodityId: string): number | undefined {
    // return this.table.get(commodityId)?.supply; // OLD
    return this.table[commodityId]?.supply; // NEW
  }
}
