// src/components/StationScreen.tsx
import React from "react";
import { IStation } from "../game/types";

interface StationScreenProps {
  station: IStation | null; // Station data, null if not found (shouldn't happen ideally)
  onUndock: () => void; // Callback to trigger undocking
}

const stationScreenStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0, 20, 40, 0.95)", // Dark blue overlay
  color: "#00FFFF", // Cyan text
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  fontFamily: "monospace",
  zIndex: 20, // Ensure it's above game canvas/HUD
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#003344",
  border: "1px solid #00FFFF",
  color: "#00FFFF",
  padding: "10px 20px",
  fontSize: "16px",
  cursor: "pointer",
  marginTop: "30px",
  fontFamily: "monospace",
};

const StationScreen: React.FC<StationScreenProps> = ({ station, onUndock }) => {
  if (!station) {
    // Should ideally not happen if logic is correct
    return (
      <div style={stationScreenStyle}>
        <h2>Error: Station Not Found</h2>
        <button style={buttonStyle} onClick={onUndock}>
          Emergency Undock
        </button>
      </div>
    );
  }

  return (
    <div style={stationScreenStyle}>
      <h1>{station.name}</h1>
      <p>Welcome, Commander.</p>
      {/* Future controls go here */}
      <p>Status: Nominal</p>
      <p>Services: Refuel, Repair, Trade</p>
      {/* --- Undock Button --- */}
      <button style={buttonStyle} onClick={onUndock}>
        Undock
      </button>
    </div>
  );
};

export default StationScreen;
