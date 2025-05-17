/* src/components/StationInfoScreen.tsx */
import React, { useCallback } from "react";
import { useGameState } from "../hooks/useGameState";
import "./Market.css"; // Reuse Market CSS for layout and theming

const StationInfoScreen: React.FC = () => {
  const {
    gameState,
    findStationById,
    setGameView,
    setNavTarget,
  } = useGameState();
  const {
    dockingStationId,
    navTargetStationId,
    cash,
  } = gameState.cold;

  const station = findStationById(dockingStationId);

  const handleLogClick = useCallback(
    () => setGameView("station_log"),
    [setGameView]
  );
  const handleToggleNavigate = useCallback(() => {
    if (!station) return;
    const newTargetId = navTargetStationId === station.id ? null : station.id;
    setNavTarget(newTargetId);
  }, [station, navTargetStationId, setNavTarget]);

  const handleContractLogClick = useCallback(() => {
    setGameView("contract_log");
  }, [setGameView]);

  // --- Removed Quest Action Handlers for Fragments ---
  // Removed handleBuyFragmentA
  // Removed handleBarterFragmentB
  // Removed handlePickupFragmentC

  // Loading state
  if (!station)
    return (
      <div className="market-container info-screen">
        <div className="market-header">
          <div className="market-title">STATION INFO</div>
        </div>
        <div className="market-loading">Station data unavailable...</div>
      </div>
    );

  const coordinates = station.coordinates;
  const isNavigating = navTargetStationId === station.id;

  // --- Removed quest action availability & titles for Fragments ---
  // Removed hasFragA, canBuyFragA, buyFragADisabled, buyFragATitle
  // Removed hasFragB, canBarterFragB, barterFragBDisabled, barterFragBTitle
  // Removed hasFragC, canPickupFragC, pickupFragCTitle

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

        {/* Removed Quest Actions Section for Fragments */}

        {/* Standard Action Buttons Area */}
        <div className="station-info-actions">
          <button
            className="station-info-button"
            onClick={handleContractLogClick}
            title="View Contract Status"
          >
            CONTRACT
          </button>
          <button className="station-info-button" onClick={handleLogClick}>
            STATION LOG
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
        <span>Docked at {station.name}. All systems nominal.</span>
      </div>
    </div>
  );
};

export default StationInfoScreen;
