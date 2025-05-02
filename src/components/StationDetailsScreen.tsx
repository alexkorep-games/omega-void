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
  const {
    gameState,
    findStationById,
    setGameView,
    setNavTarget,
    saveStationPrices,
  } = useGameState();
  const { navTargetStationId, cash, market: currentMarket } = gameState; // Get currentMarket (docked market)
  const [station, setStation] = useState<IStation | null>(null);
  // State to hold the generated market snapshot for the VIEWED station
  const [stationMarket, setStationMarket] = useState<MarketSnapshot | null>(
    null
  );

  // State to hold temporary price edits for the VIEWED station
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
        // Set local state to display prices/qty for the VIEWED station
        setStationMarket(marketData);

        // Get existing known prices or initialize from generated market
        const existingKnownPrices = gameState.knownStationPrices[stationId];
        if (existingKnownPrices) {
          setEditedPrices(existingKnownPrices); // Load known prices for editing
        } else {
          // Initialize editedPrices from the generated market if no known prices exist
          const initialPrices: Record<string, number> = {};
          // Iterate over generated market table (which is now a Record)
          Object.entries(marketData.table).forEach(([key, state]) => {
            initialPrices[key] = state.price;
          });
          setEditedPrices(initialPrices);
          // Optionally save these initial prices immediately
          // saveStationPrices(stationId, initialPrices);
        }
      } else {
        setStation(null);
        setStationMarket(null); // Clear market if station not found
        setEditedPrices({});
      }
    } else {
      setStation(null); // Clear station if ID is null
      setStationMarket(null); // Clear market if ID is null
      setEditedPrices({});
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

  const handlePriceChange = (commodityId: string, value: string) => {
    // Allow empty string to clear value, parse only if not empty
    if (value === "") {
      setEditedPrices((prev) => {
        const next = { ...prev };
        // You might want to decide if deleting the key or setting to NaN/null is better
        delete next[commodityId]; // Example: remove key if empty
        // or: next[commodityId] = NaN;
        return next;
      });
    } else {
      const price = parseFloat(value); // Use parseFloat for decimals
      if (!isNaN(price) && price >= 0) {
        // Check for valid, non-negative number
        setEditedPrices((prev) => ({
          ...prev,
          [commodityId]: price,
        }));
      }
    }
  };

  const handleSaveChanges = () => {
    if (stationId) {
      // Filter out any potential NaN values before saving
      const cleanPrices: Record<string, number> = {};
      Object.entries(editedPrices).forEach(([key, value]) => {
        if (!isNaN(value) && value !== null && value !== undefined) {
          cleanPrices[key] = value;
        }
      });
      saveStationPrices(stationId, cleanPrices);
      alert("Prices saved for station: " + stationId); // Simple feedback
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

        {/* Known Prices Editing Section */}
        <div className="station-price-list" style={{ marginTop: "25px" }}>
          <h3
            className="market-subtitle"
            style={{
              color: "#ffffff",
              marginBottom: "10px",
              borderBottom: "1px solid #888800",
              paddingBottom: "5px",
            }}
          >
            Known Prices (Log)
          </h3>
          {/* Check if editedPrices has keys */}
          {Object.keys(editedPrices).length > 0 ? (
            <div>
              <table className="w-full text-left table-auto market-table">
                <thead>
                  <tr>
                    <th className="px-4 py-2">Commodity</th>
                    <th className="px-4 py-2">Known Price</th>
                    <th className="px-4 py-2">Edit Price</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Iterate using Object.entries */}
                  {COMMODITIES.map((commodityDef) => {
                    // Always show row for editing, even if price is not known yet
                    const currentKnownPrice = editedPrices[commodityDef.key];
                    const priceDisplay =
                      currentKnownPrice !== undefined &&
                      !isNaN(currentKnownPrice)
                        ? `${currentKnownPrice.toFixed(1)} Cr`
                        : "-";
                    const priceValue =
                      currentKnownPrice !== undefined &&
                      !isNaN(currentKnownPrice)
                        ? currentKnownPrice.toString() // Use string for input value
                        : ""; // Default to empty string

                    return (
                      <tr
                        key={commodityDef.key}
                        className="border-t border-gray-600"
                      >
                        <td className="px-4 py-2">{commodityDef.key}</td>
                        <td className="px-4 py-2">{priceDisplay}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.1" // Allow decimals
                            min="0" // Prevent negative prices
                            value={priceValue}
                            onChange={(e) =>
                              handlePriceChange(
                                commodityDef.key,
                                e.target.value
                              )
                            }
                            placeholder="Enter Price"
                            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 w-24 text-yellow-400"
                            style={{
                              color: "#ffff00",
                              backgroundColor: "rgba(0,0,0,0.4)",
                            }} // Style similar to market
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ textAlign: "center", marginTop: "15px" }}>
                <button
                  onClick={handleSaveChanges}
                  className="station-info-button" // Reuse button style
                  style={{ minWidth: "180px" }}
                >
                  Save Known Prices
                </button>
              </div>
            </div>
          ) : (
            <p style={{ color: "#aaaaaa", fontStyle: "italic" }}>
              No known price data logged for this station yet. Prices will
              appear here once generated or manually entered.
            </p>
          )}
        </div>

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
