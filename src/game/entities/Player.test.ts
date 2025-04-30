import { describe, test, expect } from "vitest";
import { Player } from "./Player";

describe("Player", () => {
  test("should initialize with correct properties", () => {
    const player = new Player(5, 5);
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
    expect(player.shieldLevel).toBeDefined();
  });
});