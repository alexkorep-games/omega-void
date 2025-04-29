// src/components/SellCargoScreen.tsx
import React from "react";
import { useTradeCargoLogic } from "../hooks/useTradeCargoLogic"; // Adapted hook path
import { getCommodityUnit } from "../game/Market"; // Adapted path
import "./Market.css"; // Shared Market CSS

const SellCargoScreen: React.FC = () => {
  const {
    tradeItems,
    handleItemPrimaryAction,
    quantityInput,
    isEnteringQuantity,
    playerCash,
    statusMessage,
    isProcessingInput, // Use this to disable interaction during debounce
  } = useTradeCargoLogic("sell");

  return (
    <div className="market-container sell-screen">
      <div className="market-header">
        <div className="market-title">SELL CARGO</div>
        <div className="market-credits">{playerCash.toFixed(1)} CR</div>
      </div>
      <div className="market-instructions">
        Click item to SELL ALL held units. 'S' key for partial sell.
        <br />
        'B' key to switch to Buy screen. ESC to exit.
      </div>
      <div className="market-table-container">
        <table className="market-table">
          <thead>
            <tr>
              <th>PRODUCT</th>
              <th>UNIT</th>
              <th>SELL PRICE</th>
              <th>IN HOLD</th>
            </tr>
          </thead>
          <tbody>
            {tradeItems.map(({ key, playerHolding, marketPrice }) => {
              const unit = getCommodityUnit(key);
              return (
                <tr
                  key={key}
                  onClick={() =>
                    !isProcessingInput && handleItemPrimaryAction(key)
                  } // Prevent clicks during debounce
                >
                  <td>{key}</td>
                  <td>{unit}</td>
                  <td>{marketPrice > 0 ? marketPrice.toFixed(1) : "-"}</td>
                  <td>
                    {playerHolding}
                    {unit}
                  </td>
                </tr>
              );
            })}
            {tradeItems.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    textAlign: "center",
                    fontStyle: "italic",
                    color: "#aaaaaa",
                  }}
                >
                  Cargo hold empty
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="market-footer">
        {/* Removed 'Selected:' display */}
        {isEnteringQuantity && (
          <div className="quantity-prompt">
            Quantity? <span className="quantity-input">{quantityInput}</span>
            <span className="quantity-hint">
              (ESC to cancel, ENTER to sell)
            </span>
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

export default SellCargoScreen;
