// src/game/world/InfiniteWorldManager.ts
import { SeedablePRNG } from "./SeedablePRNG";
import { Asteroid } from "../entities/Asteroid";
import {
  IWorldManagerConfig,
  BackgroundObject,
  IEnemy,
  EconomyType,
  TechLevel,
  IStation,
} from "../types";
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

const DEFAULT_ECONOMY_TYPES: EconomyType[] = [
  "Poor Agricultural",
  "Agricultural",
  "Rich Agricultural",
  "Poor Industrial",
  "Industrial",
  "Rich Industrial",
  "High Tech",
];
const DEFAULT_TECH_LEVELS: TechLevel[] = [
  "TL0",
  "TL1",
  "TL2",
  "TL3",
  "TL4",
  "TL5",
  "TL6",
  "TL7",
];

export class InfiniteWorldManager {
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

  private config: Required<IWorldManagerConfig>;
  private avgStarsPerCell: number;
  private generatedObjectsCache: Record<string, BackgroundObject[]> = {};

  constructor(config: IWorldManagerConfig = {}) {
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
      viewBufferFactor: config.viewBufferFactor ?? 3,
      economyTypes: config.economyTypes ?? DEFAULT_ECONOMY_TYPES,
      techLevels: config.techLevels ?? DEFAULT_TECH_LEVELS,
    };

    this.avgStarsPerCell =
      this.config.starBaseDensity * this.config.cellSize * this.config.cellSize;

    console.log(`WorldManager Initialized.`);
  }

  // Removed _generateBeacons method

  private _getCellSeed(cellX: number, cellY: number): number {
    const x = Math.floor(cellX);
    const y = Math.floor(cellY);
    const ix = x | 0;
    const iy = y | 0;

    let hash = this.config.seedPrime3;
    hash = Math.imul(hash ^ ix, this.config.seedPrime1);
    hash = Math.imul(hash ^ iy, this.config.seedPrime2);
    hash = hash ^ (hash >>> 16);

    return ((hash >>> 0) % 2147483647) + 1;
  }

  private _generateObjectsForCell(
    cellX: number,
    cellY: number
  ): BackgroundObject[] {
    const cellKey = `${cellX},${cellY}`;
    if (this.generatedObjectsCache[cellKey]) {
      return this.generatedObjectsCache[cellKey];
    }

    const objects: BackgroundObject[] = [];
    const cellSeed = this._getCellSeed(cellX, cellY);
    const cellPrng = new SeedablePRNG(cellSeed);
    const cellWorldX = cellX * this.config.cellSize;
    const cellWorldY = cellY * this.config.cellSize;

    const numStars = cellPrng.randomInt(
      Math.floor(this.avgStarsPerCell * 0.5),
      Math.ceil(this.avgStarsPerCell * 1.5) + 1
    );
    for (let i = 0; i < numStars; i++) {
      const offsetX = cellPrng.random() * this.config.cellSize;
      const offsetY = cellPrng.random() * this.config.cellSize;
      const size = cellPrng.randomFloat(
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

    if (cellPrng.random() < this.config.stationProbability) {
      const offsetX = cellPrng.randomFloat(0.3, 0.7) * this.config.cellSize;
      const offsetY = cellPrng.randomFloat(0.3, 0.7) * this.config.cellSize;
      const stationX = cellWorldX + offsetX;
      const stationY = cellWorldY + offsetY;
      const size = cellPrng.randomFloat(
        this.config.minStationSize,
        this.config.maxStationSize
      );
      const stationType =
        this.config.stationTypes[
          cellPrng.randomInt(0, this.config.stationTypes.length)
        ];
      const id = `station_${cellX}_${cellY}`;
      const economyType =
        this.config.economyTypes[
          cellPrng.randomInt(0, this.config.economyTypes.length)
        ];
      const techLevel =
        this.config.techLevels[
          cellPrng.randomInt(0, this.config.techLevels.length)
        ];
      let stationName = "";
      const nameStyle = cellPrng.randomInt(0, 5);
      const prefix =
        InfiniteWorldManager.stationPrefixes[
          cellPrng.randomInt(0, InfiniteWorldManager.stationPrefixes.length)
        ];
      const coreName =
        InfiniteWorldManager.stationCoreNames[
          cellPrng.randomInt(0, InfiniteWorldManager.stationCoreNames.length)
        ];
      const designator =
        InfiniteWorldManager.stationDesignators[
          cellPrng.randomInt(0, InfiniteWorldManager.stationDesignators.length)
        ];
      const numeral =
        InfiniteWorldManager.stationNumerals[
          cellPrng.randomInt(0, InfiniteWorldManager.stationNumerals.length)
        ];
      switch (nameStyle) {
        case 0:
          stationName = `${prefix} ${coreName}`;
          break;
        case 1:
          stationName = `${coreName} ${designator}`;
          break;
        case 2:
          stationName = `${prefix} ${numeral}`;
          break;
        case 3:
          stationName = `${coreName} ${numeral}`;
          break;
        case 4:
          stationName = `${prefix} ${coreName} ${designator}`;
          break;
        default:
          stationName = `${coreName} Station ${cellPrng.randomInt(1, 999)}`;
          break;
      }
      const initialAngle = cellPrng.random() * Math.PI * 2;
      const rotationSpeed =
        cellPrng.randomFloat(0.1, 1.6) * (cellPrng.random() < 0.5 ? 1 : -1);

      objects.push({
        id: id,
        type: "station",
        name: stationName,
        x: stationX,
        y: stationY,
        isFixed: false,
        size: size,
        radius: size / 2,
        color: this.config.stationColor,
        stationType: stationType,
        initialAngle: initialAngle,
        rotationSpeed: rotationSpeed,
        angle: initialAngle,
        economyType: economyType,
        techLevel: techLevel,
        coordinates: { x: stationX, y: stationY },
      });
    }

    const cellHasStation = objects.some((obj) => obj.type === "station");

    if (!cellHasStation) {
      const densityNoise = cellPrng.random();
      const highDensity = densityNoise > 0.45;
      const baseChance = highDensity ? 0.9 : 0.3;
      if (cellPrng.random() < baseChance) {
        const n = highDensity ? cellPrng.randomInt(8, 16) : 1;
        const groupOrbitalSpeed = cellPrng.randomFloat(0.001, 0.003);
        for (let i = 0; i < n; i++) {
          const orbitRadius = cellPrng.randomFloat(2, 120);
          const initialAngle = cellPrng.randomFloat(0, Math.PI * 2);
          const asteroid = new Asteroid(
            cellWorldX + this.config.cellSize / 2,
            cellWorldY + this.config.cellSize / 2,
            initialAngle,
            orbitRadius,
            cellPrng.randomFloat(10, 48),
            groupOrbitalSpeed
          );
          objects.push(asteroid);
        }
      }
    }
    this.generatedObjectsCache[cellKey] = objects;
    return objects;
  }

  getObjectsInView(
    cameraX: number,
    cameraY: number,
    viewWidth: number,
    viewHeight: number
  ): BackgroundObject[] {
    const visibleObjects: BackgroundObject[] = [];
    const addedIds = new Set<string>();

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

    const currentTimeSeconds = Date.now() / 1000.0;

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const cellObjects = this._generateObjectsForCell(cx, cy);
        cellObjects.forEach((obj) => {
          if (
            !addedIds.has(obj.id) &&
            obj.x >= viewLeft &&
            obj.x <= viewRight &&
            obj.y >= viewTop &&
            obj.y <= viewBottom
          ) {
            if (obj.type === "asteroid") {
              (obj as Asteroid).update(currentTimeSeconds);
            } else if (obj.type === "station") {
              const station = obj as IStation;
              station.angle =
                (station.initialAngle +
                  currentTimeSeconds * station.rotationSpeed) %
                (Math.PI * 2);
              if (station.angle < 0) station.angle += Math.PI * 2;
            }
            visibleObjects.push(obj);
            addedIds.add(obj.id);
          }
        });
      }
    }

    // Removed loop for adding generatedBeacons to visibleObjects

    return visibleObjects;
  }

  getStationById(stationId: string | null): IStation | null {
    if (!stationId) return null;

    for (const cellCache of Object.values(this.generatedObjectsCache)) {
      const found = cellCache.find(
        (obj) => obj.id === stationId && obj.type === "station"
      );
      if (found) {
        const station = found as IStation;
        const currentTimeSeconds = Date.now() / 1000.0;
        station.angle =
          (station.initialAngle + currentTimeSeconds * station.rotationSpeed) %
          (Math.PI * 2);
        if (station.angle < 0) station.angle += Math.PI * 2;
        return station;
      }
    }

    if (!stationId.startsWith("station_")) return null;
    try {
      const parts = stationId.split("_");
      if (parts.length !== 3) return null;
      const cellX = parseInt(parts[1], 10);
      const cellY = parseInt(parts[2], 10);
      if (isNaN(cellX) || isNaN(cellY)) return null;

      const cellObjects = this._generateObjectsForCell(cellX, cellY);
      const station = cellObjects.find(
        (obj): obj is IStation => obj.id === stationId && obj.type === "station"
      );

      if (station) {
        const currentTimeSeconds = Date.now() / 1000.0;
        station.angle =
          (station.initialAngle + currentTimeSeconds * station.rotationSpeed) %
          (Math.PI * 2);
        if (station.angle < 0) station.angle += Math.PI * 2;
      }
      return station || null;
    } catch (e) {
      console.error(`Error getting station by ID ${stationId}:`, e);
      return null;
    }
  }

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
