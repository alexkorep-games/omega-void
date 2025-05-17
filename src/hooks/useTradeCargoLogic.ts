// src/hooks/useTradeCargoLogic.ts
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useGameState } from "./useGameState";
import { getTonnesPerUnit, getCommodityUnit } from "../game/Market";

// Types
type TradeMode = "buy" | "sell";

interface TradeItemDisplay {
  key: string;
  marketPrice: number;
  marketQuantity: number;
  playerHolding: number;
}

interface StatusMessage {
  text: string;
  type: "info" | "error" | "success";
  timestamp: number;
}

const MESSAGE_DURATION = 2500;

export function useTradeCargoLogic(mode: TradeMode) {
  const {
    gameState,
    buyCargo,
    sellCargo,
    updateMarketQuantity,
    totalCargoCapacity,
  } = useGameState();

  const { cold } = gameState;

  const {
    market,
    cash: playerCash,
    cargoHold, // This is Record<string, number>
    gameView,
  } = cold;

  // Internal State
  const [tradeItems, setTradeItems] = useState<TradeItemDisplay[]>([]);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  );
  const messageTimeoutRef = useRef<number | null>(null);

  // Memoized Calculations
  const cargoSpaceLeft = useMemo(() => {
    let used = 0;
    // Iterate over Record
    Object.entries(cargoHold).forEach(([key, quantity]) => {
      used += quantity * getTonnesPerUnit(key);
    });
    return Math.max(0, totalCargoCapacity - used);
  }, [cargoHold, totalCargoCapacity]);

  // Helpers
  const showMessage = useCallback(
    (text: string, type: StatusMessage["type"]) => {
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      setStatusMessage({ text, type, timestamp: Date.now() });
      messageTimeoutRef.current = window.setTimeout(() => {
        setStatusMessage(null);
      }, MESSAGE_DURATION);
    },
    []
  );

  // Core Trade Action
  const performTrade = useCallback(
    (key: string, quantity: number, tradeMode: TradeMode) => {
      if (!market || quantity <= 0) return false;

      // Use .get() method of MarketSnapshot (which now accesses the internal Record)
      const marketInfo = market.get(key);
      const playerHolding = cargoHold[key] || 0; // Direct access for Record

      if (!marketInfo) {
        showMessage("Error: Item not traded at this station.", "error");
        return false;
      }

      if (tradeMode === "buy") {
        // Buy Validation
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

        buyCargo(key, quantity); // Update player state
        updateMarketQuantity(key, -quantity); // Decrease market stock
        showMessage(
          `Bought ${quantity}${getCommodityUnit(key)} ${key}.`,
          "success"
        );
      } else if (tradeMode === "sell") {
        // Sell Validation
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

        // Perform Sell Update
        sellCargo(key, quantity, earnings); // Update player state
        updateMarketQuantity(key, +quantity); // Increase market stock
        showMessage(
          `Sold ${quantity}${getCommodityUnit(key)} ${key}.`,
          "success"
        );
      } else {
        console.error("Invalid trade mode:", tradeMode);
        return false;
      }
      return true; // Trade successful
    },
    [
      market,
      cargoHold,
      showMessage,
      playerCash,
      cargoSpaceLeft,
      buyCargo,
      updateMarketQuantity,
      sellCargo,
    ]
  );

  // useEffect for Populating Data and Handling View Changes
  useEffect(() => {
    if (!market || !mode) {
      setTradeItems([]);
      setStatusMessage(null);
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      return;
    }

    let items: TradeItemDisplay[] = [];
    if (mode === "buy") {
      // Use MarketSnapshot's entries() method (which now uses Object.entries)
      items = market
        .entries()
        .map(
          ([key, state]): TradeItemDisplay => ({
            key,
            marketPrice: state.price,
            marketQuantity: state.quantity,
            playerHolding: cargoHold[key] || 0, // Direct access for Record
          })
        )
        .sort((a, b) => a.key.localeCompare(b.key));
    } else if (mode === "sell") {
      // Iterate over player's cargoHold Record
      items = Object.entries(cargoHold)
        .filter(([, holding]) => holding > 0)
        .map(([key, holding]): TradeItemDisplay | null => {
          const marketInfo = market.get(key); // Use MarketSnapshot method
          if (marketInfo && marketInfo.price > 0) {
            return {
              key,
              marketPrice: marketInfo.price,
              marketQuantity: marketInfo.quantity,
              playerHolding: holding,
            };
          }
          return null;
        })
        .filter((item): item is TradeItemDisplay => item !== null)
        .sort((a, b) => a.key.localeCompare(b.key));
    }

    setTradeItems(items);
  }, [gameView, market, cargoHold, mode]); // Dependencies

  // Input Handlers
  const handleItemPrimaryAction = useCallback(
    (key: string) => {
      let quantityToTrade = 0;
      if (mode === "buy") {
        quantityToTrade = 1;
      } else if (mode === "sell") {
        quantityToTrade = cargoHold[key] || 0; // Direct access
      }

      if (quantityToTrade > 0) {
        performTrade(key, quantityToTrade, mode);
      } else {
        if (mode === "sell")
          showMessage("Error: Cannot sell 0 units.", "error");
      }
    },
    [mode, performTrade, cargoHold, showMessage]
  );

  // Return Values
  return {
    mode,
    market,
    tradeItems,
    handleItemPrimaryAction,
    playerCash,
    cargoSpaceLeft,
    statusMessage,
  };
}
