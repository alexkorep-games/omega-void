// src/components/TradeScreen.tsx
import React, { useCallback } from "react";
import { useGameState } from "../hooks/useGameState"; // Import useGameState
// import { showMessage } from "../utils/message"; // Import message utility if needed
import "./TradeScreen.css";

const TradeScreen: React.FC = () => {
  // Get the function to change the game view
  const { setGameView, gameState, updatePlayerState } = useGameState();
  const { cash, player } = gameState;
  const shieldLevel = player?.shieldLevel ?? 0; // Default to 0 if player undefined (shouldn't happen)

  const shieldToReplenish = Math.max(0, 100 - shieldLevel); // Ensure non-negative
  const replenishCost = shieldToReplenish * 1; // 1 CR per 1%
  const canAffordReplenish = cash >= replenishCost;
  const needsReplenish = shieldLevel < 100;

  const handleReplenishShields = useCallback(() => {
    if (!needsReplenish || !canAffordReplenish || replenishCost <= 0) return;

    updatePlayerState((prev) => ({
      cash: prev.cash - replenishCost,
      player: {
        ...prev.player, // Spread previous player state
        shieldLevel: 100, // Set shield to full
      } as any, // Type assertion might be needed depending on updatePlayerState signature
    }));
    // Consider using the status message system from useTradeCargoLogic here
    // showMessage(`Shields replenished for ${replenishCost} CR.`, 'success');
    console.log(`Shields replenished for ${replenishCost.toFixed(1)} CR.`);
  }, [needsReplenish, canAffordReplenish, replenishCost, updatePlayerState]);

  const replenishButtonDisabled =
    !needsReplenish || !canAffordReplenish || replenishCost <= 0;
  const replenishButtonTitle = !needsReplenish
    ? "Shields already full"
    : !canAffordReplenish
    ? `Need ${replenishCost.toFixed(1)} CR`
    : replenishCost <= 0
    ? "Shields already full"
    : `Replenish ${shieldToReplenish.toFixed(0)}% for ${replenishCost.toFixed(
        1
      )} CR`;

  return (
    // Use a container similar to market screens for consistency
    <div className="market-container trade-select-screen">
      <div className="market-header">
        <div className="market-title">TRADE OPTIONS</div>
        <div className="market-credits">{gameState.cash.toFixed(1)} CR</div>
      </div>

      <div className="trade-select-content">
        <button
          className="trade-select-button buy-button"
          onClick={() => setGameView("buy_cargo")}
        >
          BUY CARGO
        </button>
        <button
          className="trade-select-button sell-button"
          onClick={() => setGameView("sell_cargo")}
        >
          SELL CARGO
        </button>
        <button
          className={`trade-select-button replenish-button ${
            replenishButtonDisabled ? "disabled" : ""
          }`}
          onClick={handleReplenishShields}
          disabled={replenishButtonDisabled}
          title={replenishButtonTitle}
        >
          REPLENISH SHIELDS ({replenishCost.toFixed(1)} CR)
        </button>
      </div>
      <div className="market-footer">
        <span>Select an option.</span>
      </div>
    </div>
  );
};

export default TradeScreen;
