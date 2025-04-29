// src/components/BuyCargoScreen.tsx
import React from "react";
import { useTradeCargoLogic } from "../hooks/useTradeCargoLogic"; // Adapted hook path
import { getCommodityUnit } from "../game/Market"; // Adapted path
import "./Market.css"; // Shared Market CSS

const BuyCargoScreen: React.FC = () => {
  const {
    market,
    tradeItems, // Use cargoItems from hook (includes price/qty from market)
    handleItemPrimaryAction, // Buy one unit on click
    cargoSpaceLeft,
    playerCash, // Get cash directly from hook
    statusMessage, // Get status message
  } = useTradeCargoLogic("buy");

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
        Click item to BUY 1 unit. 'B' key for multiple.
        <br />
        'S' key to switch to Sell screen. ESC to exit.
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
            {tradeItems.map(({ key, marketPrice, marketQuantity }) => (
              <tr
                key={key}
                onClick={() => handleItemPrimaryAction(key)} // Prevent clicks during debounce
              >
                <td>{key}</td>
                <td>{getCommodityUnit(key)}</td>
                <td>{marketPrice.toFixed(1)}</td>
                <td>
                  {marketQuantity > 0
                    ? `${marketQuantity}${getCommodityUnit(key)}`
                    : "-"}
                </td>
              </tr>
            ))}
            {tradeItems.length === 0 && (
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
        {statusMessage && (
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
