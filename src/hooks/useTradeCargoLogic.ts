// src/hooks/useTradeCargoLogic.ts
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useGameState } from "./useGameState"; // Use Game 2's state hook
import { getTonnesPerUnit, getCommodityUnit } from "../game/Market"; // Use Game 2's Market definitions

// --- Types ---

type TradeMode = "buy" | "sell";

// Unified display item structure
interface TradeItemDisplay {
  key: string;
  marketPrice: number; // Price market sells at (for buying) or buys at (for selling)
  marketQuantity: number; // Qty available AT market (relevant for buying)
  playerHolding: number; // Qty player currently holds (relevant for selling)
}

interface StatusMessage {
  text: string;
  type: "info" | "error" | "success";
  timestamp: number; // To help clear old messages
}

const MESSAGE_DURATION = 2500; // ms

export function useTradeCargoLogic(mode: TradeMode) {
  const {
    gameState,
    updatePlayerState,
    updateMarketQuantity,
  } = useGameState();

  const {
    market,
    cash: playerCash,
    cargoHold,
    cargoCapacity,
    gameView,
  } = gameState;

  // --- Internal State ---
  const [tradeItems, setTradeItems] = useState<TradeItemDisplay[]>([]);
  const [selectedCommodityKey, setSelectedCommodityKey] = useState<
    string | null
  >(null);
  const [isEnteringQuantity, setIsEnteringQuantity] = useState(false);
  const [quantityInput, setQuantityInput] = useState("");
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  );
  const messageTimeoutRef = useRef<number | null>(null); // Use number for browser setTimeout return type
  const isProcessingInput = useRef(false); // Debounce flag

  // --- Memoized Calculations ---
  const cargoSpaceLeft = useMemo(() => {
    let used = 0;
    cargoHold.forEach((quantity, key) => {
      used += quantity * getTonnesPerUnit(key);
    });
    return Math.max(0, cargoCapacity - used);
  }, [cargoHold, cargoCapacity]);

  // --- Helpers ---
  const showMessage = useCallback(
    (text: string, type: StatusMessage["type"]) => {
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      setStatusMessage({ text, type, timestamp: Date.now() });
      messageTimeoutRef.current = window.setTimeout(() => {
        // Use window.setTimeout for explicit browser context
        setStatusMessage(null);
      }, MESSAGE_DURATION);
    },
    []
  );

  // --- Core Trade Action ---
  const performTrade = useCallback(
    (key: string, quantity: number, tradeMode: TradeMode) => {
      if (!market || quantity <= 0) return false;

      const marketInfo = market.get(key);
      const playerHolding = cargoHold.get(key) || 0;

      if (!marketInfo) {
        showMessage("Error: Item not traded at this station.", "error");
        return false;
      }

      if (tradeMode === "buy") {
        // --- Buy Validation ---
        const cost = quantity * marketInfo.price;
        const spaceNeeded = quantity * getTonnesPerUnit(key);

        if (playerCash < cost) {
          showMessage("Error: Insufficient credits.", "error");
          return false;
        }
        if (cargoSpaceLeft < spaceNeeded) {
          showMessage("Error: Insufficient cargo space.", "error");
          return false;
        }
        if (quantity > marketInfo.quantity) {
          showMessage("Error: Insufficient stock at station.", "error");
          return false;
        }

        // --- Perform Buy Update ---
        updatePlayerState((prevState) => {
          const newCargo = new Map(prevState.cargoHold);
          newCargo.set(key, (newCargo.get(key) || 0) + quantity);
          return {
            ...prevState,
            cash: prevState.cash - cost,
            cargoHold: newCargo,
          };
        });
        updateMarketQuantity(key, -quantity); // Decrease market stock
        showMessage(
          `Bought ${quantity} ${getCommodityUnit(key)} ${key}.`,
          "success"
        );
      } else if (tradeMode === "sell") {
        // --- Sell Validation ---
        if (playerHolding <= 0) {
          showMessage("Error: Cannot sell item you don't have.", "error");
          return false;
        }
        if (marketInfo.price <= 0) {
          showMessage("Error: Station does not buy this item.", "error");
          return false;
        }
        if (quantity > playerHolding) {
          showMessage(
            `Error: Trying to sell ${quantity}, only have ${playerHolding}.`,
            "error"
          );
          return false;
        }

        const earnings = quantity * marketInfo.price;

        // --- Perform Sell Update ---
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
        updateMarketQuantity(key, +quantity); // Increase market stock
        showMessage(
          `Sold ${quantity} ${getCommodityUnit(key)} ${key}.`,
          "success"
        );
      } else {
        console.error("Invalid trade mode:", tradeMode);
        return false; // Should not happen
      }

      return true; // Trade successful
    },
    [
      market,
      playerCash,
      cargoHold,
      cargoSpaceLeft,
      updatePlayerState,
      updateMarketQuantity,
      showMessage,
    ]
  );

  // --- useEffect for Populating Data and Handling View Changes ---
  useEffect(() => {
    if (!market || !mode) {
      // Clear state if not on a trading screen or market not loaded
      setTradeItems([]);
      setSelectedCommodityKey(null);
      setIsEnteringQuantity(false);
      setQuantityInput("");
      setStatusMessage(null);
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      return;
    }

    let items: TradeItemDisplay[] = [];
    if (mode === "buy") {
      items = Array.from(market.entries())
        .map(
          ([key, state]): TradeItemDisplay => ({
            key,
            marketPrice: state.price,
            marketQuantity: state.quantity,
            playerHolding: cargoHold.get(key) || 0, // Show holding even when buying
          })
        )
        .sort((a, b) => a.key.localeCompare(b.key)); // Sort alphabetically
    } else if (mode === "sell") {
      items = Array.from(cargoHold.entries())
        .filter((row) => row[1] > 0) // Only list items held
        .map(([key, holding]): TradeItemDisplay | null => {
          const marketInfo = market.get(key);
          // Only list if market actually buys it (has a price > 0)
          if (marketInfo && marketInfo.price > 0) {
            return {
              key,
              marketPrice: marketInfo.price, // Price station buys at
              marketQuantity: marketInfo.quantity, // Market stock (less relevant for selling display, but keep for consistency)
              playerHolding: holding,
            };
          }
          // Optionally, list items the market *doesn't* buy with price 0 if needed
          // else if (marketInfo) { // Market exists but price is 0
          //    return { key, marketPrice: 0, marketQuantity: marketInfo.quantity, playerHolding: holding };
          // }
          return null; // Don't list if market doesn't know about it or doesn't buy
        })
        .filter((item): item is TradeItemDisplay => item !== null) // Remove null entries
        .sort((a, b) => a.key.localeCompare(b.key)); // Sort alphabetically
    }

    setTradeItems(items);

    // Maintain selection or select first item
    if (items.length > 0) {
      const currentKey = selectedCommodityKey;
      const foundIndex = items.findIndex((item) => item.key === currentKey);
      const newIndex = foundIndex !== -1 ? foundIndex : 0;
      // Ensure the key actually exists at the new index before setting
      if (items[newIndex]) {
        setSelectedCommodityKey(items[newIndex].key);
      } else {
        setSelectedCommodityKey(null); // Should not happen if items.length > 0
      }
    } else {
      setSelectedCommodityKey(null);
    }

    // Reset quantity input when view/data changes
    setIsEnteringQuantity(false);
    setQuantityInput("");
    // Don't clear message immediately on list refresh, only on view change (handled above)

    // Rerun when view, market, or cargo changes. Include selectedCommodityKey to handle selection persistence.
  }, [gameView, market, cargoHold, selectedCommodityKey]);

  // --- Input Handlers ---

  // Handles primary action on item click/select (Buy 1 / Sell All)
  const handleItemPrimaryAction = useCallback(
    (key: string) => {
      if (isProcessingInput.current || isEnteringQuantity || !mode) return;
      isProcessingInput.current = true;
      setSelectedCommodityKey(key); // Select the item

      let quantityToTrade = 0;
      if (mode === "buy") {
        quantityToTrade = 1;
      } else if (mode === "sell") {
        quantityToTrade = cargoHold.get(key) || 0;
      }

      if (quantityToTrade > 0) {
        performTrade(key, quantityToTrade, mode);
      } else {
        if (mode === "sell")
          showMessage("Error: Cannot sell 0 units.", "error");
        // No message for buy 1 if stock/cash/space is zero, performTrade handles that
      }

      setTimeout(() => {
        isProcessingInput.current = false;
      }, 100); // Debounce
    },
    [
      isProcessingInput,
      isEnteringQuantity,
      mode,
      performTrade,
      cargoHold,
      showMessage,
    ]
  );

  // Initiates entering quantity for Buy Multiple / Sell Multiple
  const handleInitiateQuantityTrade = useCallback(() => {
    if (
      isProcessingInput.current ||
      isEnteringQuantity ||
      !selectedCommodityKey ||
      !mode ||
      !market
    )
      return;

    isProcessingInput.current = true; // Prevent double triggers

    const item = tradeItems.find((i) => i.key === selectedCommodityKey);
    if (!item) {
      console.error("Selected item not found in trade list");
      setTimeout(() => {
        isProcessingInput.current = false;
      }, 100);
      return;
    }

    let canTrade = false;
    let promptMessage = "";

    if (mode === "buy") {
      const spaceForOne = getTonnesPerUnit(selectedCommodityKey);
      canTrade =
        item.marketQuantity > 0 &&
        cargoSpaceLeft >= spaceForOne &&
        playerCash >= item.marketPrice;
      promptMessage = "Enter quantity to buy.";
    } else if (mode === "sell") {
      canTrade = item.playerHolding > 0 && item.marketPrice > 0;
      promptMessage = `Enter quantity to sell (max ${item.playerHolding}).`;
    }

    if (canTrade) {
      setIsEnteringQuantity(true);
      setQuantityInput(""); // Clear previous input
      showMessage(promptMessage, "info");
    } else {
      showMessage(
        mode === "buy"
          ? "Cannot buy: Check stock, space, or funds."
          : "Cannot sell: Check holding or market price.",
        "error"
      );
    }

    // Release debounce slightly after check
    setTimeout(() => {
      isProcessingInput.current = false;
    }, 100);
  }, [
    isProcessingInput,
    isEnteringQuantity,
    selectedCommodityKey,
    mode,
    market, // Added dependency
    tradeItems, // Added dependency
    cargoSpaceLeft, // Added dependency
    playerCash, // Added dependency
    showMessage,
  ]);

  // Handles changes to the quantity input field
  const handleQuantityInputChange = useCallback((value: string) => {
    // Allow only numbers
    const numericValue = value.replace(/[^0-9]/g, "");
    setQuantityInput(numericValue);
  }, []);

  // Confirms the entered quantity and performs the trade
  const handleConfirmQuantity = useCallback(() => {
    if (!isEnteringQuantity || !selectedCommodityKey || !mode) return;

    const quantity = parseInt(quantityInput, 10);

    if (isNaN(quantity) || quantity <= 0) {
      showMessage("Invalid quantity entered.", "error");
      // Optionally reset state or keep input open
      // setIsEnteringQuantity(false);
      // setQuantityInput("");
      return; // Don't proceed
    }

    performTrade(selectedCommodityKey, quantity, mode);

    // Reset quantity input state regardless of success/failure of trade itself
    // (performTrade shows specific errors)
    setIsEnteringQuantity(false);
    setQuantityInput("");
    // Optionally clear info message if trade was attempted
    // setStatusMessage(null); // Or let new success/error message overwrite it
  }, [
    isEnteringQuantity,
    selectedCommodityKey,
    quantityInput,
    mode,
    performTrade,
    showMessage,
  ]);

  // Cancels the quantity input mode
  const handleCancelQuantity = useCallback(() => {
    setIsEnteringQuantity(false);
    setQuantityInput("");
    showMessage("Trade cancelled.", "info"); // Provide feedback
  }, [showMessage]);

  // --- Return Values ---
  return {
    mode, // 'buy', 'sell', or null
    market, // Expose market snapshot used
    tradeItems, // Unified list for display
    selectedCommodityKey,
    setSelectedCommodityKey, // Allow external control if needed (e.g., keyboard nav)

    isEnteringQuantity,
    quantityInput,
    handleQuantityInputChange,
    handleConfirmQuantity,
    handleCancelQuantity,

    // Primary actions
    handleItemPrimaryAction, // Handles click/select (Buy 1 / Sell All)
    handleInitiateQuantityTrade, // Handles 'B' or 'S' key (Buy/Sell Multiple)

    // Player state relevant to trading
    playerCash,
    cargoSpaceLeft, // Relevant for buying

    // UI feedback
    statusMessage,
    isProcessingInput: isProcessingInput.current, // Expose debounce state
  };
}
