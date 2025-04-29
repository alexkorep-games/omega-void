// src/components/TradeScreen.tsx
import React from "react";
import { useGameState } from "../hooks/useGameState"; // Import useGameState
import "./TradeScreen.css"; // We'll create this CSS file next

const TradeScreen: React.FC = () => {
  // Get the function to change the game view
  const { setGameView, gameState } = useGameState();

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
      </div>
      <div className="market-footer">
        <span>Select an option.</span>
      </div>
    </div>
  );
};

export default TradeScreen;
