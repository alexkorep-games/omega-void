// src/game/world/InfiniteWorldManager.ts
import { SeedablePRNG } from "./SeedablePRNG";
import { IWorldManagerConfig, BackgroundObject, IEnemy } from "../types";
import {
  WORLD_CELL_SIZE,
  STAR_BASE_DENSITY,
  MIN_STAR_SIZE,
  MAX_STAR_SIZE,
  STAR_COLOR,
  STATION_PROBABILITY,
  MIN_STATION_SIZE,
  MAX_STATION_SIZE,
  STATION_COLOR,
} from "../config";

/**
 * Manages the procedural generation of objects in an infinite world.
 */
export class InfiniteWorldManager {
  // --- Static properties for Name Generation ---
  // (Keep these static properties as they were in the original JS)
  static stationPrefixes = [
    "Deep Space",
    "Orbital",
    "Star Command",
    "Sector",
    "Outpost",
    "System Control",
    "Starport",
    "Gateway",
    "Relay",
    "Research",
    "Mining",
    "Trade",
    "Waypoint",
    "Observation Post",
    "Security Hub",
  ];
  static stationCoreNames = [
    "Alpha",
    "Beta",
    "Gamma",
    "Delta",
    "Omega",
    "Epsilon",
    "Zeta",
    "Sigma",
    "Tau",
    "Orion",
    "Cygnus",
    "Lyra",
    "Andromeda",
    "Centauri",
    "Proxima",
    "Kepler",
    "Nova",
    "Helios",
    "Sol",
    "Terra",
    "Prometheus",
    "Olympus",
    "Asgard",
    "Valhalla",
    "Hades",
    "Terminus",
    "Citadel",
    "Hub",
    "Spire",
    "Beacon",
    "Reach",
    "Vantage",
    "Horizon",
    "Zenith",
    "Apex",
    "Nebula",
    "Quasar",
    "Pulsar",
    "Aegis",
    "Nexus",
    "Crucible",
    "Bastion",
    "Odyssey",
    "Voyager",
    "Pioneer",
    "Discovery",
  ];
  static stationDesignators = [
    "Prime",
    "Secundus",
    "Tertius",
    "Command",
    "Major",
    "Minor",
    "Deep",
    "High Orbit",
    "Low Orbit",
    "Lagrange",
  ];
  static stationNumerals = [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
    "XIV",
    "XV",
    "XVI",
    "XVII",
    "XVIII",
    "XIX",
    "XX",
  ];

  private config: Required<IWorldManagerConfig>; // Use Required to ensure all props are set
  private prng: SeedablePRNG;
  private avgStarsPerCell: number;
  private generatedObjectsCache: Map<string, BackgroundObject[]> = new Map(); // Cache generated cell objects

  constructor(config: IWorldManagerConfig = {}) {
    // Provide default values using || and ?? operators
    this.config = {
      cellSize: config.cellSize ?? WORLD_CELL_SIZE,
      seedPrime1: config.seedPrime1 ?? 73856093,
      seedPrime2: config.seedPrime2 ?? 19349663,
      seedPrime3: config.seedPrime3 ?? 83492791,
      starBaseDensity: config.starBaseDensity ?? STAR_BASE_DENSITY,
      minStarSize: config.minStarSize ?? MIN_STAR_SIZE,
      maxStarSize: config.maxStarSize ?? MAX_STAR_SIZE,
      starColor: config.starColor ?? STAR_COLOR,
      stationProbability: config.stationProbability ?? STATION_PROBABILITY,
      minStationSize: config.minStationSize ?? MIN_STATION_SIZE,
      maxStationSize: config.maxStationSize ?? MAX_STATION_SIZE,
      stationColor: config.stationColor ?? STATION_COLOR,
      stationTypes: config.stationTypes ?? ["coriolis"],
      viewBufferFactor: config.viewBufferFactor ?? 1.5,
    };

    this.prng = new SeedablePRNG();
    this.avgStarsPerCell =
      this.config.starBaseDensity * this.config.cellSize * this.config.cellSize;
  }

  private _getCellSeed(cellX: number, cellY: number): number {
    const x = Math.floor(cellX);
    const y = Math.floor(cellY);
    let hash =
      Math.imul(x, this.config.seedPrime1) ^
      Math.imul(y, this.config.seedPrime2);
    hash = Math.imul(hash, this.config.seedPrime3);
    hash = Math.abs(hash % 2147483647) + 1;
    return hash;
  }

  private _generateObjectsForCell(
    cellX: number,
    cellY: number
  ): BackgroundObject[] {
    const cellKey = `${cellX},${cellY}`;
    if (this.generatedObjectsCache.has(cellKey)) {
      return this.generatedObjectsCache.get(cellKey)!;
    }

    const objects: BackgroundObject[] = [];
    const cellSeed = this._getCellSeed(cellX, cellY);
    this.prng.setSeed(cellSeed);

    const cellWorldX = cellX * this.config.cellSize;
    const cellWorldY = cellY * this.config.cellSize;

    // --- Generate Stars ---
    const numStars = this.prng.randomInt(
      Math.floor(this.avgStarsPerCell * 0.5),
      Math.ceil(this.avgStarsPerCell * 1.5) + 1
    );
    for (let i = 0; i < numStars; i++) {
      const offsetX = this.prng.random() * this.config.cellSize;
      const offsetY = this.prng.random() * this.config.cellSize;
      const size = this.prng.randomFloat(
        this.config.minStarSize,
        this.config.maxStarSize
      );
      objects.push({
        id: `star_${cellX}_${cellY}_${i}`,
        type: "star",
        x: cellWorldX + offsetX,
        y: cellWorldY + offsetY,
        size: size,
        color: this.config.starColor,
      });
    }

    // --- Attempt to Generate Station ---
    if (this.prng.random() < this.config.stationProbability) {
      const offsetX = this.prng.randomFloat(0.3, 0.7) * this.config.cellSize;
      const offsetY = this.prng.randomFloat(0.3, 0.7) * this.config.cellSize;
      const size = this.prng.randomFloat(
        this.config.minStationSize,
        this.config.maxStationSize
      );
      const stationTypeIndex = this.prng.randomInt(
        0,
        this.config.stationTypes.length
      );
      const stationType = this.config.stationTypes[stationTypeIndex];
      const id = `station_${cellX}_${cellY}`;

      // Generate Name (using static arrays and PRNG)
      let stationName = "";
      const nameStyle = this.prng.randomInt(0, 5);
      const coreName =
        InfiniteWorldManager.stationCoreNames[
          this.prng.randomInt(0, InfiniteWorldManager.stationCoreNames.length)
        ];
      const prefix =
        InfiniteWorldManager.stationPrefixes[
          this.prng.randomInt(0, InfiniteWorldManager.stationPrefixes.length)
        ];
      const designator =
        InfiniteWorldManager.stationDesignators[
          this.prng.randomInt(0, InfiniteWorldManager.stationDesignators.length)
        ];
      const numeral =
        InfiniteWorldManager.stationNumerals[
          this.prng.randomInt(0, InfiniteWorldManager.stationNumerals.length)
        ];
      const number = this.prng.randomInt(1, 999);
      const shortNum = this.prng.randomInt(1, 12);

      switch (nameStyle) {
        case 0:
          stationName = `${prefix} ${coreName} ${number}`;
          break;
        case 1:
          stationName = `${coreName} ${numeral}`;
          break;
        case 2:
          stationName = `${coreName} ${designator}`;
          break;
        case 3:
          stationName = `${prefix} ${shortNum}`;
          break;
        case 4:
          const letter = String.fromCharCode(65 + this.prng.randomInt(0, 5));
          stationName = `${coreName} ${shortNum}-${letter}`;
          break;
        default:
          stationName = `${coreName} Station ${number}`;
          break;
      }

      objects.push({
        id: id,
        type: "station",
        name: stationName,
        x: cellWorldX + offsetX,
        y: cellWorldY + offsetY,
        size: size,
        radius: size / 2,
        color: this.config.stationColor,
        stationType: stationType,
        initialAngle: this.prng.random() * Math.PI * 2,
        rotationSpeed:
          this.prng.randomFloat(0.1, 1.6) * (this.prng.random() < 0.5 ? 1 : -1),
        angle: 0, // Initial angle will be set based on initialAngle later
      });
    }

    this.generatedObjectsCache.set(cellKey, objects);
    return objects;
  }

  /**
   * Retrieves cached or generates objects for the cells overlapping the view area.
   * @param cameraX - World x-coordinate of the camera's top-left corner.
   * @param cameraY - World y-coordinate of the camera's top-left corner.
   * @param viewWidth - Width of the camera's view.
   * @param viewHeight - Height of the camera's view.
   * @returns An array of background objects within the view buffer.
   */
  getObjectsInView(
    cameraX: number,
    cameraY: number,
    viewWidth: number,
    viewHeight: number
  ): BackgroundObject[] {
    const visibleObjects: BackgroundObject[] = [];

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
        const cellObjects = this._generateObjectsForCell(cx, cy);
        visibleObjects.push(...cellObjects);
      }
    }

    // Update dynamic properties like station angle *after* retrieval/generation
    const currentTimeSeconds = Date.now() / 1000.0;
    visibleObjects.forEach((obj) => {
      if (obj.type === "station") {
        // Ensure initial angle is set if just generated
        if (obj.angle === 0 && obj.initialAngle !== 0) {
          obj.angle = obj.initialAngle;
        }
        // Update angle based on time
        obj.angle =
          (obj.initialAngle + currentTimeSeconds * obj.rotationSpeed) %
          (Math.PI * 2);
        if (obj.angle < 0) {
          obj.angle += Math.PI * 2;
        }
      }
    });

    return visibleObjects;
  }

  /**
   * Determines which existing enemy objects should be removed.
   * (This logic remains the same, just typed)
   */
  getEnemiesToDespawn(
    currentEnemies: IEnemy[],
    focusX: number,
    focusY: number,
    despawnRadius: number
  ): string[] {
    const enemyIdsToRemove: string[] = [];
    const despawnRadiusSq = despawnRadius * despawnRadius;

    for (const enemy of currentEnemies) {
      const dx = enemy.x - focusX;
      const dy = enemy.y - focusY;
      const distSq = dx * dx + dy * dy;

      if (distSq > despawnRadiusSq) {
        enemyIdsToRemove.push(enemy.id);
      }
    }
    return enemyIdsToRemove;
  }
}
