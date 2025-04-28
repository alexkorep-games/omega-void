// src/game/entities/GameObject.ts
import { IGameObject } from "../types";

let gameObjectIdCounter = 0;

export abstract class GameObject implements IGameObject {
  id: string;
  x: number;
  y: number;
  size: number;
  radius: number;
  color: string;

  constructor(
    x: number,
    y: number,
    size: number,
    color: string,
    typePrefix: string = "go"
  ) {
    this.id = `${typePrefix}_${gameObjectIdCounter++}`;
    this.x = x;
    this.y = y;
    this.size = size;
    this.color = color;
    this.radius = size / 2;
  }

  // Abstract methods if needed, or common methods
  abstract update(...args: any[]): void;
}
