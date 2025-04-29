// src/components/BuyCargoScreen.tsx
import React from "react";
import { useBuyCargoLogic } from "../hooks/useBuyCargoLogic"; // Adapted hook path
import { getCommodityUnit } from "../game/Market"; // Adapted path
import "./Market.css"; // Shared Market CSS

const BuyCargoScreen: React.FC = () => {
  const {
    market,
    cargoItems, // Use cargoItems from hook (includes price/qty from market)
    handleItemClick, // Buy one unit on click
    selectedCommodityKey,
    quantityInput,
    isEnteringQuantity,
    cargoSpaceLeft,
    playerCash, // Get cash directly from hook
    statusMessage, // Get status message
    isProcessingInput, // Use this to disable interaction during debounce
  } = useBuyCargoLogic();

  if (!market) {
    return (
      <div className="market-container buy-screen">
        <div className="market-title">BUY CARGO</div>
        <div className="market-loading">Market data unavailable...</div>
      </div>
    );
  }

  return (
    <div className="market-container buy-screen">
      <div className="market-header">
        <div className="market-title">BUY CARGO</div>
        <div className="market-credits">{playerCash.toFixed(1)} CR</div>
      </div>
      <div className="market-instructions">
        Arrow keys/Click to select. ENTER to buy 1. B for multiple.
        <br />S switch to Sell. ESC exit.
      </div>
      <div className="market-table-container">
        <table className="market-table">
          <thead>
            <tr>
              <th>PRODUCT</th>
              <th>UNIT</th>
              <th>PRICE</th>
              <th>QTY</th>
            </tr>
          </thead>
          <tbody>
            {cargoItems.map(({ key, price, quantity }) => (
              <tr
                key={key}
                className={key === selectedCommodityKey ? "selected" : ""}
                onClick={() => !isProcessingInput && handleItemClick(key)} // Prevent clicks during debounce
              >
                <td>{key}</td>
                <td>{getCommodityUnit(key)}</td>
                <td>{price.toFixed(1)}</td>
                <td>
                  {quantity > 0 ? `${quantity}${getCommodityUnit(key)}` : "-"}
                </td>
              </tr>
            ))}
            {cargoItems.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "#888" }}>
                  No commodities available to buy at this station.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="market-footer">
        <span style={{ color: "#00FF00" /* Green */ }}>
          Cargo Space: {cargoSpaceLeft.toFixed(3)}t
        </span>
        {isEnteringQuantity && (
          <div className="quantity-prompt">
            Quantity? <span className="quantity-input">{quantityInput}</span>
            <span className="quantity-hint">(ESC to cancel, ENTER to buy)</span>
          </div>
        )}
        {!isEnteringQuantity && statusMessage && (
          <div
            className="status-message"
            style={{
              color: statusMessage.type === "error" ? "#FF5555" : "#FFFF00",
            }}
          >
            {statusMessage.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyCargoScreen;
