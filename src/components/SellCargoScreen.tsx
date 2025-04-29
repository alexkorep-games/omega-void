// src/components/SellCargoScreen.tsx
import React from "react";
import { useSellCargoLogic } from "../hooks/useSellCargoLogic"; // Adapted hook path
import { getCommodityUnit } from "../game/Market"; // Adapted path
import "./Market.css"; // Shared Market CSS

const SellCargoScreen: React.FC = () => {
  const {
    cargoToSell, // Get items directly from the hook
    handleItemClick, // Sell all on click
    selectedCommodityKey,
    quantityInput,
    isEnteringQuantity,
    playerCash,
    statusMessage,
    isProcessingInput, // Use this to disable interaction during debounce
  } = useSellCargoLogic();

  return (
    <div className="market-container sell-screen">
      <div className="market-header">
        <div className="market-title">SELL CARGO</div>
        <div className="market-credits">{playerCash.toFixed(1)} CR</div>
      </div>
      <div className="market-instructions">
        Arrow keys/Click to select. ENTER to sell all. S for partial sell.
        <br />B switch to Buy. ESC exit.
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
            {cargoToSell.map(({ key, holding, sellPrice }) => {
              const unit = getCommodityUnit(key);
              return (
                <tr
                  key={key}
                  className={key === selectedCommodityKey ? "selected" : ""}
                  onClick={() => !isProcessingInput && handleItemClick(key)} // Prevent clicks during debounce
                >
                  <td>{key}</td>
                  <td>{unit}</td>
                  <td>{sellPrice > 0 ? sellPrice.toFixed(1) : "-"}</td>
                  <td>
                    {holding}
                    {unit}
                  </td>
                </tr>
              );
            })}
            {cargoToSell.length === 0 && (
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
        <span>Selected: {selectedCommodityKey ?? "None"}</span>
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
