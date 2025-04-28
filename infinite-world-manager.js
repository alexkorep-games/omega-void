// Paste the content of the SeedablePRNG class here (as provided in the prompt)
/**
 * Simple Seedable Pseudo-Random Number Generator (LCG - Linear Congruential Generator)
 * Necessary for deterministic generation based on location.
 */
class SeedablePRNG {
  constructor(seed = 1) {
    // Ensure positive seed > 0 and within a reasonable range for LCG
    this.seed = Math.abs(Math.trunc(seed) % 2147483647) || 1;
  }

  setSeed(seed) {
    this.seed = Math.abs(Math.trunc(seed) % 2147483647) || 1;
  }

  // Generates a pseudo-random float between 0 (inclusive) and 1 (exclusive)
  random() {
    // Parameters from POSIX standard (simple and common)
    // Use Math.imul for potential 32-bit overflow handling in JS
    this.seed = (Math.imul(1103515245, this.seed) + 12345) % 2147483647;
    // Ensure result is positive before division
    const positiveSeed = this.seed < 0 ? this.seed + 2147483647 : this.seed;
    return positiveSeed / 2147483647; // Normalize to [0, 1)
  }

  // Generates a pseudo-random integer between min (inclusive) and max (exclusive)
  randomInt(min, max) {
    // Ensure min and max are integers
    min = Math.ceil(min);
    max = Math.floor(max);
    return min + Math.floor(this.random() * (max - min));
  }

  // Generates a pseudo-random float between min (inclusive) and max (exclusive)
  randomFloat(min, max) {
    return this.random() * (max - min) + min;
  }
}

/**
 * Manages the procedural generation of objects in an infinite world.
 * Divides the world into grid cells and uses deterministic seeding
 * to generate objects within those cells based on location.
 */
class InfiniteWorldManager {
  // --- Static properties for Name Generation ---
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

  constructor(config = {}) {
    this.config = {
      // --- Grid & Seeding ---
      cellSize: config.cellSize || 250, // Size of the grid cells for generation logic
      seedPrime1: config.seedPrime1 || 73856093, // Primes for hashing cell coords into a seed
      seedPrime2: config.seedPrime2 || 19349663,
      seedPrime3: config.seedPrime3 || 83492791,

      // --- Star Generation ---
      starBaseDensity: config.starBaseDensity || 0.0001, // Approx stars per pixel^2 (used to calculate per cell)
      minStarSize: config.minStarSize || 0.5,
      maxStarSize: config.maxStarSize || 1.8,
      starColor: config.starColor || "#FFFFFF", // Default white stars

      // --- Station Generation ---
      stationProbability: config.stationProbability || 0.05, // Chance (0-1) a cell *might* contain a station
      minStationSize: config.minStationSize || 50,
      maxStationSize: config.maxStationSize || 80,
      stationColor: config.stationColor || "#00FFFF", // Default station color (cyan)
      stationTypes: config.stationTypes || ["coriolis"], // Keep it simple for now

      // --- Other Config ---
      viewBufferFactor: config.viewBufferFactor || 1.5, // How much bigger area to generate than strictly visible (prevents pop-in at edges)
    };

    this.prng = new SeedablePRNG(); // Reusable PRNG instance
    // Calculate average stars per cell based on density and cell size
    this.avgStarsPerCell =
      this.config.starBaseDensity * this.config.cellSize * this.config.cellSize;
  }

  /**
   * Generates a unique and deterministic seed for a given cell coordinate.
   * Uses simple hashing with prime numbers.
   * @param {number} cellX - Integer x-coordinate of the cell.
   * @param {number} cellY - Integer y-coordinate of the cell.
   * @returns {number} A positive integer seed unique to this cell.
   */
  _getCellSeed(cellX, cellY) {
    // Ensure inputs are integers
    const x = Math.floor(cellX);
    const y = Math.floor(cellY);

    // Simple hash using primes and XOR. Using Math.imul for potentially better 32-bit int handling.
    let hash =
      Math.imul(x, this.config.seedPrime1) ^
      Math.imul(y, this.config.seedPrime2);
    hash = Math.imul(hash, this.config.seedPrime3); // Mix it up a bit more
    // Ensure positive seed for the PRNG
    hash = Math.abs(hash % 2147483647) + 1;
    return hash;
  }

  /**
   * Generates star data for a specific grid cell.
   * @param {number} cellX - Integer x-coordinate of the cell.
   * @param {number} cellY - Integer y-coordinate of the cell.
   * @returns {Array<object>} An array of star objects {x, y, size, color}.
   */
  _generateStarsForCell(cellX, cellY) {
    const stars = [];
    const cellSeed = this._getCellSeed(cellX, cellY);
    this.prng.setSeed(cellSeed); // Seed the PRNG specifically for this cell

    // Determine the number of stars in this cell (can vary slightly around the average)
    // Use PRNG seeded for this cell, so it's deterministic
    const numStars = this.prng.randomInt(
      Math.floor(this.avgStarsPerCell * 0.5), // Allow some variation
      Math.ceil(this.avgStarsPerCell * 1.5) + 1
    );

    const cellWorldX = cellX * this.config.cellSize;
    const cellWorldY = cellY * this.config.cellSize;

    for (let i = 0; i < numStars; i++) {
      // Generate position within the cell using the cell-seeded PRNG
      const offsetX = this.prng.random() * this.config.cellSize;
      const offsetY = this.prng.random() * this.config.cellSize;
      const size = this.prng.randomFloat(
        this.config.minStarSize,
        this.config.maxStarSize
      );

      stars.push({
        type: "star", // Add a type identifier
        x: cellWorldX + offsetX,
        y: cellWorldY + offsetY,
        size: size,
        color: this.config.starColor, // Use configured color
      });
    }
    return stars;
  }

  /**
   * Attempts to generate station data for a specific grid cell based on probability.
   * Includes generating a sci-fi style name.
   * @param {number} cellX - Integer x-coordinate of the cell.
   * @param {number} cellY - Integer y-coordinate of the cell.
   * @returns {object|null} A station object {type, id, name, x, y, size, radius, color, stationType} or null.
   */
  _generateStationForCell(cellX, cellY) {
    const cellSeed = this._getCellSeed(cellX, cellY); // Use the same seed as stars for consistency checks
    this.prng.setSeed(cellSeed); // Seed PRNG

    // Check probability FIRST
    if (this.prng.random() < this.config.stationProbability) {
      // --- Generate Station Properties ---
      const cellWorldX = cellX * this.config.cellSize;
      const cellWorldY = cellY * this.config.cellSize;

      // Place the station somewhere near the center of the cell (deterministic offset)
      const offsetX = this.prng.randomFloat(0.3, 0.7) * this.config.cellSize;
      const offsetY = this.prng.randomFloat(0.3, 0.7) * this.config.cellSize;

      const size = this.prng.randomFloat(
        this.config.minStationSize,
        this.config.maxStationSize
      );

      // Choose a station type deterministically
      const stationTypeIndex = this.prng.randomInt(
        0,
        this.config.stationTypes.length
      );
      const stationType = this.config.stationTypes[stationTypeIndex];

      const id = `station_${cellX}_${cellY}`;

      // --- Generate Station Name ---
      let stationName = "";
      const nameStyle = this.prng.randomInt(0, 5); // Choose one of several naming patterns

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
        case 0: // Prefix + Core + Number
          stationName = `${prefix} ${coreName} ${number}`;
          break;
        case 1: // Core + Numeral
          stationName = `${coreName} ${numeral}`;
          break;
        case 2: // Core + Designator
          stationName = `${coreName} ${designator}`;
          break;
        case 3: // Prefix + Number (e.g., Deep Space 9)
          stationName = `${prefix} ${shortNum}`;
          break;
        case 4: // Core + Short Number + Letter (e.g. Citadel 7-B)
          const letter = String.fromCharCode(65 + this.prng.randomInt(0, 5)); // A-F
          stationName = `${coreName} ${shortNum}-${letter}`;
          break;
        default: // Fallback: Core + Station + Number
          stationName = `${coreName} Station ${number}`;
          break;
      }

      // --- Return Station Object ---
      return {
        id: id, // Unique ID based on cell coordinates
        type: "station", // Type identifier
        name: stationName, // Generated sci-fi name!
        x: cellWorldX + offsetX,
        y: cellWorldY + offsetY,
        size: size,
        radius: size / 2, // Add radius for convenience
        color: this.config.stationColor, // Could vary based on type later
        stationType: stationType, // e.g., 'coriolis'
        initialAngle: this.prng.random() * Math.PI * 2, // Give it a starting rotation
        rotationSpeed:
          this.prng.randomFloat(0.1, 1.6) * (this.prng.random() < 0.5 ? 1 : -1), // Add random rotation speed/direction
      };
    }

    // No station generated for this cell
    return null;
  }

  /**
   * Calculates the visible cells and generates all objects (stars, stations) within them.
   * This is the main function to call from the game loop.
   * @param {number} cameraX - World x-coordinate of the camera's top-left corner.
   * @param {number} cameraY - World y-coordinate of the camera's top-left corner.
   * @param {number} viewWidth - Width of the camera's view.
   * @param {number} viewHeight - Height of the camera's view.
   * @returns {Array<object>} An array containing all generated star and station objects within the view buffer.
   */
  getObjectsInView(cameraX, cameraY, viewWidth, viewHeight) {
    const objects = [];

    // Calculate the buffered view area
    const bufferX = (viewWidth * (this.config.viewBufferFactor - 1)) / 2;
    const bufferY = (viewHeight * (this.config.viewBufferFactor - 1)) / 2;

    const viewLeft = cameraX - bufferX;
    const viewTop = cameraY - bufferY;
    const viewRight = cameraX + viewWidth + bufferX;
    const viewBottom = cameraY + viewHeight + bufferY;

    // Calculate the range of cells overlapping the buffered view
    const minCellX = Math.floor(viewLeft / this.config.cellSize);
    const maxCellX = Math.floor(viewRight / this.config.cellSize);
    const minCellY = Math.floor(viewTop / this.config.cellSize);
    const maxCellY = Math.floor(viewBottom / this.config.cellSize);

    // Iterate through all potentially visible cells
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        // Generate stars for this cell
        const stars = this._generateStarsForCell(cx, cy);
        objects.push(...stars); // Add all generated stars

        // Attempt to generate a station for this cell
        const station = this._generateStationForCell(cx, cy);
        if (station) {
          objects.push(station); // Add station if one was generated
        }
      }
    }

    return objects;
  }

  // --- Enemy Management (Conceptual - No change needed here for station names) ---
  /**
   * Determines which existing enemy objects should be removed because they are too far
   * from the player/camera focus.
   * @param {Array<object>} currentEnemies - An array of active enemy objects. Each must have 'id', 'x', 'y'.
   * @param {number} focusX - The world x-coordinate of the player or camera center.
   * @param {number} focusY - The world y-coordinate of the player or camera center.
   * @param {number} despawnRadius - The distance beyond which enemies should be removed.
   * @returns {Array<object>} An array of enemy objects that are outside the despawn radius.
   */
  getEnemiesToDespawn(currentEnemies, focusX, focusY, despawnRadius) {
    const enemiesToRemove = [];
    const despawnRadiusSq = despawnRadius * despawnRadius; // Use squared distance for efficiency

    for (const enemy of currentEnemies) {
      // Ensure enemy has position properties before checking
      if (typeof enemy.x === "number" && typeof enemy.y === "number") {
        const dx = enemy.x - focusX;
        const dy = enemy.y - focusY;
        const distSq = dx * dx + dy * dy;

        if (distSq > despawnRadiusSq) {
          enemiesToRemove.push(enemy); // Or just push enemy.id
        }
      } else {
        console.warn("Enemy object missing x/y coordinates:", enemy);
      }
    }
    return enemiesToRemove;
  }
}

// Example Usage (how you might call it):
/*
const worldManager = new InfiniteWorldManager({
    cellSize: 500,
    stationProbability: 0.1 // Increase probability for testing
});

// Simulate camera view
const cameraX = 1000;
const cameraY = 500;
const viewWidth = 800;
const viewHeight = 600;

const visibleObjects = worldManager.getObjectsInView(cameraX, cameraY, viewWidth, viewHeight);

const stations = visibleObjects.filter(obj => obj.type === 'station');
if (stations.length > 0) {
    console.log("Generated Stations:");
    stations.forEach(station => {
        console.log(` - ${station.name} (ID: ${station.id}, Type: ${station.stationType}) at (${station.x.toFixed(0)}, ${station.y.toFixed(0)})`);
    });
} else {
    console.log("No stations generated in this view.");
}

const stars = visibleObjects.filter(obj => obj.type === 'star');
console.log(`Generated ${stars.length} stars.`);
*/
