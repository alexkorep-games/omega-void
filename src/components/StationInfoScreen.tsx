/* src/components/StationInfoScreen.tsx */
// src/components/StationInfoScreen.tsx
import React, { useCallback } from "react";
import { useGameState } from "../hooks/useGameState";
import "./Market.css"; // Reuse Market CSS for layout and theming

const StationInfoScreen: React.FC = () => {
  // Get quest-related functions and state from useGameState
  const {
    gameState,
    findStationById,
    setGameView,
    setNavTarget,
    updatePlayerState,
    addQuestItem,
  } = useGameState();
  const {
    dockingStationId,
    navTargetStationId,
    cash,
    cargoHold,
    questInventory,
  } = gameState;

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

  // --- Quest Action Handlers ---
  const fragACost = 15000;
  const handleBuyFragmentA = useCallback(() => {
    if (cash >= fragACost) {
      updatePlayerState((prev) => ({ cash: prev.cash - fragACost }));
      addQuestItem("contract_frag_a");
      // Optionally show a success message
      console.log("Bought Fragment Alpha");
    } else {
      console.log("Not enough credits for Fragment A");
      // Optionally show an error message
    }
  }, [cash, updatePlayerState, addQuestItem]); // Dependencies

  const fragBMachinery = 20;
  const currentMachinery = cargoHold.get("Machinery") || 0;
  const handleBarterFragmentB = useCallback(() => {
    if (currentMachinery >= fragBMachinery) {
      // Remove machinery first using updatePlayerState
      updatePlayerState((prev) => {
        const newCargo = new Map(prev.cargoHold);
        const current = newCargo.get("Machinery") || 0;
        const remaining = current - fragBMachinery;
        if (remaining <= 0) newCargo.delete("Machinery");
        else newCargo.set("Machinery", remaining);
        // Note: The ITEM_REMOVED event for Machinery is emitted by updatePlayerState's logic
        return { cargoHold: newCargo };
      });
      // Then add the quest item
      addQuestItem("contract_frag_b");
      console.log("Bartered Machinery for Fragment Beta");
    } else {
      console.log(
        `Need ${fragBMachinery}t Machinery, have ${currentMachinery}t`
      );
      // Optionally show an error message
    }
  }, [cargoHold, currentMachinery, updatePlayerState, addQuestItem]); // Dependencies

  const handlePickupFragmentC = useCallback(() => {
    // In a real scenario, this might be enabled after defeating guards or solving a puzzle
    addQuestItem("contract_frag_c");
    console.log("Picked up Fragment Charlie");
    // Maybe emit generic PICKUP event if needed?
    // setTimeout(() => emitQuestEvent({ type: "ITEM_ACQUIRED", itemId: "contract_frag_c", quantity: 1, method: "pickup" }), 0); // Already handled by addQuestItem
  }, [addQuestItem]); // Dependency

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

  // --- Determine quest action availability & titles ---
  const hasFragA = questInventory.has("contract_frag_a");
  const canBuyFragA = station.id === "station_-10_4_fixA" && !hasFragA;
  const buyFragADisabled = cash < fragACost;
  // Provide informative titles for disabled/enabled states
  const buyFragATitle = hasFragA
    ? "Fragment Alpha Acquired"
    : buyFragADisabled
    ? `Need ${fragACost} CR`
    : `Acquire Fragment (Cost: ${fragACost} CR)`;

  const hasFragB = questInventory.has("contract_frag_b");
  const canBarterFragB = station.id === "station_5_-8_fixB" && !hasFragB;
  const barterFragBDisabled = currentMachinery < fragBMachinery;
  const barterFragBTitle = hasFragB
    ? "Fragment Beta Acquired"
    : barterFragBDisabled
    ? `Requires ${fragBMachinery}t Machinery (Have: ${currentMachinery}t)`
    : `Exchange Machinery for Fragment`;

  const hasFragC = questInventory.has("contract_frag_c");
  const canPickupFragC = station.id === "station_0_0_fixC" && !hasFragC;
  // Assuming no specific requirement check here other than presence for pickup
  const pickupFragCTitle = hasFragC
    ? "Fragment Charlie Acquired"
    : "Retrieve Fragment from secure storage";

  return (
    <div className="market-container info-screen">
      <div className="market-header">
        <div className="market-title">{station.name}</div>
        <div className="market-credits">{gameState.cash.toFixed(1)} CR</div>
      </div>

      <div className="station-info-content">
        {/* Standard info items */}
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

        {/* Quest Actions Section - Conditionally render the whole section */}
        {(canBuyFragA ||
          canBarterFragB ||
          canPickupFragC ||
          hasFragA ||
          hasFragB ||
          hasFragC) && (
          <div className="station-quest-actions">
            <h4
              style={{
                color: "#ffff00",
                borderBottom: "1px dashed #888800",
                paddingBottom: "5px",
                marginBottom: "10px",
              }}
            >
              Special Actions
            </h4>

            {/* Show button only if action is possible (item not already acquired) */}
            {canBuyFragA && (
              <button
                className="station-info-button quest-action"
                onClick={handleBuyFragmentA}
                disabled={buyFragADisabled} // Disable if cannot afford
                title={buyFragATitle} // Set dynamic title
              >
                Buy Fragment Alpha ({fragACost} CR)
              </button>
            )}
            {canBarterFragB && (
              <button
                className="station-info-button quest-action"
                onClick={handleBarterFragmentB}
                disabled={barterFragBDisabled} // Disable if not enough machinery
                title={barterFragBTitle} // Set dynamic title
              >
                Barter Fragment Beta ({fragBMachinery}t Machinery)
              </button>
            )}
            {canPickupFragC && (
              <button
                className="station-info-button quest-action"
                onClick={handlePickupFragmentC}
                // No disabled state based on requirements here, assumed always possible if at station
                title={pickupFragCTitle} // Set dynamic title
              >
                Retrieve Fragment Charlie
              </button>
            )}

            {/* Optionally show status text if item already acquired at this station */}
            {station.id === "station_-10_4_fixA" && hasFragA && (
              <span style={{ color: "#0f0", marginTop: "5px" }}>
                Fragment Alpha already acquired.
              </span>
            )}
            {station.id === "station_5_-8_fixB" && hasFragB && (
              <span style={{ color: "#0f0", marginTop: "5px" }}>
                Fragment Beta already acquired.
              </span>
            )}
            {station.id === "station_0_0_fixC" && hasFragC && (
              <span style={{ color: "#0f0", marginTop: "5px" }}>
                Fragment Charlie already acquired.
              </span>
            )}
          </div>
        )}

        {/* Standard Action Buttons Area */}
        <div className="station-info-actions">
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
