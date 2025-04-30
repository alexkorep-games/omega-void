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
    totalCargoCapacity,
  } = useGameState(); // Get totalCargoCapacity

  const {
    market,
    cash: playerCash,
    cargoHold,
    // cargoCapacity, // Use totalCargoCapacity instead
    gameView,
  } = gameState;

  // --- Internal State ---
  const [tradeItems, setTradeItems] = useState<TradeItemDisplay[]>([]);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  );
  const messageTimeoutRef = useRef<number | null>(null); // Use number for browser setTimeout return type

  // --- Memoized Calculations ---
  const cargoSpaceLeft = useMemo(() => {
    let used = 0;
    cargoHold.forEach((quantity, key) => {
      used += quantity * getTonnesPerUnit(key);
    });
    // Use totalCargoCapacity derived from the hook
    return Math.max(0, totalCargoCapacity - used);
  }, [cargoHold, totalCargoCapacity]);

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
  }, [gameView, market, cargoHold, mode]); // Dependency on lastClickedItemKey to potentially preserve highlight

  // --- Input Handlers ---

  // Handles primary action on item click (Buy 1 / Sell All)
  const handleItemPrimaryAction = useCallback(
    (key: string) => {
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
    },
    [mode, performTrade, cargoHold, showMessage]
  );

  // --- Return Values ---
  return {
    mode, // 'buy', 'sell', or null
    market, // Expose market snapshot used
    tradeItems, // Unified list for display

    // Primary actions
    handleItemPrimaryAction, // Handles click (Buy 1 / Sell All)

    // Player state relevant to trading
    playerCash,
    cargoSpaceLeft, // Relevant for buying

    // UI feedback
    statusMessage,
  };
}
