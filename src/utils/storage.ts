// src/utils/storage.ts
import { DEFAULT_STARTING_CASH } from "../game/config";
import {
  IPosition,
  CargoHold,
  QuestInventory,
  ChatMessage,
} from "../game/types"; // Import Record types & ChatMessage
import { QuestState, initialQuestState } from "../quests/QuestState";

const SAVE_KEY = "omegaVoidSaveData_v0.1.1"; // Incremented version for new structure

// Define the structure of the saved data, aligning with IGameState changes
export interface SaveData {
  coordinates: IPosition;
  cash: number;
  cargoHold: CargoHold;
  lastDockedStationId: string | null;
  discoveredStations: string[];
  knownStationPrices: Record<string, Record<string, number>>;
  knownStationQuantities: Record<string, Record<string, number>>; // ADDED
  // Upgrade levels
  cargoPodLevel: number;
  shieldCapacitorLevel: number;
  engineBoosterLevel: number;
  hasAutoloader: boolean;
  hasNavComputer: boolean;
  // Quest data
  questState: QuestState;
  questInventory: QuestInventory;
  // --- Chat Data ---
  chatLog: ChatMessage[];
  lastProcessedDialogId: number;
}

// --- Save Game State ---
export function saveGameState(data: SaveData): void {
  try {
    const jsonString = JSON.stringify(data);
    localStorage.setItem(SAVE_KEY, jsonString);
  } catch (error) {
    console.error("Error saving game state:", error);
  }
}

// --- Load Game State ---
export function loadGameState(): SaveData {
  try {
    const jsonString = localStorage.getItem(SAVE_KEY);
    if (jsonString) {
      const loadedData = JSON.parse(jsonString) as Partial<SaveData>; // Load as partial for validation

      // --- Validation and Defaults ---
      const coordinates =
        loadedData.coordinates &&
        typeof loadedData.coordinates.x === "number" &&
        typeof loadedData.coordinates.y === "number"
          ? loadedData.coordinates
          : { x: 0, y: 0 };

      const cash =
        typeof loadedData.cash === "number" && !isNaN(loadedData.cash)
          ? loadedData.cash
          : DEFAULT_STARTING_CASH;

      const cargoHold =
        loadedData.cargoHold && typeof loadedData.cargoHold === "object"
          ? loadedData.cargoHold
          : {};

      const lastDockedStationId =
        typeof loadedData.lastDockedStationId === "string" ||
        loadedData.lastDockedStationId === null
          ? loadedData.lastDockedStationId
          : null;

      const discoveredStations =
        Array.isArray(loadedData.discoveredStations) &&
        loadedData.discoveredStations.every((s) => typeof s === "string")
          ? loadedData.discoveredStations
          : [];

      const knownStationPrices =
        loadedData.knownStationPrices &&
        typeof loadedData.knownStationPrices === "object" &&
        Object.values(loadedData.knownStationPrices).every(
          (v) => typeof v === "object" && v !== null
        )
          ? loadedData.knownStationPrices
          : {};

      const knownStationQuantities =
        loadedData.knownStationQuantities &&
        typeof loadedData.knownStationQuantities === "object" &&
        Object.values(loadedData.knownStationQuantities).every(
          (v) => typeof v === "object" && v !== null
        )
          ? loadedData.knownStationQuantities
          : {};

      const cargoPodLevel = loadedData.cargoPodLevel || 0;
      const shieldCapacitorLevel = loadedData.shieldCapacitorLevel || 0;
      const engineBoosterLevel = loadedData.engineBoosterLevel || 0;
      const hasAutoloader = !!loadedData.hasAutoloader;
      const hasNavComputer = !!loadedData.hasNavComputer;

      const questState =
        loadedData.questState &&
        typeof loadedData.questState.quests === "object"
          ? loadedData.questState
          : initialQuestState;

      const questInventory =
        loadedData.questInventory &&
        typeof loadedData.questInventory === "object"
          ? loadedData.questInventory
          : {};

      const chatLog = Array.isArray(loadedData.chatLog)
        ? loadedData.chatLog
        : [];
      const lastProcessedDialogId =
        typeof loadedData.lastProcessedDialogId === "number"
          ? loadedData.lastProcessedDialogId
          : -1;

      console.log("Game state loaded and validated.");
      return {
        coordinates,
        cash,
        cargoHold,
        lastDockedStationId,
        discoveredStations,
        knownStationPrices,
        knownStationQuantities, // ADDED
        cargoPodLevel,
        shieldCapacitorLevel,
        engineBoosterLevel,
        hasAutoloader,
        hasNavComputer,
        questState,
        questInventory,
        chatLog,
        lastProcessedDialogId,
      };
    }
  } catch (error) {
    console.error("Error loading or parsing game state:", error);
  }

  console.log("No valid save data found, returning defaults.");
  return {
    coordinates: { x: 0, y: 0 },
    cash: DEFAULT_STARTING_CASH,
    cargoHold: {},
    lastDockedStationId: null,
    discoveredStations: [],
    knownStationPrices: {},
    knownStationQuantities: {},
    cargoPodLevel: 0,
    shieldCapacitorLevel: 0,
    engineBoosterLevel: 0,
    hasAutoloader: false,
    hasNavComputer: false,
    questState: initialQuestState,
    questInventory: {},
    chatLog: [],
    lastProcessedDialogId: -1,
  };
}

// --- Clear Save Data ---
export function clearSaveData(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    console.log("Save data cleared.");
  } catch (error) {
    console.error("Error clearing save data:", error);
  }
}
