// src/components/StationDetailsScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import { useGameState } from "../hooks/useGameState"; // Use custom hook
import { IStation } from "../game/types"; // Station type
import {
  MarketGenerator,
  MarketSnapshot,
  getCommodityUnit,
  COMMODITIES, // Import COMMODITIES list
} from "../game/Market"; // Market logic
import "./Market.css"; // Reuse Market CSS

// Simple world seed for market generation (can be moved to config)
const WORLD_SEED = 12345;

interface StationDetailsScreenProps {
  stationId: string | null; // ID of the station to display
}

const StationDetailsScreen: React.FC<StationDetailsScreenProps> = ({
  stationId,
}) => {
  const {
    gameState,
    findStationById,
    setGameView,
    setNavTarget,
    saveStationPrices,
  } = useGameState();
  const { navTargetStationId, cash } = gameState;
  const [station, setStation] = useState<IStation | null>(null);

  useEffect(() => {
    // Fetch station data when the stationId prop changes
    if (stationId) {
      const foundStation = findStationById(stationId);
      if (foundStation) {
        setStation(foundStation);

        // Generate market data for this station
        const marketData = MarketGenerator.generate(
          foundStation,
          WORLD_SEED,
          Date.now()
        );

        // Extract prices into a Map<string, number>
        const prices = new Map<string, number>();
        for (const [key, state] of marketData.entries()) {
          prices.set(key, state.price);
        }

        // Save prices to game state (which handles localStorage persistence)
        saveStationPrices(stationId, prices);
        // Set local state to display prices
        setStationMarket(marketData);
      } else {
        setStation(null);
        setStationMarket(null); // Clear market if station not found
      }
    } else {
      setStation(null); // Clear station if ID is null
      setStationMarket(null); // Clear market if ID is null
    }
  }, [stationId, findStationById, saveStationPrices]); // Add saveStationPrices to dependencies

  const handleLogClick = useCallback(() => {
    setGameView("station_log"); // Navigate back to the log
  }, [setGameView]);

  const handleToggleNavigate = useCallback(() => {
    if (!station) return;
    // If this station is already the target, clear it. Otherwise, set it.
    const newTargetId = navTargetStationId === station.id ? null : station.id;
    setNavTarget(newTargetId);
  }, [station, navTargetStationId, setNavTarget]);

  // State to hold the generated market snapshot for display
  const [stationMarket, setStationMarket] = useState<MarketSnapshot | null>(
    null
  );

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
      {" "}
      {/* Use info-screen class for styling */}
      <div className="market-header">
        <div className="market-title">{station.name}</div>
        <div className="market-credits">{cash.toFixed(1)} CR</div>
      </div>
      <div className="station-info-content">
        <div className="info-item">
          <span className="info-label">ID:</span>
          <span className="info-value">{station.id}</span>
        </div>
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
        <div className="info-item">
          <span className="info-label">Rotation:</span>
          <span className="info-value">
            {station.rotationSpeed.toFixed(2)} rad/s
          </span>
        </div>

        {/* --- Commodity Price List --- */}
        {stationMarket && stationMarket.table.size > 0 && (
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
              Commodity Prices
            </h3>
            {/* Reuse market table structure */}
            <div
              className="market-table-container"
              style={{ maxHeight: "150px" }}
            >
              {" "}
              {/* Limit height */}
              <table className="market-table">
                <thead>
                  <tr>
                    <th>Commodity</th>
                    <th>Unit</th>
                    <th>Price (CR)</th>
                    {/* Hide 4th column */}
                    <th style={{ display: "none" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {COMMODITIES.filter((c) => stationMarket.get(c.key)).map(
                    (commodityDef) => {
                      const marketState = stationMarket.get(commodityDef.key);
                      return (
                        <tr key={commodityDef.key}>
                          <td>{commodityDef.key}</td>
                          <td>{getCommodityUnit(commodityDef.key)}</td>
                          <td>
                            {marketState ? marketState.price.toFixed(1) : "-"}
                          </td>
                          <td style={{ display: "none" }}></td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Add more details as needed */}

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
      {/* Footer can be used for status or general info */}
      <div className="market-footer">
        <span>Viewing details for {station.name}.</span>
      </div>
    </div>
  );
};

export default StationDetailsScreen;
