// src/components/DockingAnimation.tsx
import React from "react";
import "../App.css"; // Import CSS for animations

interface DockingAnimationProps {
  progress: number; // 0 to 1
}

const animationOverlayStyle: React.CSSProperties = {
  position: "fixed", // Use fixed to cover the whole viewport
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  backgroundColor: "#000",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 30, // Above everything else during animation
  overflow: "hidden", // Hide scrollbars if any appear
};

const circleContainerStyle: React.CSSProperties = {
  position: "relative",
  width: "80vmin", // Use viewport units for responsiveness
  height: "80vmin",
};

const baseCircleStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  border: "2px solid #00FFFF", // Cyan
  borderRadius: "50%",
  transformOrigin: "center",
  transform: "translate(-50%, -50%) scale(0)", // Start scaled down
  opacity: 0,
};

const DockingAnimation: React.FC<DockingAnimationProps> = ({ progress }) => {
  const numCircles = 5;
  const circles = [];

  for (let i = 0; i < numCircles; i++) {
    const delay = i * 0.2; // Stagger the circles
    let scale, opacity;

    // Circles expand from center
    const effectiveProgress = Math.max(
      0,
      Math.min(1, (progress - delay) / (1 - delay * 0.8))
    ); // Adjust progress based on delay
    scale = effectiveProgress * 1.5; // Expand beyond container
    opacity = 1 - effectiveProgress; // Fade out as they expand

    // Clamp opacity and scale
    opacity = Math.max(0, Math.min(1, opacity));
    scale = Math.max(0, scale);

    circles.push(
      <div
        key={i}
        style={{
          ...baseCircleStyle,
          width: `${10 + i * 15}%`, // Different sizes
          height: `${10 + i * 15}%`,
          transform: `translate(-50%, -50%) scale(${scale})`,
          opacity: opacity,
          transition: `transform 0.5s ease-out, opacity 0.5s ease-out`, // Smooth transitions
        }}
      />
    );
  }

  return (
    <div style={animationOverlayStyle}>
      <div style={circleContainerStyle}>{circles}</div>
    </div>
  );
};

export default DockingAnimation;
