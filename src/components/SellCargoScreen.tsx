// src/components/SellCargoScreen.tsx:
import React from "react";
import { useTradeCargoLogic } from "../hooks/useTradeCargoLogic";
import { getCommodityUnit } from "../game/Market";
import "./Market.css"; // Shared Market CSS
import { useGameState } from "../hooks/useGameState";

const SellCargoScreen: React.FC = () => {
  const {
    tradeItems,
    handleSellOne,
    handleSellAllOfItemType,
    handleSellAllPlayerCargo,
    playerCash,
    statusMessage,
  } = useTradeCargoLogic("sell");

  const { setGameView, setViewTargetCommodityKey } = useGameState();

  const handleViewCommodityStations = (commodityKey: string) => {
    setViewTargetCommodityKey(commodityKey);
    setGameView("commodity_stations_list");
  };

  return (
    <div className="market-container sell-screen">
      <div className="market-header">
        <div className="market-title">SELL CARGO</div>
        <div className="market-credits">{playerCash.toFixed(1)} CR</div>
      </div>
      <div className="market-instructions">
        Click item row to see stations trading it. Use buttons to sell.
      </div>
      <div className="market-table-container">
        <table className="market-table">
          <thead>
            <tr>
              <th>PRODUCT</th>
              <th>UNIT</th>
              <th>SELL PRICE</th>
              <th>IN HOLD</th>
              {/* ACTIONS header removed */}
            </tr>
          </thead>
          <tbody>
            {tradeItems.map(({ key, playerHolding, marketPrice }) => {
              const unit = getCommodityUnit(key);
              const stationBuysItem = marketPrice > 0;
              const playerHasOne = playerHolding >= 1;
              const playerHasAny = playerHolding > 0;

              return (
                <React.Fragment key={`${key}-fragment`}>
                  <tr
                    key={`${key}-info`}
                    className="commodity-info-row"
                    onClick={() => handleViewCommodityStations(key)}
                  >
                    <td className="product-name-cell">{key}</td>
                    <td>{unit}</td>
                    <td>{marketPrice > 0 ? marketPrice.toFixed(1) : "-"}</td>
                    <td>
                      {playerHolding}
                      {unit}
                    </td>
                  </tr>
                  <tr key={`${key}-actions`} className="commodity-actions-row">
                    <td colSpan={4}>
                      {" "}
                      {/* Spans all 4 original data columns */}
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
                      <button
                        className="market-action-button sell"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSellAllOfItemType(key);
                        }}
                        disabled={!playerHasAny || !stationBuysItem}
                        title={
                          !playerHasAny
                            ? "You don't have this item"
                            : !stationBuysItem
                            ? "Station doesn't buy this"
                            : `Sell all ${playerHolding}${unit} for ${(
                                marketPrice * playerHolding
                              ).toFixed(1)} CR`
                        }
                      >
                        SELL ALL
                      </button>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
            {tradeItems.length === 0 && (
              <tr>
                <td
                  colSpan={4} /* Adjusted colspan */
                  style={{
                    textAlign: "center",
                    fontStyle: "italic",
                    color: "#aaaaaa",
                  }}
                >
                  Cargo hold empty or station buys nothing you hold.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="market-footer">
        <button
          className="global-market-action-button sell-all"
          onClick={handleSellAllPlayerCargo}
          disabled={tradeItems.length === 0}
          title={
            tradeItems.length === 0
              ? "Nothing to sell to this station"
              : "Sell all eligible cargo"
          }
        >
          SELL ALL CARGO
        </button>
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

export default SellCargoScreen;
