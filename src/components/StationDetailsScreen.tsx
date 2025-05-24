// src/components/StationDetailsScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import { useGameState } from "../hooks/useGameState"; // Use custom hook
import { IStation } from "../game/types"; // Station type, CommodityTable
import {
  getCommodityUnit,
  COMMODITIES,
  MarketSnapshot, // Keep for type hint if needed, but data comes from hook
} from "../game/Market";
import "./Market.css";

interface StationDetailsScreenProps {
  stationId: string | null;
}

const StationDetailsScreen: React.FC<StationDetailsScreenProps> = ({
  stationId,
}) => {
  const {
    gameState,
    findStationById,
    setGameView,
    setNavTarget,
    getOrInitializeStationMarketData, // Use the new helper from useGameState
  } = useGameState();
  const { navTargetStationId, cash, market: currentDockedMarket } = gameState;
  const [station, setStation] = useState<IStation | null>(null);
  // State to hold the market snapshot for the VIEWED station (prices and current quantities)
  const [viewedStationMarket, setViewedStationMarket] =
    useState<MarketSnapshot | null>(null);

  useEffect(() => {
    if (stationId) {
      const foundStation = findStationById(stationId);
      setStation(foundStation);
      if (foundStation) {
        // Get (and initialize if needed) market data for THIS (viewed) station
        // This function now returns a MarketSnapshot with fixed prices and current quantities
        const marketDataSnapshot = getOrInitializeStationMarketData(stationId);
        setViewedStationMarket(marketDataSnapshot);
      } else {
        setViewedStationMarket(null);
      }
    } else {
      setStation(null);
      setViewedStationMarket(null);
    }
  }, [
    stationId,
    findStationById,
    getOrInitializeStationMarketData,
    gameState.knownStationPrices,
    gameState.knownStationQuantities,
  ]); // Depend on known data too

  const handleLogClick = useCallback(() => {
    setGameView("station_log");
  }, [setGameView]);

  const handleToggleNavigate = useCallback(() => {
    if (!station) return;
    const newTargetId = navTargetStationId === station.id ? null : station.id;
    setNavTarget(newTargetId);
  }, [station, navTargetStationId, setNavTarget]);

  if (!stationId) {
    return (
      <div className="market-container info-screen">
        <div className="market-header">
          <div className="market-title">STATION DETAILS</div>
        </div>
        <div className="market-loading">No station selected...</div>
        <div className="station-info-actions">
          <button className="station-info-button" onClick={handleLogClick}>
            BACK TO LOG
          </button>
        </div>
      </div>
    );
  }

  if (!station || !viewedStationMarket) {
    // Also check for viewedStationMarket
    return (
      <div className="market-container info-screen">
        <div className="market-header">
          <div className="market-title">STATION DETAILS</div>
        </div>
        <div className="market-loading">Loading station data...</div>
        <div className="station-info-actions">
          <button className="station-info-button" onClick={handleLogClick}>
            BACK TO LOG
          </button>
        </div>
      </div>
    );
  }

  const coordinates = station.coordinates;
  const isNavigating = navTargetStationId === station.id;

  return (
    <div className="market-container info-screen">
      <div className="market-header">
        <div className="market-title">{station.name}</div>
        <div className="market-credits">{cash.toFixed(1)} CR</div>
      </div>
      <div className="station-info-content">
        <div className="info-item">
          <span className="info-label">Type:</span>
          <span className="info-value">{station.stationType}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Coordinates:</span>
          <span className="info-value">{`(${Math.floor(
            coordinates.x
          )}, ${Math.floor(coordinates.y)})`}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Economy:</span>
          <span className="info-value">{station.economyType}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Technology:</span>
          <span className="info-value">{station.techLevel}</span>
        </div>

        {viewedStationMarket &&
          Object.keys(viewedStationMarket.table).length > 0 && (
            <div className="station-price-list">
              <h3
                className="market-subtitle"
                style={{
                  color: "#ffffff",
                  marginBottom: "10px",
                  borderBottom: "1px solid #888800",
                  paddingBottom: "5px",
                }}
              >
                Commodity Data
              </h3>
              <div
                className="market-table-container"
                style={{ maxHeight: "180px" }}
              >
                <table className="market-table">
                  <thead>
                    <tr>
                      <th>Commodity</th>
                      <th>Unit</th>
                      <th>Price</th>
                      <th>Qty</th>
                      <th>Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMMODITIES.filter(
                      (c) => !!viewedStationMarket.table[c.key]
                    ).map((commodityDef) => {
                      const targetMarketInfo =
                        viewedStationMarket.table[commodityDef.key];
                      if (!targetMarketInfo) return null;

                      const currentDockedMarketInfo =
                        currentDockedMarket?.table[commodityDef.key];
                      let diffText = "-";
                      let diffColor = "#aaaaaa";
                      if (currentDockedMarket && currentDockedMarketInfo) {
                        const diff =
                          targetMarketInfo.price -
                          currentDockedMarketInfo.price;
                        diffText = `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`;
                        if (diff > 0.1) diffColor = "#00FF00";
                        else if (diff < -0.1) diffColor = "#FF5555";
                      } else if (
                        currentDockedMarket &&
                        !currentDockedMarketInfo
                      ) {
                        diffText = "N/A";
                      }
                      const unit = getCommodityUnit(commodityDef.key);
                      return (
                        <tr key={commodityDef.key}>
                          <td>{commodityDef.key}</td>
                          <td>{unit}</td>
                          <td>{targetMarketInfo.price.toFixed(1)}</td>
                          <td
                            style={{ textAlign: "right" }}
                          >{`${targetMarketInfo.quantity}${unit}`}</td>
                          <td
                            style={{ color: diffColor, textAlign: "right" }}
                            title={
                              currentDockedMarket
                                ? `vs Current: ${
                                    currentDockedMarketInfo?.price.toFixed(1) ??
                                    "N/A"
                                  }`
                                : "Not docked"
                            }
                          >
                            {diffText}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        <div className="station-info-actions vertical">
          <button className="station-info-button" onClick={handleLogClick}>
            BACK TO LOG
          </button>
          <button
            className={`station-info-toggle-button ${
              isNavigating ? "active" : ""
            }`}
            onClick={handleToggleNavigate}
          >
            {isNavigating ? "NAV ON" : "NAVIGATE"}
          </button>
        </div>
      </div>
      <div className="market-footer">
        <span>Viewing details for {station.name}.</span>
      </div>
    </div>
  );
};

export default StationDetailsScreen;
