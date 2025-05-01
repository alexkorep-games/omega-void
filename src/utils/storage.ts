// src/utils/storage.ts
import { IPosition } from "../game/types";
import { QuestState, initialQuestState } from "../quests/QuestState"; // Import QuestState and initialQuestState

const SAVE_KEY = "omegaVoidSaveData_v0.1"; // Update version if save format changes significantly

// Define the structure of the saved data
interface SaveData {
  coordinates: IPosition;
  cash: number;
  cargoHold: [string, number][]; // Store Map as array of key-value pairs
  lastDockedStationId: string | null;
  discoveredStations: string[];
  knownStationPrices: [string, [string, number][]][]; // Store nested Map
  // Upgrade levels
  cargoPodLevel: number;
  shieldCapacitorLevel: number;
  engineBoosterLevel: number;
  hasAutoloader: boolean;
  hasNavComputer: boolean;
  // Quest data
  questState: QuestState;
  questInventory: [string, number][]; // Store Map as array
}

// --- Save Game State ---
export function saveGameState(
  data: Omit<
    SaveData,
    "cargoHold" | "knownStationPrices" | "questInventory"
  > & {
    cargoHold: Map<string, number>;
    knownStationPrices: Map<string, Map<string, number>>;
    questInventory: Map<string, number>; // Add quest inventory to input type
  }
): void {
  try {
    const saveData: SaveData = {
      ...data,
      cargoHold: Array.from(data.cargoHold.entries()),
      knownStationPrices: Array.from(data.knownStationPrices.entries()).map(
        ([stationId, priceMap]) => [stationId, Array.from(priceMap.entries())]
      ),
      questInventory: Array.from(data.questInventory.entries()), // Convert quest inventory Map to array
    };
    const jsonString = JSON.stringify(saveData);
    localStorage.setItem(SAVE_KEY, jsonString);
    // console.log("Game state saved."); // Reduce console noise
  } catch (error) {
    console.error("Error saving game state:", error);
  }
}

// --- Load Game State ---
export function loadGameState(): SaveData & {
  cargoHold: Map<string, number>;
  knownStationPrices: Map<string, Map<string, number>>;
  questInventory: Map<string, number>; // Add quest inventory to output type
} {
  try {
    const jsonString = localStorage.getItem(SAVE_KEY);
    if (jsonString) {
      const loadedData: SaveData = JSON.parse(jsonString);
      // Convert arrays back to Maps
      const cargoHoldMap = new Map(loadedData.cargoHold);
      const knownPricesMap = new Map(
        loadedData.knownStationPrices.map(([stationId, priceArray]) => [
          stationId,
          new Map(priceArray),
        ])
      );
      const questInventoryMap = new Map(loadedData.questInventory); // Convert quest inventory array back to Map

      // Validate loaded quest state structure (simple check)
      const validQuestState =
        loadedData.questState &&
        typeof loadedData.questState.quests === "object"
          ? loadedData.questState
          : initialQuestState; // Fallback to initial if invalid

      console.log("Game state loaded.");
      return {
        ...loadedData,
        cargoHold: cargoHoldMap,
        knownStationPrices: knownPricesMap,
        questState: validQuestState, // Return validated or initial quest state
        questInventory: questInventoryMap, // Return converted quest inventory
      };
    }
  } catch (error) {
    console.error("Error loading game state:", error);
  }

  // Return default values if loading fails or no save exists
  console.log("No valid save data found, returning defaults.");
  return {
    coordinates: { x: 0, y: 0 },
    cash: 500, // Default starting cash
    cargoHold: new Map<string, number>(),
    lastDockedStationId: null,
    discoveredStations: [],
    knownStationPrices: new Map<string, Map<string, number>>(),
    cargoPodLevel: 0,
    shieldCapacitorLevel: 0,
    engineBoosterLevel: 0,
    hasAutoloader: false,
    hasNavComputer: false,
    questState: initialQuestState, // Default quest state
    questInventory: new Map<string, number>(), // Default empty quest inventory
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
