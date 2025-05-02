// src/game/world/InfiniteWorldManager.ts
import { SeedablePRNG } from "./SeedablePRNG";
import { Asteroid } from "../entities/Asteroid";
import { FIXED_STATIONS } from "./FixedStations"; // Import fixed stations
import {
  Beacon,
  BEACON_COLOR,
  BEACON_ACTIVATED_COLOR,
} from "../entities/Beacon"; // Import Beacon entity and colors
import {
  IWorldManagerConfig,
  BackgroundObject,
  IEnemy,
  EconomyType,
  TechLevel,
  IStation,
  IBeacon,
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

// Add defaults for Economy and Tech Level if not provided in config
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
  private avgStarsPerCell: number;
  private generatedObjectsCache: Record<string, BackgroundObject[]> = {}; // Replace Map with Record
  private fixedStationsMap: Record<string, IStation> = {}; // Replace Map with Record
  private generatedBeacons: Record<string, IBeacon> = {}; // Replace Map with Record

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
      // --- Add defaults for new config options ---
      economyTypes: config.economyTypes ?? DEFAULT_ECONOMY_TYPES,
      techLevels: config.techLevels ?? DEFAULT_TECH_LEVELS,
      fixedStations: config.fixedStations ?? FIXED_STATIONS, // Use provided or default
    };

    this.avgStarsPerCell =
      this.config.starBaseDensity * this.config.cellSize * this.config.cellSize;
    // Initialize fixed stations map
    this.fixedStationsMap = this.config.fixedStations.reduce((acc, fs) => {
      acc[fs.id] = fs;
      return acc;
    }, {} as Record<string, IStation>);
    // Initialize and generate beacons
    this.generatedBeacons = {};
    this._generateBeacons(); // Call beacon generation
    console.log(
      `WorldManager Initialized. Fixed Stations: ${Object.keys(this.fixedStationsMap).length}, Beacons: ${Object.keys(this.generatedBeacons).length}`
    );
  }

  // NEW: Method to generate fixed beacons
  private _generateBeacons(): void {
    // Define beacon coordinates and IDs (match quest requirements)
    const beaconCoords = [
      { x: -4500, y: 4800, idSuffix: "nw_key1" }, // Beacon 1
      { x: 4800, y: 4700, idSuffix: "ne_key2" }, // Beacon 2
      { x: -4800, y: -4600, idSuffix: "sw_key3" }, // Beacon 3
      { x: 4700, y: -4800, idSuffix: "se_key4" }, // Beacon 4
    ];
    beaconCoords.forEach((coord) => {
      const beacon = new Beacon(coord.x, coord.y, coord.idSuffix);
      this.generatedBeacons[beacon.id] = beacon;
    });
    console.log(`Generated ${Object.keys(this.generatedBeacons).length} Beacons.`);
  }

  private _getCellSeed(cellX: number, cellY: number): number {
    const x = Math.floor(cellX);
    const y = Math.floor(cellY);
    // Ensure input values are treated as integers for hashing consistency
    const ix = x | 0;
    const iy = y | 0;

    // Simple hashing combining cell coordinates and seed primes
    let hash = this.config.seedPrime3; // Start with a base prime
    hash = Math.imul(hash ^ ix, this.config.seedPrime1); // Mix in x
    hash = Math.imul(hash ^ iy, this.config.seedPrime2); // Mix in y
    hash = hash ^ (hash >>> 16); // Final mixing step

    // Ensure the result is a positive integer for the PRNG seed
    return ((hash >>> 0) % 2147483647) + 1; // Make positive and non-zero
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

    // Check if this cell contains a fixed station
    let hasFixedStation = false;
    for (const fs of Object.values(this.fixedStationsMap)) {
      const fixedCellX = Math.floor(fs.x / this.config.cellSize);
      const fixedCellY = Math.floor(fs.y / this.config.cellSize);
      if (fixedCellX === cellX && fixedCellY === cellY) {
        objects.push(fs); // Add fixed station reference
        hasFixedStation = true; // Mark that this cell has a fixed station
        break; // Assume only one fixed station per cell max
      }
    }

    // Generate Stars
    const numStars = cellPrng.randomInt(
      Math.floor(this.avgStarsPerCell * 0.5),
      Math.ceil(this.avgStarsPerCell * 1.5) + 1
    );
    for (let i = 0; i < numStars; i++) {
      // ... star generation logic ...
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

    // Generate Procedural Station (only if no fixed station in this cell)
    if (
      !hasFixedStation &&
      cellPrng.random() < this.config.stationProbability
    ) {
      // ... procedural station generation logic ...
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
        angle: initialAngle, // Initialize angle
        economyType: economyType,
        techLevel: techLevel,
        coordinates: { x: stationX, y: stationY },
      });
    }

    // Generate Asteroids
    const densityNoise = cellPrng.random();
    const highDensity = densityNoise > 0.45;
    const baseChance = highDensity ? 0.9 : 0.3;
    if (cellPrng.random() < baseChance) {
      // ... asteroid generation logic ...
      const n = highDensity ? cellPrng.randomInt(8, 16) : 1;
      const groupOrbitalSpeed = cellPrng.randomFloat(0.1, 1.6);
      for (let i = 0; i < n; i++) {
        const orbitRadius = cellPrng.randomFloat(2, 80);
        const initialAngle = cellPrng.randomFloat(0, Math.PI * 2);
        const asteroid = new Asteroid(
          cellWorldX + this.config.cellSize / 2, // Orbit center X
          cellWorldY + this.config.cellSize / 2, // Orbit center Y
          initialAngle,
          orbitRadius,
          cellPrng.randomFloat(10, 48), // Size (diameter) of the asteroid
          groupOrbitalSpeed
        );
        // Initial position update
        objects.push(asteroid);
      }
    }

    // Replace Map methods with Record operations
    this.generatedObjectsCache[cellKey] = objects;
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
    const addedIds = new Set<string>(); // Track added object IDs to avoid duplicates

    // Calculate view boundaries with buffer
    const bufferX = (viewWidth * (this.config.viewBufferFactor - 1)) / 2;
    const bufferY = (viewHeight * (this.config.viewBufferFactor - 1)) / 2;
    const viewLeft = cameraX - bufferX;
    const viewTop = cameraY - bufferY;
    const viewRight = cameraX + viewWidth + bufferX;
    const viewBottom = cameraY + viewHeight + bufferY;

    // Determine cell range to check
    const minCellX = Math.floor(viewLeft / this.config.cellSize);
    const maxCellX = Math.floor(viewRight / this.config.cellSize);
    const minCellY = Math.floor(viewTop / this.config.cellSize);
    const maxCellY = Math.floor(viewBottom / this.config.cellSize);

    const currentTimeSeconds = Date.now() / 1000.0; // For dynamic updates (rotation, orbit)

    // Iterate through relevant cells
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const cellObjects = this._generateObjectsForCell(cx, cy);
        cellObjects.forEach((obj) => {
          // Replace Map methods with Record operations
          if (
            !addedIds.has(obj.id) &&
            obj.x >= viewLeft &&
            obj.x <= viewRight &&
            obj.y >= viewTop &&
            obj.y <= viewBottom
          ) {
            // Update dynamic properties (like asteroid orbit, station rotation)
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

    // Add visible Beacons (they are not in cell cache)
    for (const beaconId in this.generatedBeacons) {
      const beacon = this.generatedBeacons[beaconId];
      if (
        !addedIds.has(beacon.id) &&
        beacon.x >= viewLeft &&
        beacon.x <= viewRight &&
        beacon.y >= viewTop &&
        beacon.y <= viewBottom
      ) {
        // Beacon state (color) is managed internally or by game logic, just add if visible
        visibleObjects.push(beacon);
        addedIds.add(beacon.id);
      }
    }

    return visibleObjects;
  }

  /**
   * Retrieves a specific station by its ID, generating the cell if necessary.
   * Returns null if the ID format is incorrect or the station doesn't exist in that cell.
   */
  getStationById(stationId: string | null): IStation | null {
    if (!stationId) return null;

    // Check fixed stations first
    const fixedStation = this.fixedStationsMap[stationId];
    if (fixedStation) {
      // Update angle dynamically based on current time
      const currentTimeSeconds = Date.now() / 1000.0;
      fixedStation.angle =
        (fixedStation.initialAngle +
          currentTimeSeconds * fixedStation.rotationSpeed) %
        (Math.PI * 2);
      if (fixedStation.angle < 0) fixedStation.angle += Math.PI * 2;
      return fixedStation;
    }

    // Check cache for procedural stations
    for (const cellCache of Object.values(this.generatedObjectsCache)) {
      const found = cellCache.find(
        (obj) => obj.id === stationId && obj.type === "station"
      );
      if (found) {
        // Update angle dynamically based on current time
        const station = found as IStation;
        const currentTimeSeconds = Date.now() / 1000.0;
        station.angle =
          (station.initialAngle + currentTimeSeconds * station.rotationSpeed) %
          (Math.PI * 2);
        if (station.angle < 0) station.angle += Math.PI * 2;
        return station;
      }
    }

    // If not in cache, determine cell and generate/find (for procedural stations)
    if (!stationId.startsWith("station_")) return null; // Fixed stations handled above
    try {
      const parts = stationId.split("_");
      // Expecting "station_X_Y" format for procedural
      if (parts.length !== 3) return null;
      const cellX = parseInt(parts[1], 10);
      const cellY = parseInt(parts[2], 10);
      if (isNaN(cellX) || isNaN(cellY)) return null;

      // Generate objects for the cell (or retrieve from cache)
      const cellObjects = this._generateObjectsForCell(cellX, cellY);
      const station = cellObjects.find(
        (obj): obj is IStation => obj.id === stationId && obj.type === "station"
      );

      if (station) {
        // Update angle dynamically based on current time
        const currentTimeSeconds = Date.now() / 1000.0;
        station.angle =
          (station.initialAngle + currentTimeSeconds * station.rotationSpeed) %
          (Math.PI * 2);
        if (station.angle < 0) station.angle += Math.PI * 2;
      }
      return station || null; // Return found station or null
    } catch (e) {
      console.error(`Error getting station by ID ${stationId}:`, e);
      return null;
    }
  }

  /**
   * Determines which existing enemy objects should be removed.
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

  // NEW: Get a specific beacon by its ID
  getBeaconById(beaconId: string): IBeacon | null {
    return this.generatedBeacons[beaconId] || null;
  }

  // NEW: Update the state (and color) of a beacon
  updateBeaconState(beaconId: string, active: boolean): void {
    const beacon = this.generatedBeacons[beaconId];
    if (beacon) {
      // Only update if state actually changed
      if (beacon.isActive !== active) {
        beacon.isActive = active;
        beacon.color = active ? BEACON_ACTIVATED_COLOR : BEACON_COLOR; // Update color
        console.log(
          `Beacon ${beaconId} state updated to: ${
            active ? "ACTIVE" : "INACTIVE"
          }`
        );
      }
    } else {
      console.warn(`Attempted to update non-existent beacon: ${beaconId}`);
    }
  }
}
