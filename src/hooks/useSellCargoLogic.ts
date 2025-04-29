// src/hooks/useSellCargoLogic.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { useGameState } from "./useGameState"; // Use Game 2's state hook
import { getCommodityUnit } from "../game/Market"; // Use Game 2's Market definitions

interface CargoSellItemDisplay {
  key: string;
  holding: number; // Qty player has
  sellPrice: number; // Price market buys at
}

interface StatusMessage {
  text: string;
  type: "info" | "error" | "success";
  timestamp: number;
}

const MESSAGE_DURATION = 2500; // ms

export function useSellCargoLogic() {
  const {
    gameState,
    setGameView,
    updatePlayerState,
    updateMarketQuantity, // Function to update market
  } = useGameState();

  const market = gameState.market;
  const playerCash = gameState.cash;
  const cargoHold = gameState.cargoHold;

  const [cargoToSell, setCargoToSell] = useState<CargoSellItemDisplay[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCommodityKey, setSelectedCommodityKey] = useState<
    string | null
  >(null);
  const [isEnteringQuantity, setIsEnteringQuantity] = useState(false);
  const [quantityInput, setQuantityInput] = useState("");
  const isProcessingInput = useRef(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  );
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Populate items player can sell based on cargoHold and market prices
  useEffect(() => {
    if (market && gameState.gameView === "sell_cargo") {
      const items: CargoSellItemDisplay[] = [];
      cargoHold.forEach((holding, key) => {
        if (holding > 0) {
          const marketInfo = market.get(key);
          // Only list if market actually buys it (has a price > 0)
          if (marketInfo && marketInfo.price > 0) {
            items.push({ key, holding, sellPrice: marketInfo.price });
          }
          // Optionally list items market *doesn't* buy, but with price 0?
          // else {
          //   items.push({ key, holding, sellPrice: 0 });
          // }
        }
      });
      items.sort((a, b) => a.key.localeCompare(b.key)); // Sort alphabetically
      setCargoToSell(items);

      if (items.length > 0) {
        const currentKey = selectedCommodityKey;
        const foundIndex = items.findIndex((item) => item.key === currentKey);
        const newIndex = foundIndex !== -1 ? foundIndex : 0;
        setSelectedIndex(newIndex);
        setSelectedCommodityKey(items[newIndex].key);
      } else {
        setSelectedIndex(0);
        setSelectedCommodityKey(null);
      }
      // Reset quantity input when screen loads or cargo changes
      setIsEnteringQuantity(false);
      setQuantityInput("");
      setStatusMessage(null); // Clear messages
    } else if (gameState.gameView !== "sell_cargo") {
      // Clear state if not on this screen
      setCargoToSell([]);
      setSelectedCommodityKey(null);
      setIsEnteringQuantity(false);
      setStatusMessage(null);
    }
  }, [market, cargoHold, gameState.gameView, selectedCommodityKey]); // Rerun when market, cargo, or view changes

  // --- Sell Action ---
  const performSell = useCallback(
    (key: string, quantity: number) => {
      if (!market) return false;
      const itemInHold = cargoHold.get(key);
      const marketInfo = market.get(key);

      if (!itemInHold || itemInHold <= 0 || quantity <= 0) {
        showMessage("Error: Cannot sell item.", "error");
        return false;
      }
      if (!marketInfo || marketInfo.price <= 0) {
        showMessage("Error: Station does not buy this item.", "error");
        return false;
      }
      if (quantity > itemInHold) {
        showMessage("Error: Trying to sell more than held.", "error");
        return false;
      }

      const earnings = quantity * marketInfo.price;

      // Update player state
      updatePlayerState((prevState) => {
        const newCargo = new Map(prevState.cargoHold);
        const currentQty = newCargo.get(key) || 0;
        const newQty = currentQty - quantity;
        if (newQty <= 0) {
          newCargo.delete(key);
        } else {
          newCargo.set(key, newQty);
        }
        return {
          ...prevState,
          cash: prevState.cash + earnings,
          cargoHold: newCargo,
        };
      });

      // Update market quantity (increase market stock)
      updateMarketQuantity(key, +quantity);

      showMessage(
        `Sold ${quantity} ${getCommodityUnit(key)} ${key}.`,
        "success"
      );
      return true;
    },
    [market, cargoHold, updatePlayerState, updateMarketQuantity, showMessage]
  );

  // --- Input Handlers ---

  // Click handler (sell all)
  const handleItemClick = useCallback(
    (key: string) => {
      if (isProcessingInput.current || isEnteringQuantity) return;
      isProcessingInput.current = true;

      setSelectedCommodityKey(key); // Select clicked item
      const holding = cargoHold.get(key) || 0;
      if (holding > 0) {
        performSell(key, holding); // Sell all held units
      } else {
        showMessage("Error: Cannot sell 0 units.", "error");
      }

      setTimeout(() => {
        isProcessingInput.current = false;
      }, 100); // Debounce
    },
    [
      isProcessingInput,
      isEnteringQuantity,
      cargoHold,
      setSelectedCommodityKey,
      performSell,
      showMessage,
    ]
  );

  // Initiate selling multiple ('S' key)
  const handleSellMultiple = useCallback(() => {
    if (
      isProcessingInput.current ||
      isEnteringQuantity ||
      !selectedCommodityKey
    )
      return;
    isProcessingInput.current = true;

    const holding = cargoHold.get(selectedCommodityKey) || 0;
    const marketInfo = market?.get(selectedCommodityKey);

    if (holding > 0 && marketInfo && marketInfo.price > 0) {
      setIsEnteringQuantity(true);
      setQuantityInput(""); // Clear input field
      showMessage(`Enter quantity to sell (max ${holding}).`, "info");
    } else {
      showMessage("Cannot sell: Check holding or market price.", "error");
    }

    setTimeout(() => {
      isProcessingInput.current = false;
    }, 100);
  }, [
    isProcessingInput,
    isEnteringQuantity,
    selectedCommodityKey,
    cargoHold,
    market,
    showMessage,
  ]);

  return {
    market,
    cargoToSell,
    selectedCommodityKey,
    quantityInput,
    isEnteringQuantity,
    handleItemClick,
    handleSellMultiple,
    playerCash,
    statusMessage,
    isProcessingInput: isProcessingInput.current, // Expose the current debounce state
  };
}
