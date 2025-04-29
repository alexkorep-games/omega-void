// src/hooks/useBuyCargoLogic.ts
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useGameState } from "./useGameState"; // Use Game 2's state hook
import { getTonnesPerUnit, getCommodityUnit } from "../game/Market"; // Use Game 2's Market definitions

interface CargoItemDisplay {
  key: string;
  price: number;
  quantity: number; // Qty available at market
}

interface StatusMessage {
  text: string;
  type: "info" | "error" | "success";
  timestamp: number; // To help clear old messages
}

const MESSAGE_DURATION = 2500; // ms

export function useBuyCargoLogic() {
  const {
    gameState,
    updatePlayerState, // Use the generic updater
    updateMarketQuantity, // Function to update market
  } = useGameState();

  const market = gameState.market; // Get market snapshot from game state
  const playerCash = gameState.cash;
  const cargoHold = gameState.cargoHold;
  const cargoCapacity = gameState.cargoCapacity;

  const [cargoItems, setCargoItems] = useState<CargoItemDisplay[]>([]);
  const [selectedCommodityKey, setSelectedCommodityKey] = useState<
    string | null
  >(null);
  const [isEnteringQuantity, setIsEnteringQuantity] = useState(false);
  const [quantityInput, setQuantityInput] = useState("");
  const isProcessingInput = useRef(false); // Debounce flag
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  );
  const messageTimeoutRef = useRef<number | null>(null);

  // Helper to display status messages
  const showMessage = useCallback(
    (text: string, type: StatusMessage["type"]) => {
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      setStatusMessage({ text, type, timestamp: Date.now() });
      messageTimeoutRef.current = setTimeout(() => {
        setStatusMessage(null);
      }, MESSAGE_DURATION);
    },
    []
  );

  // Calculate cargo space left
  const cargoSpaceLeft = useMemo(() => {
    let used = 0;
    cargoHold.forEach((quantity, key) => {
      used += quantity * getTonnesPerUnit(key);
    });
    return Math.max(0, cargoCapacity - used);
  }, [cargoHold, cargoCapacity]);

  // Populate display items from market data
  useEffect(() => {
    if (market && gameState.gameView === "buy_cargo") {
      const items = Array.from(market.entries())
        .map(([key, state]): CargoItemDisplay => ({ key, ...state }))
        .sort((a, b) => a.key.localeCompare(b.key)); // Sort alphabetically

      setCargoItems(items);

      if (items.length > 0) {
        const currentKey = selectedCommodityKey;
        const foundIndex = items.findIndex((item) => item.key === currentKey);
        const newIndex = foundIndex !== -1 ? foundIndex : 0;
        setSelectedCommodityKey(items[newIndex].key);
      } else {
        setSelectedCommodityKey(null);
      }
      // Reset quantity input when market changes or screen loads
      setIsEnteringQuantity(false);
      setQuantityInput("");
      setStatusMessage(null); // Clear messages
    } else if (gameState.gameView !== "buy_cargo") {
      // Clear state if not on this screen
      setCargoItems([]);
      setSelectedCommodityKey(null);
      setIsEnteringQuantity(false);
      setStatusMessage(null);
    }
  }, [market, gameState.gameView, selectedCommodityKey]); // Rerun when market or view changes

  // --- Buy Action ---
  const performBuy = useCallback(
    (key: string, quantity: number) => {
      if (!market) return;
      const itemState = market.get(key);
      if (!itemState || quantity <= 0) return;

      const cost = quantity * itemState.price;
      const spaceNeeded = quantity * getTonnesPerUnit(key);

      if (playerCash < cost) {
        showMessage("Error: Insufficient credits.", "error");
        return false;
      }
      if (cargoSpaceLeft < spaceNeeded) {
        showMessage("Error: Insufficient cargo space.", "error");
        return false;
      }
      if (quantity > itemState.quantity) {
        showMessage("Error: Insufficient stock at station.", "error");
        return false;
      }

      // Perform the update using the generic updater
      updatePlayerState((prevState) => {
        const newCargo = new Map(prevState.cargoHold);
        newCargo.set(key, (newCargo.get(key) || 0) + quantity);
        return {
          ...prevState,
          cash: prevState.cash - cost,
          cargoHold: newCargo,
        };
      });

      // Update market quantity (this uses the helper from useGameState)
      updateMarketQuantity(key, -quantity);

      showMessage(
        `Bought ${quantity} ${getCommodityUnit(key)} ${key}.`,
        "success"
      );
      return true;
    },
    [
      market,
      playerCash,
      cargoSpaceLeft,
      updatePlayerState,
      updateMarketQuantity,
      showMessage,
    ]
  );

  // --- Input Handlers ---

  // Click handler (buy 1)
  const handleItemClick = useCallback(
    (key: string) => {
      if (isProcessingInput.current || isEnteringQuantity) return;
      isProcessingInput.current = true;

      setSelectedCommodityKey(key); // Select the clicked item first
      performBuy(key, 1); // Attempt to buy 1 unit

      setTimeout(() => {
        isProcessingInput.current = false;
      }, 100); // Debounce
    },
    [isProcessingInput, isEnteringQuantity, setSelectedCommodityKey, performBuy]
  );

  // Initiate buying multiple ('B' key)
  const handleBuyMultiple = useCallback(() => {
    if (
      isProcessingInput.current ||
      isEnteringQuantity ||
      !selectedCommodityKey
    )
      return;
    isProcessingInput.current = true;

    const itemState = market?.get(selectedCommodityKey);
    const spaceForOne = getTonnesPerUnit(selectedCommodityKey);

    if (
      itemState &&
      itemState.quantity > 0 &&
      cargoSpaceLeft >= spaceForOne &&
      playerCash >= itemState.price
    ) {
      setIsEnteringQuantity(true);
      setQuantityInput("");
      showMessage("Enter quantity to buy.", "info");
    } else {
      showMessage("Cannot buy: Check stock, space, or funds.", "error");
    }

    setTimeout(() => {
      isProcessingInput.current = false;
    }, 100);
  }, [
    isProcessingInput,
    isEnteringQuantity,
    selectedCommodityKey,
    market,
    cargoSpaceLeft,
    playerCash,
    showMessage,
  ]);

  return {
    market,
    cargoItems,
    selectedCommodityKey,
    quantityInput,
    isEnteringQuantity,
    handleItemClick,
    handleBuyMultiple,
    cargoSpaceLeft,
    playerCash,
    statusMessage,
    isProcessingInput: isProcessingInput.current, // Expose the current debounce state
  };
}
