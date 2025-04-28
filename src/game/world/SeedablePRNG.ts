// src/game/world/SeedablePRNG.ts

/**
 * Simple Seedable Pseudo-Random Number Generator (LCG - Linear Congruential Generator)
 * Necessary for deterministic generation based on location.
 */
export class SeedablePRNG {
  private seed: number;

  constructor(seed = 1) {
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
