import React from "react";
import { useTradeCargoLogic } from "../hooks/useTradeCargoLogic";
import { getCommodityUnit, getTonnesPerUnit } from "../game/Market";
import "./Market.css"; // Shared Market CSS
import { useGameState } from "../hooks/useGameState"; // For navigation

const BuyCargoScreen: React.FC = () => {
  const {
    market,
    tradeItems,
    handleBuyOne, // New handler
    handleSellOne, // New handler
    cargoSpaceLeft,
    playerCash,
    statusMessage,
  } = useTradeCargoLogic("buy");

  const { setGameView, setViewTargetCommodityKey } = useGameState();

  const handleViewCommodityStations = (commodityKey: string) => {
    setViewTargetCommodityKey(commodityKey);
    setGameView("commodity_stations_list");
  };

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
        Click item row to see stations trading it. Use buttons to trade.
      </div>
      <div className="market-table-container">
        <table className="market-table">
          <thead>
            <tr>
              <th>PRODUCT</th>
              <th>UNIT</th>
              <th>PRICE</th>
              <th>AVAIL</th>
              <th>HELD</th>
              <th className="market-actions-header-cell">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {tradeItems.map(
              ({ key, marketPrice, marketQuantity, playerHolding }) => {
                const unit = getCommodityUnit(key);
                const canAffordOne = playerCash >= marketPrice;
                const hasSpaceForOne =
                  cargoSpaceLeft >= 1 * getTonnesPerUnit(key);
                const stationHasOne = marketQuantity >= 1;
                const playerHasOne = playerHolding >= 1;
                const stationBuysItem = marketPrice > 0; // Assuming price > 0 means station trades it

                return (
                  <tr
                    key={key}
                    onClick={() => handleViewCommodityStations(key)}
                  >
                    <td>{key}</td>
                    <td>{unit}</td>
                    <td>{marketPrice.toFixed(1)}</td>
                    <td>
                      {marketQuantity > 0 ? `${marketQuantity}${unit}` : "-"}
                    </td>
                    <td>
                      {playerHolding > 0 ? `${playerHolding}${unit}` : "-"}
                    </td>
                    <td className="market-actions-cell">
                      <button
                        className="market-action-button buy"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBuyOne(key);
                        }}
                        disabled={
                          !canAffordOne || !hasSpaceForOne || !stationHasOne
                        }
                        title={
                          !canAffordOne
                            ? "Insufficient credits"
                            : !hasSpaceForOne
                            ? "Insufficient cargo space"
                            : !stationHasOne
                            ? "Station out of stock"
                            : `Buy 1 ${unit} for ${marketPrice.toFixed(1)} CR`
                        }
                      >
                        BUY (1)
                      </button>
                      <button
                        className="market-action-button sell"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSellOne(key);
                        }}
                        disabled={!playerHasOne || !stationBuysItem}
                        title={
                          !playerHasOne
                            ? "You don't have this item"
                            : !stationBuysItem
                            ? "Station doesn't buy this"
                            : `Sell 1 ${unit} for ${marketPrice.toFixed(1)} CR`
                        }
                      >
                        SELL (1)
                      </button>
                    </td>
                  </tr>
                );
              }
            )}
            {tradeItems.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "#888" }}>
                  No commodities available to buy at this station.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="market-footer">
        <span style={{ color: "#00FF00" }}>
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
