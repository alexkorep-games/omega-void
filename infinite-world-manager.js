// Paste the content of the InfiniteWorldManager and SeedablePRNG classes here
// from the previous response. Make sure this file exists.

/**
 * Simple Seedable Pseudo-Random Number Generator (LCG - Linear Congruential Generator)
 * Necessary for deterministic generation based on location.
 */
class SeedablePRNG {
  constructor(seed = 1) {
      this.seed = Math.abs(seed % 2147483647) + 1; // Ensure positive seed > 0
  }

  setSeed(seed) {
      this.seed = Math.abs(seed % 2147483647) + 1;
  }

  // Generates a pseudo-random float between 0 (inclusive) and 1 (exclusive)
  random() {
      // Parameters from POSIX standard (simple and common)
      this.seed = (1103515245 * this.seed + 12345) % 2147483647;
      return this.seed / 2147483647; // Normalize to [0, 1)
  }

  // Generates a pseudo-random integer between min (inclusive) and max (exclusive)
  randomInt(min, max) {
      return Math.floor(this.random() * (max - min) + min);
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
  constructor(config = {}) {
      this.config = {
          // --- Grid & Seeding ---
          cellSize: config.cellSize || 250,        // Size of the grid cells for generation logic
          seedPrime1: config.seedPrime1 || 73856093, // Primes for hashing cell coords into a seed
          seedPrime2: config.seedPrime2 || 19349663,
          seedPrime3: config.seedPrime3 || 83492791,

          // --- Star Generation ---
          starBaseDensity: config.starBaseDensity || 0.0001, // Approx stars per pixel^2 (used to calculate per cell)
          minStarSize: config.minStarSize || 0.5,
          maxStarSize: config.maxStarSize || 1.8,
          starColor: config.starColor || '#00FFFF', // Use cyan like original stars

          // --- Station Generation ---
          stationProbability: config.stationProbability || 0.05, // Chance (0-1) a cell *might* contain a station
          minStationSize: config.minStationSize || 50,
          maxStationSize: config.maxStationSize || 80,
          stationColor: config.stationColor || '#00FFFF', // Default station color (cyan)
          stationTypes: config.stationTypes || ['coriolis'], // Keep it simple for now

           // --- Other Config ---
           viewBufferFactor: config.viewBufferFactor || 1.5 // How much bigger area to generate than strictly visible (prevents pop-in at edges)
      };

      this.prng = new SeedablePRNG(); // Reusable PRNG instance
       // Calculate average stars per cell based on density and cell size
      this.avgStarsPerCell = this.config.starBaseDensity * this.config.cellSize * this.config.cellSize;
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
      let hash = Math.imul(x, this.config.seedPrime1) ^ Math.imul(y, this.config.seedPrime2);
      // Ensure positive seed for the PRNG (modulo a large prime and add 1)
      hash = Math.abs(hash % this.config.seedPrime3) + 1;
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
          const size = this.prng.randomFloat(this.config.minStarSize, this.config.maxStarSize);

          stars.push({
              type: 'star', // Add a type identifier
              x: cellWorldX + offsetX,
              y: cellWorldY + offsetY,
              size: size,
              color: this.config.starColor // Use configured color
          });
      }
      return stars;
  }

  /**
   * Attempts to generate station data for a specific grid cell based on probability.
   * @param {number} cellX - Integer x-coordinate of the cell.
   * @param {number} cellY - Integer y-coordinate of the cell.
   * @returns {object|null} A station object {type, id, x, y, size, radius, color, stationType} or null.
   */
  _generateStationForCell(cellX, cellY) {
      const cellSeed = this._getCellSeed(cellX, cellY); // Use the same seed as stars for consistency checks
      this.prng.setSeed(cellSeed); // Seed PRNG

      // Check probability FIRST
      if (this.prng.random() < this.config.stationProbability) {
          // A station should exist in this cell!
          const cellWorldX = cellX * this.config.cellSize;
          const cellWorldY = cellY * this.config.cellSize;

          // Place the station somewhere near the center of the cell (deterministic offset)
          const offsetX = this.prng.randomFloat(0.3, 0.7) * this.config.cellSize;
          const offsetY = this.prng.randomFloat(0.3, 0.7) * this.config.cellSize;

          const size = this.prng.randomFloat(this.config.minStationSize, this.config.maxStationSize);

          // Choose a station type deterministically
          const stationTypeIndex = this.prng.randomInt(0, this.config.stationTypes.length);
          const stationType = this.config.stationTypes[stationTypeIndex];

           // Add unique ID based on cell? Could be useful.
           const id = `station_${cellX}_${cellY}`;

          return {
              id: id,          // Unique ID based on cell coordinates
              type: 'station', // Type identifier
              x: cellWorldX + offsetX,
              y: cellWorldY + offsetY,
              size: size,
              radius: size / 2, // Add radius for convenience
              color: this.config.stationColor, // Could vary based on type later
              stationType: stationType,         // e.g., 'coriolis'
              angle: this.prng.random() * Math.PI * 2, // Give it a starting rotation
              rotationSpeed: 0.005 // Constant speed for now
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

      // Keep track of processed cells if needed (though for pure generation, maybe not required)
      // const processedCells = new Set();

      // Iterate through all potentially visible cells
      for (let cx = minCellX; cx <= maxCellX; cx++) {
          for (let cy = minCellY; cy <= maxCellY; cy++) {
              // const cellKey = `${cx},${cy}`;
              // if (processedCells.has(cellKey)) continue; // Skip if already done (optional opt.)

              // Generate stars for this cell
              const stars = this._generateStarsForCell(cx, cy);
              objects.push(...stars); // Add all generated stars

              // Attempt to generate a station for this cell
              const station = this._generateStationForCell(cx, cy);
              if (station) {
                  objects.push(station); // Add station if one was generated
              }

              // processedCells.add(cellKey); // Mark cell as processed (optional opt.)
          }
      }

      return objects;
  }

  // --- Enemy Management (Conceptual) ---
  /**
   * Determines which existing enemy objects should be removed because they are too far
   * from the player/camera focus. This logic would be called separately in the game loop.
   *
   * NOTE: This function ONLY identifies enemies to remove. The actual removal
   * must happen in your main game logic based on the returned IDs/objects.
   * It also doesn't handle *spawning* new enemies based on proximity, only removal.
   *
   * @param {Array<object>} currentEnemies - An array of active enemy objects in the game.
   *                                         Each enemy object MUST have an 'id' and 'x', 'y' properties.
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
           if (typeof enemy.x === 'number' && typeof enemy.y === 'number') {
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