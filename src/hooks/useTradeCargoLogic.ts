// src/hooks/useTradeCargoLogic.ts:
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useGameState } from "./useGameState";
import { getTonnesPerUnit, getCommodityUnit } from "../game/Market";
import { CargoHold } from "../game/types";

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
    updatePlayerState,
    updateMarketQuantity,
    totalCargoCapacity,
  } = useGameState();
  const { market, cash: playerCash, cargoHold, gameView } = gameState;

  const [tradeItems, setTradeItems] = useState<TradeItemDisplay[]>([]);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  );
  const messageTimeoutRef = useRef<number | null>(null);

  const cargoSpaceLeft = useMemo(() => {
    let used = 0;
    Object.entries(cargoHold).forEach(([key, quantity]) => {
      used += quantity * getTonnesPerUnit(key);
    });
    return Math.max(0, totalCargoCapacity - used);
  }, [cargoHold, totalCargoCapacity]);

  const showMessage = useCallback(
    (text: string, type: StatusMessage["type"]) => {
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      setStatusMessage({ text, type, timestamp: Date.now() });
      messageTimeoutRef.current = window.setTimeout(
        () => setStatusMessage(null),
        MESSAGE_DURATION
      );
    },
    []
  );

  const performTrade = useCallback(
    (key: string, quantity: number, currentTradeMode: TradeMode): boolean => {
      if (!market || quantity <= 0) return false;
      const marketInfo = market.get(key);
      const playerHolding = cargoHold[key] || 0;

      if (!marketInfo) {
        showMessage("Error: Item not traded at this station.", "error");
        return false;
      }
      const unit = getCommodityUnit(key);

      if (currentTradeMode === "buy") {
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

        updatePlayerState((prevState) => {
          const updatedCargoHold: CargoHold = { ...prevState.cargoHold };
          updatedCargoHold[key] = (updatedCargoHold[key] || 0) + quantity;
          return { cash: prevState.cash - cost, cargoHold: updatedCargoHold };
        });
        updateMarketQuantity(key, -quantity);
        showMessage(`Bought ${quantity}${unit} ${key}.`, "success");
      } else if (currentTradeMode === "sell") {
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
        updatePlayerState((prevState) => {
          const updatedCargoHold: CargoHold = { ...prevState.cargoHold };
          const newQty = (updatedCargoHold[key] || 0) - quantity;
          if (newQty <= 0) delete updatedCargoHold[key];
          else updatedCargoHold[key] = newQty;
          return {
            cash: prevState.cash + earnings,
            cargoHold: updatedCargoHold,
          };
        });
        updateMarketQuantity(key, +quantity);
        showMessage(`Sold ${quantity}${unit} ${key}.`, "success");
      } else {
        console.error("Invalid trade mode:", currentTradeMode);
        return false;
      }
      return true;
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

  useEffect(() => {
    if (!market || !mode) {
      setTradeItems([]);
      setStatusMessage(null);
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      return;
    }
    let items: TradeItemDisplay[] = [];
    if (mode === "buy") {
      items = market
        .entries()
        .map(
          ([key, state]): TradeItemDisplay => ({
            key,
            marketPrice: state.price,
            marketQuantity: state.quantity,
            playerHolding: cargoHold[key] || 0,
          })
        )
        .sort((a, b) => a.key.localeCompare(b.key));
    } else if (mode === "sell") {
      items = Object.entries(cargoHold)
        .filter(([, holding]) => holding > 0)
        .map(([key, holding]): TradeItemDisplay | null => {
          const marketInfo = market.get(key);
          if (marketInfo && marketInfo.price > 0) {
            // Only list if station buys it
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
  }, [gameView, market, cargoHold, mode]);

  const handleBuyOne = useCallback(
    (key: string) => {
      performTrade(key, 1, "buy");
    },
    [performTrade]
  );

  const handleSellOne = useCallback(
    (key: string) => {
      performTrade(key, 1, "sell");
    },
    [performTrade]
  );

  const handleSellAllOfItemType = useCallback(
    (key: string) => {
      const quantityToSell = cargoHold[key] || 0;
      if (quantityToSell > 0) {
        performTrade(key, quantityToSell, "sell");
      } else {
        showMessage("Error: You do not hold this item.", "error");
      }
    },
    [performTrade, cargoHold, showMessage]
  );

  const handleSellAllPlayerCargo = useCallback(() => {
    if (!market) return;
    let itemsSoldCount = 0;
    let totalEarnings = 0;
    // Iterate over a snapshot of cargoHold keys to avoid issues if performTrade modifies it mid-loop (it shouldn't directly but good practice)
    const itemsToConsider = Object.keys(cargoHold);

    itemsToConsider.forEach((key) => {
      const playerHolding = cargoHold[key] || 0;
      if (playerHolding > 0) {
        const marketInfo = market.get(key);
        if (marketInfo && marketInfo.price > 0) {
          if (performTrade(key, playerHolding, "sell")) {
            itemsSoldCount++;
            totalEarnings += playerHolding * marketInfo.price;
          }
        }
      }
    });

    if (itemsSoldCount > 0) {
      showMessage(
        `Sold ${itemsSoldCount} types of cargo for ${totalEarnings.toFixed(
          1
        )} CR.`,
        "success"
      );
    } else {
      showMessage("No eligible cargo to sell to this station.", "info");
    }
  }, [performTrade, cargoHold, market, showMessage]);

  return {
    mode,
    market,
    tradeItems,
    handleBuyOne,
    handleSellOne,
    handleSellAllOfItemType,
    handleSellAllPlayerCargo,
    playerCash,
    cargoSpaceLeft,
    statusMessage,
  };
}
