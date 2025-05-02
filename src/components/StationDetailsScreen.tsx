// src/components/StationDetailsScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import { useGameState } from "../hooks/useGameState"; // Use custom hook
import { IStation } from "../game/types"; // Station type
import {
  MarketGenerator,
  MarketSnapshot,
  getCommodityUnit,
  COMMODITIES,
  CommodityTable, // Import COMMODITIES list
} from "../game/Market"; // Market logic
import "./Market.css"; // Reuse Market CSS
import { CommodityState, CommodityTable } from "../game/types"; // Import CommodityState and CommodityTable

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
  const { navTargetStationId, cash, market: currentMarket } = gameState; // Get currentMarket
  const [station, setStation] = useState<IStation | null>(null);
  // State to hold the generated market snapshot for the VIEWED station
  const [stationMarket, setStationMarket] = useState<MarketSnapshot | null>(
    null
  );

  // State to hold temporary price edits
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});

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

        const prices: CommodityTable = {};
        for (const [key, state] of marketData.entries()) {
          prices[key] = state.price;
        }

        // Save prices to game state (which handles localStorage persistence)
        saveStationPrices(stationId, prices);
        // Set local state to display prices for the VIEWED station
        setStationMarket(marketData);
      } else {
        setStation(null);
        setStationMarket(null); // Clear market if station not found
      }
    } else {
      setStation(null); // Clear station if ID is null
      setStationMarket(null); // Clear market if ID is null
    }
    // Dependencies: stationId, findStationById, saveStationPrices
    // Note: Don't add currentMarket here, as it changes frequently and shouldn't trigger re-fetching VIEWED station data
  }, [stationId, findStationById, saveStationPrices]);

  // Effect to initialize editedPrices when stationMarket changes
  useEffect(() => {
    if (stationMarket) {
      const initialPrices: Record<string, number> = {};
      // for (const [key, state] of stationMarket.table.entries()) { // OLD Map
      Object.entries(stationMarket.table).forEach(([key, state]) => { // NEW Record
        initialPrices[key] = state.price;
      });
      setEditedPrices(initialPrices);
    } else {
      setEditedPrices({}); // Clear if no market data
    }
  }, [stationMarket]);

  const handleLogClick = useCallback(() => {
    setGameView("station_log"); // Navigate back to the log
  }, [setGameView]);

  const handleToggleNavigate = useCallback(() => {
    if (!station) return;
    // If this station is already the target, clear it. Otherwise, set it.
    const newTargetId = navTargetStationId === station.id ? null : station.id;
    setNavTarget(newTargetId);
  }, [station, navTargetStationId, setNavTarget]);

  const handlePriceChange = (commodityId: string, value: string) => {
    const price = parseInt(value, 10);
    if (!isNaN(price)) {
      setEditedPrices((prev) => ({
        ...prev,
        [commodityId]: price,
      }));
    }
  };

  const handleSaveChanges = () => {
    if (stationId) {
      // Here we pass the Record<string, number> directly
      saveStationPrices(stationId, editedPrices);
      // Optionally provide user feedback (e.g., toast notification)
      console.log("Prices saved for station:", stationId);
    }
  };

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
        {/* ... (Station Info items remain the same) ... */}
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
            <div
              className="market-table-container"
              style={{ maxHeight: "180px" }} // Increase height slightly if needed
            >
              <table className="market-table">
                <thead>
                  <tr>
                    <th>Commodity</th>
                    <th>Unit</th>
                    <th>Price</th>
                    <th>Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {COMMODITIES.filter(
                    (c) => !!stationMarket.get(c.key) // Ensure the viewed station has the commodity
                  ).map((commodityDef) => {
                    const targetMarketInfo = stationMarket.get(
                      commodityDef.key
                    )!; // We know it exists due to filter
                    const currentMarketInfo = currentMarket?.get(
                      // Get from DOCKED market (might be null)
                      commodityDef.key
                    );

                    let diffText = "-";
                    let diffColor = "#aaaaaa"; // Default grey for difference

                    // Calculate difference ONLY if we are docked somewhere AND that market has the item
                    if (currentMarket && currentMarketInfo) {
                      const diff =
                        targetMarketInfo.price - currentMarketInfo.price;
                      if (!isNaN(diff)) {
                        diffText = `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`;
                        if (diff > 0.1) diffColor = "#00FF00";
                        // Green for profit opportunity (target higher)
                        else if (diff < -0.1) diffColor = "#FF5555"; // Red for loss (target lower)
                      }
                    } else if (currentMarket && !currentMarketInfo) {
                      // Docked, but current station doesn't trade this item
                      diffText = "N/A";
                    }
                    // If not docked (currentMarket is null), diffText remains '-'

                    return (
                      <tr key={commodityDef.key}>
                        <td>{commodityDef.key}</td>
                        <td>{getCommodityUnit(commodityDef.key)}</td>
                        <td>{targetMarketInfo.price.toFixed(1)}</td>
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

        {/* Market Data Section */}
        <div className="mt-4 p-4 bg-gray-700 rounded">
          <h3 className="text-lg font-semibold mb-2">Market Data (Known Prices)</h3>
          {/* Check size using Object.keys */}
          {stationMarket && Object.keys(stationMarket.table).length > 0 ? (
            <div>
              <table className="w-full text-left table-auto">
                <thead>
                  <tr>
                    <th className="px-4 py-2">Commodity</th>
                    <th className="px-4 py-2">Known Price</th>
                    <th className="px-4 py-2">Edit Price</th>
                    {/* Add more columns if needed (e.g., Supply/Demand) */}
                  </tr>
                </thead>
                <tbody>
                  {/* Iterate using Object.entries */}
                  {Object.entries(stationMarket.table).map(([key, state]) => (
                    <tr key={key} className="border-t border-gray-600">
                      <td className="px-4 py-2">{key}</td>
                      <td className="px-4 py-2">{state.price} Cr</td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={editedPrices[key] ?? ""}
                          onChange={(e) => handlePriceChange(key, e.target.value)}
                          className="bg-gray-800 border border-gray-600 rounded px-2 py-1 w-24"
                        />
                      </td>
                      {/* Display supply/demand if available: <td className="px-4 py-2">{state.supply}</td> */}
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={handleSaveChanges}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition duration-150"
              >
                Save Price Changes
              </button>
            </div>
          ) : (
            <p>No known market data for this station.</p>
          )}
        </div>

        {/* ... (Action Buttons Area remains the same) ... */}
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
