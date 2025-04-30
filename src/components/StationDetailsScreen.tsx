/* src/components/StationDetailsScreen.tsx */
// src/components/StationDetailsScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import { useGameState } from "../hooks/useGameState";
import { IStation } from "../game/types";
import "./Market.css"; // Reuse Market CSS for layout and theming

interface StationDetailsScreenProps {
  stationId: string | null; // ID of the station to display
}

const StationDetailsScreen: React.FC<StationDetailsScreenProps> = ({
  stationId,
}) => {
  const { gameState, findStationById, setGameView, setNavTarget } =
    useGameState();
  const { navTargetStationId, cash } = gameState;
  const [station, setStation] = useState<IStation | null>(null);

  useEffect(() => {
    // Fetch station data when the stationId prop changes
    if (stationId) {
      const foundStation = findStationById(stationId);
      setStation(foundStation);
    } else {
      setStation(null); // Clear station if ID is null
    }
  }, [stationId, findStationById]);

  const handleLogClick = useCallback(() => {
    setGameView("station_log"); // Navigate back to the log
  }, [setGameView]);

  const handleToggleNavigate = useCallback(() => {
    if (!station) return;
    // If this station is already the target, clear it. Otherwise, set it.
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
