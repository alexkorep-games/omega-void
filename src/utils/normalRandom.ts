// src/utils/normalRandom.ts
import { SeedablePRNG } from "../game/world/SeedablePRNG";

/**
 * Returns a standard normal distributed random number using the Box-Muller transform.
 * @param rng SeedablePRNG instance
 */
export function normalRandom(rng: SeedablePRNG): number {
  let u = 0, v = 0;
  while (u === 0) u = rng.random();
  while (v === 0) v = rng.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
