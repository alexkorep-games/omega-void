import { IStation } from "../types";

// Coordinates are world coordinates (not cell indices)
export const FIXED_STATIONS: IStation[] = [
  {
    id: "station_-10_4_fixA", type: "station", name: "Orion Citadel (Corp HQ)", isFixed: true,
    x: -3500, y: 1400, coordinates: { x: -3500, y: 1400 }, size: 80, radius: 40, color: "#FFA500", // Orange
    stationType: "unique_quest", initialAngle: Math.PI / 4, rotationSpeed: 0.1, angle: 0, // Angle updated dynamically
    economyType: "High Tech", techLevel: "TL6",
  },
  {
    id: "station_5_-8_fixB", type: "station", name: "Zeta Relay (Abandoned)", isFixed: true,
    x: 1750, y: -2800, coordinates: { x: 1750, y: -2800 }, size: 60, radius: 30, color: "#808080", // Grey
    stationType: "unique_quest", initialAngle: Math.PI, rotationSpeed: -0.05, angle: 0, // Angle updated dynamically
    economyType: "Industrial", techLevel: "TL2",
  },
  {
    id: "station_0_0_fixC", type: "station", name: "Point Alpha (Pirate Hub)", isFixed: true,
    x: 0, y: 0, coordinates: { x: 0, y: 0 }, size: 70, radius: 35, color: "#FF0000", // Red
    stationType: "unique_quest", initialAngle: 0, rotationSpeed: 0.3, angle: 0, // Angle updated dynamically
    economyType: "Pirate", techLevel: "TL3",
  },
];
