// src/components/StationInfoScreen.tsx
import React from "react";
import { useGameState } from "../hooks/useGameState";
import "./Market.css"; // Reuse Market CSS for layout and theming

const StationInfoScreen: React.FC = () => {
  const { gameState, findStationById } = useGameState();
  const { dockingStationId } = gameState;

  // Fetch the current station data
  const station = findStationById(dockingStationId);

  if (!station) {
    return (
      <div className="market-container info-screen">
        <div className="market-header">
          <div className="market-title">STATION INFORMATION</div>
          {/* Optional: Add cash display if relevant */}
          {/* <div className="market-credits">{gameState.cash.toFixed(1)} CR</div> */}
        </div>
        <div className="market-loading">Station data unavailable...</div>
      </div>
    );
  }

  const coordinates = station.coordinates;

  return (
    <div className="market-container info-screen">
      <div className="market-header">
        <div className="market-title">{station.name}</div>
        <div className="market-credits">{gameState.cash.toFixed(1)} CR</div>
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
      </div>

      {/* Footer can be used for status or general info */}
      <div className="market-footer">
        <span>Docked at {station.name}. All systems nominal.</span>
      </div>
    </div>
  );
};

export default StationInfoScreen;
