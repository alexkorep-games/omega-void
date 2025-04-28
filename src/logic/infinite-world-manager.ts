// src/logic/infinite-world-manager.ts
import type { WorldManagerConfig, WorldObjectData, StarData, StationData, EnemyState } from '../types';
import { WORLD_CONFIG } from '../config'; // Import default config

// SeedablePRNG class (paste the exact class code here, then add types)
/**
 * Simple Seedable Pseudo-Random Number Generator (LCG - Linear Congruential Generator)
 * Necessary for deterministic generation based on location.
 */
class SeedablePRNG {
  private seed: number;

  constructor(seed: number = 1) {
    // Ensure positive seed > 0 and within a reasonable range for LCG
    this.seed = Math.abs(Math.trunc(seed) % 2147483647) || 1;
  }

  setSeed(seed: number): void {
    this.seed = Math.abs(Math.trunc(seed) % 2147483647) || 1;
  }

  // Generates a pseudo-random float between 0 (inclusive) and 1 (exclusive)
  random(): number {
    // Parameters from POSIX standard (simple and common)
    // Use Math.imul for potential 32-bit overflow handling in JS
    this.seed = (Math.imul(1103515245, this.seed) + 12345) % 2147483647;
    // Ensure result is positive before division
    const positiveSeed = this.seed < 0 ? this.seed + 2147483647 : this.seed;
    return positiveSeed / 2147483647; // Normalize to [0, 1)
  }

  // Generates a pseudo-random integer between min (inclusive) and max (exclusive)
  randomInt(min: number, max: number): number {
    // Ensure min and max are integers
    min = Math.ceil(min);
    max = Math.floor(max);
    return min + Math.floor(this.random() * (max - min));
  }

  // Generates a pseudo-random float between min (inclusive) and max (exclusive)
  randomFloat(min: number, max: number): number {
    return this.random() * (max - min) + min;
  }
}


/**
 * Manages the procedural generation of objects in an infinite world.
 * Divides the world into grid cells and uses deterministic seeding
 * to generate objects within those cells based on location.
 */
export class InfiniteWorldManager {
  // --- Static properties for Name Generation ---
  static stationPrefixes: string[] = [
    "Deep Space", "Orbital", "Star Command", "Sector", "Outpost", "System Control",
    "Starport", "Gateway", "Relay", "Research", "Mining", "Trade", "Waypoint",
    "Observation Post", "Security Hub",
  ];
  static stationCoreNames: string[] = [
    "Alpha", "Beta", "Gamma", "Delta", "Omega", "Epsilon", "Zeta", "Sigma", "Tau",
    "Orion", "Cygnus", "Lyra", "Andromeda", "Centauri", "Proxima", "Kepler", "Nova",
    "Helios", "Sol", "Terra", "Prometheus", "Olympus", "Asgard", "Valhalla", "Hades",
    "Terminus", "Citadel", "Hub", "Spire", "Beacon", "Reach", "Vantage", "Horizon",
    "Zenith", "Apex", "Nebula", "Quasar", "Pulsar", "Aegis", "Nexus", "Crucible",
    "Bastion", "Odyssey", "Voyager", "Pioneer", "Discovery",
  ];
  static stationDesignators: string[] = [
    "Prime", "Secundus", "Tertius", "Command", "Major", "Minor", "Deep",
    "High Orbit", "Low Orbit", "Lagrange",
  ];
  static stationNumerals: string[] = [
    "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII",
    "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
  ];

  private config: Required<WorldManagerConfig>; // Use Required to ensure all props exist
  private prng: SeedablePRNG;
  private avgStarsPerCell: number;

  constructor(config: WorldManagerConfig = {}) {
    // Merge provided config with defaults from WORLD_CONFIG
    this.config = {
      cellSize: config.cellSize ?? WORLD_CONFIG.cellSize,
      seedPrime1: config.seedPrime1 ?? 73856093,
      seedPrime2: config.seedPrime2 ?? 19349663,
      seedPrime3: config.seedPrime3 ?? 83492791,
      starBaseDensity: config.starBaseDensity ?? WORLD_CONFIG.starBaseDensity,
      minStarSize: config.minStarSize ?? WORLD_CONFIG.minStarSize,
      maxStarSize: config.maxStarSize ?? WORLD_CONFIG.maxStarSize,
      starColor: config.starColor ?? WORLD_CONFIG.starColor, // Use number
      stationProbability: config.stationProbability ?? WORLD_CONFIG.stationProbability,
      minStationSize: config.minStationSize ?? WORLD_CONFIG.minStationSize,
      maxStationSize: config.maxStationSize ?? WORLD_CONFIG.maxStationSize,
      stationColor: config.stationColor ?? WORLD_CONFIG.stationColor, // Use number
      stationTypes: config.stationTypes ?? ["coriolis"],
      viewBufferFactor: config.viewBufferFactor ?? WORLD_CONFIG.viewBufferFactor,
    };

    this.prng = new SeedablePRNG(); // Reusable PRNG instance
    this.avgStarsPerCell =
      this.config.starBaseDensity * this.config.cellSize * this.config.cellSize;
  }

  private _getCellSeed(cellX: number, cellY: number): number {
    const x = Math.floor(cellX);
    const y = Math.floor(cellY);
    let hash = Math.imul(x, this.config.seedPrime1) ^ Math.imul(y, this.config.seedPrime2);
    hash = Math.imul(hash, this.config.seedPrime3);
    hash = Math.abs(hash % 2147483647) + 1;
    return hash;
  }

  private _generateStarsForCell(cellX: number, cellY: number): StarData[] {
    const stars: StarData[] = [];
    const cellSeed = this._getCellSeed(cellX, cellY);
    this.prng.setSeed(cellSeed);

    const numStars = this.prng.randomInt(
      Math.floor(this.avgStarsPerCell * 0.5),
      Math.ceil(this.avgStarsPerCell * 1.5) + 1
    );

    const cellWorldX = cellX * this.config.cellSize;
    const cellWorldY = cellY * this.config.cellSize;

    for (let i = 0; i < numStars; i++) {
      const offsetX = this.prng.random() * this.config.cellSize;
      const offsetY = this.prng.random() * this.config.cellSize;
      const size = this.prng.randomFloat(this.config.minStarSize, this.config.maxStarSize);
      const id = `star_${cellX}_${cellY}_${i}`;

      stars.push({
        id: id,
        type: "star",
        x: cellWorldX + offsetX,
        y: cellWorldY + offsetY,
        size: size,
        color: this.config.starColor,
      });
    }
    return stars;
  }

  private _generateStationForCell(cellX: number, cellY: number): StationData | null {
    const cellSeed = this._getCellSeed(cellX, cellY);
    this.prng.setSeed(cellSeed);

    if (this.prng.random() < this.config.stationProbability) {
      const cellWorldX = cellX * this.config.cellSize;
      const cellWorldY = cellY * this.config.cellSize;
      const offsetX = this.prng.randomFloat(0.3, 0.7) * this.config.cellSize;
      const offsetY = this.prng.randomFloat(0.3, 0.7) * this.config.cellSize;
      const size = this.prng.randomFloat(this.config.minStationSize, this.config.maxStationSize);
      const stationTypeIndex = this.prng.randomInt(0, this.config.stationTypes.length);
      const stationType = this.config.stationTypes[stationTypeIndex];
      const id = `station_${cellX}_${cellY}`;

      // Generate Name (same logic as before)
      let stationName = "";
      const nameStyle = this.prng.randomInt(0, 5);
      const coreName = InfiniteWorldManager.stationCoreNames[this.prng.randomInt(0, InfiniteWorldManager.stationCoreNames.length)];
      const prefix = InfiniteWorldManager.stationPrefixes[this.prng.randomInt(0, InfiniteWorldManager.stationPrefixes.length)];
      const designator = InfiniteWorldManager.stationDesignators[this.prng.randomInt(0, InfiniteWorldManager.stationDesignators.length)];
      const numeral = InfiniteWorldManager.stationNumerals[this.prng.randomInt(0, InfiniteWorldManager.stationNumerals.length)];
      const number = this.prng.randomInt(1, 999);
      const shortNum = this.prng.randomInt(1, 12);
      switch (nameStyle) {
          case 0: stationName = `${prefix} ${coreName} ${number}`; break;
          case 1: stationName = `${coreName} ${numeral}`; break;
          case 2: stationName = `${coreName} ${designator}`; break;
          case 3: stationName = `${prefix} ${shortNum}`; break;
          case 4: const letter = String.fromCharCode(65 + this.prng.randomInt(0, 5)); stationName = `${coreName} ${shortNum}-${letter}`; break;
          default: stationName = `${coreName} Station ${number}`; break;
      }

      const initialAngle = this.prng.random() * Math.PI * 2;
      const rotationSpeed = this.prng.randomFloat(0.1, 1.6) * (this.prng.random() < 0.5 ? 1 : -1);

      return {
        id: id,
        type: "station",
        name: stationName,
        x: cellWorldX + offsetX,
        y: cellWorldY + offsetY,
        size: size,
        radius: size / 2,
        color: this.config.stationColor,
        stationType: stationType,
        angle: initialAngle, // Start with initial angle
        initialAngle: initialAngle,
        rotationSpeed: rotationSpeed,
      };
    }
    return null;
  }

  getObjectsInView(cameraX: number, cameraY: number, viewWidth: number, viewHeight: number): WorldObjectData[] {
    const objects: WorldObjectData[] = [];
    const bufferX = (viewWidth * (this.config.viewBufferFactor - 1)) / 2;
    const bufferY = (viewHeight * (this.config.viewBufferFactor - 1)) / 2;
    const viewLeft = cameraX - bufferX;
    const viewTop = cameraY - bufferY;
    const viewRight = cameraX + viewWidth + bufferX;
    const viewBottom = cameraY + viewHeight + bufferY;
    const minCellX = Math.floor(viewLeft / this.config.cellSize);
    const maxCellX = Math.floor(viewRight / this.config.cellSize);
    const minCellY = Math.floor(viewTop / this.config.cellSize);
    const maxCellY = Math.floor(viewBottom / this.config.cellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const stars = this._generateStarsForCell(cx, cy);
        objects.push(...stars);
        const station = this._generateStationForCell(cx, cy);
        if (station) {
          objects.push(station);
        }
      }
    }
    return objects;
  }

  getEnemiesToDespawn(currentEnemies: ReadonlyArray<EnemyState>, focusX: number, focusY: number, despawnRadius: number): string[] {
    const enemiesToRemoveIds: string[] = [];
    const despawnRadiusSq = despawnRadius * despawnRadius;

    for (const enemy of currentEnemies) {
      const dx = enemy.x - focusX;
      const dy = enemy.y - focusY;
      const distSq = dx * dx + dy * dy;
      if (distSq > despawnRadiusSq) {
        enemiesToRemoveIds.push(enemy.id);
      }
    }
    return enemiesToRemoveIds;
  }
}