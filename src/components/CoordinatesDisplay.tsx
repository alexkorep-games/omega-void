// src/components/CoordinatesDisplay.tsx
import React from "react";

interface CoordinatesDisplayProps {
  x: number;
  y: number;
}

const displayStyle: React.CSSProperties = {
  position: "absolute",
  top: "5px",
  left: "5px",
  color: "#00ffff", // HUD Color
  fontFamily: "monospace",
  fontSize: "12px",
  backgroundColor: "rgba(0, 0, 0, 0.5)", // Optional background
  padding: "2px 5px",
  zIndex: 10, // Ensure it's above the canvas
  pointerEvents: "none", // Make sure it doesn't block canvas interactions
};

const CoordinatesDisplay: React.FC<CoordinatesDisplayProps> = ({ x, y }) => {
  const displayX = Math.floor(x);
  const displayY = Math.floor(y);

  return (
    <div style={displayStyle}>
      X: {displayX}, Y: {displayY}
    </div>
  );
};

export default CoordinatesDisplay;
