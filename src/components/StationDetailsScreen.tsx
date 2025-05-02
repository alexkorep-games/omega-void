// src/components/StationDetailsScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import { useGameState } from "../hooks/useGameState"; // Use custom hook
import { IStation } from "../game/types"; // Station type
import {
  MarketGenerator,
  MarketSnapshot,
  getCommodityUnit,
  COMMODITIES,
} from "../game/Market"; // Market logic - DO NOT import CommodityTable from here
import "./Market.css"; // Reuse Market CSS

// Simple world seed for market generation (can be moved to config)
const WORLD_SEED = 12345;

interface StationDetailsScreenProps {
  stationId: string | null; // ID of the station to display
}

const StationDetailsScreen: React.FC<StationDetailsScreenProps> = ({
  stationId,
}) => {
  const { gameState, findStationById, setGameView, setNavTarget } =
    useGameState();
  const { navTargetStationId, cash, market: currentMarket } = gameState; // Get currentMarket (docked market)
  const [station, setStation] = useState<IStation | null>(null);
  // State to hold the generated market snapshot for the VIEWED station
  const [stationMarket, setStationMarket] = useState<MarketSnapshot | null>(
    null
  );

  useEffect(() => {
    // Fetch station data when the stationId prop changes
    if (stationId) {
      const foundStation = findStationById(stationId);
      if (foundStation) {
        setStation(foundStation);

        // Generate market data for THIS (viewed) station
        const marketData = MarketGenerator.generate(
          foundStation,
          WORLD_SEED,
          Date.now()
        );
        // Set local state to display prices/qty for the VIEWED station
        setStationMarket(marketData);
      } else {
        setStation(null);
        setStationMarket(null); // Clear market if station not found
      }
    } else {
      setStation(null); // Clear station if ID is null
      setStationMarket(null); // Clear market if ID is null
    }
  }, [stationId, findStationById, gameState.knownStationPrices]); // Add gameState.knownStationPrices dependency

  const handleLogClick = useCallback(() => {
    setGameView("station_log"); // Navigate back to the log
  }, [setGameView]);

  const handleToggleNavigate = useCallback(() => {
    if (!station) return;
    const newTargetId = navTargetStationId === station.id ? null : station.id;
    setNavTarget(newTargetId);
  }, [station, navTargetStationId, setNavTarget]);

  // --- Loading / Error States ---
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

  if (!station) {
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
      {/* Use info-screen class for styling */}
      <div className="market-header">
        <div className="market-title">{station.name}</div>
        <div className="market-credits">{cash.toFixed(1)} CR</div>
      </div>
      <div className="station-info-content">
        {/* Station Info items */}
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

        {/* --- Commodity Price List (Generated/Live) --- */}
        {/* Check if stationMarket and its table exist and have keys */}
        {stationMarket && Object.keys(stationMarket.table).length > 0 && (
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
              Commodity Data (Live)
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
                    <th>Qty</th> {/* Added Qty column */}
                    <th>Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Filter COMMODITIES to only those present in stationMarket.table */}
                  {COMMODITIES.filter(
                    (c) => !!stationMarket.table[c.key] // Check existence in the Record
                  ).map((commodityDef) => {
                    const targetMarketInfo =
                      stationMarket.table[commodityDef.key]; // Get state from the Record
                    if (!targetMarketInfo) return null; // Should not happen due to filter, but safety check

                    // Get info from the DOCKED market (might be null or lack the commodity)
                    const currentMarketInfo =
                      currentMarket?.table[commodityDef.key];

                    let diffText = "-";
                    let diffColor = "#aaaaaa"; // Default grey for difference

                    if (currentMarket && currentMarketInfo) {
                      const diff =
                        targetMarketInfo.price - currentMarketInfo.price;
                      diffText = `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`;
                      if (diff > 0.1) diffColor = "#00FF00";
                      else if (diff < -0.1) diffColor = "#FF5555";
                    } else if (currentMarket && !currentMarketInfo) {
                      diffText = "N/A";
                    }

                    const unit = getCommodityUnit(commodityDef.key);

                    return (
                      <tr key={commodityDef.key}>
                        <td>{commodityDef.key}</td>
                        <td>{unit}</td>
                        <td>{targetMarketInfo.price.toFixed(1)}</td>
                        {/* Display Quantity */}
                        <td style={{ textAlign: "right" }}>
                          {`${targetMarketInfo.quantity}${unit}`}
                        </td>
                        <td
                          style={{ color: diffColor, textAlign: "right" }}
                          title={
                            currentMarket
                              ? `vs Current: ${
                                  currentMarketInfo?.price.toFixed(1) ?? "N/A"
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

        {/* Action Buttons Area */}
        <div className="station-info-actions">
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
      {/* Footer */}
      <div className="market-footer">
        <span>Viewing details for {station.name}.</span>
      </div>
    </div>
  );
};

export default StationDetailsScreen;
