// src/components/DestructionAnimation.tsx
import React, { useEffect, useState } from "react";

interface DestructionAnimationProps {
  x: number; // Screen X coordinate
  y: number; // Screen Y coordinate
  progress: number; // Animation progress (0 to 1)
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100dvh", // Use dynamic viewport height
  pointerEvents: "none", // Allow clicks through
  zIndex: 25, // Above game canvas, below docking animation maybe
  overflow: "hidden",
};

const explosionBaseStyle: React.CSSProperties = {
  position: "absolute",
  borderRadius: "50%",
  background:
    "radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,200,0,0.6) 40%, rgba(255,100,0,0.3) 70%, rgba(255,0,0,0.0) 100%)",
  transformOrigin: "center center",
  opacity: 0,
};

const particleBaseStyle: React.CSSProperties = {
  position: "absolute",
  width: "3px",
  height: "3px",
  background: `rgba(255, 255, ${Math.random() * 155 + 100}, ${
    0.5 + Math.random() * 0.5
  })`, // Yellow/White sparks
  borderRadius: "50%",
  transformOrigin: "center center",
  opacity: 0,
};

const DestructionAnimation: React.FC<DestructionAnimationProps> = ({
  x,
  y,
  progress,
}) => {
  const [particles, setParticles] = useState<React.CSSProperties[]>([]);

  // Generate particles once
  useEffect(() => {
    const newParticles: React.CSSProperties[] = [];
    const numParticles = 50;
    for (let i = 0; i < numParticles; i++) {
      // const angle = Math.random() * Math.PI * 2; // Angle moved to render calculation
      // const dist = Math.random() * 80 + 20; // Distance moved to render calculation
      const duration = 0.5 + Math.random() * 0.5; // Random duration
      const delay = Math.random() * 0.2; // Staggered start
      newParticles.push({
        ...particleBaseStyle,
        transition: `all ${duration}s ease-out ${delay}s`,
      });
    }
    setParticles(newParticles);
  }, []); // Empty dependency array ensures this runs only once

  const explosionSize = 100 + progress * 150; // Grows
  const explosionOpacity = Math.max(0, 1 - progress * 1.5); // Fades out

  const explosionStyle: React.CSSProperties = {
    ...explosionBaseStyle,
    left: `${x}px`,
    top: `${y}px`,
    width: `${explosionSize}px`,
    height: `${explosionSize}px`,
    transform: `translate(-50%, -50%) scale(${1 + progress * 0.5})`, // Slight scale effect
    opacity: explosionOpacity,
    transition:
      "opacity 0.5s ease-out, transform 0.5s ease-out, width 0.5s ease-out, height 0.5s ease-out",
  };

  // Style for white flash overlay
  const flashOpacity = Math.max(
    0,
    Math.sin(progress * Math.PI * 2) * 0.5 * (1 - progress)
  ); // Quick flash at start
  const flashStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(255, 255, 255, 1)",
    opacity: flashOpacity,
    zIndex: 26, // Above explosion
    pointerEvents: "none",
    mixBlendMode: "screen", // Blend mode for flash effect
    transition: "opacity 0.1s ease-out",
  };

  return (
    <div style={overlayStyle}>
      {/* White Flash */}
      <div style={flashStyle}></div>

      {/* Main Explosion Core */}
      <div style={explosionStyle}></div>

      {/* Particles */}
      {particles.map((style, index) => {
        const angle =
          (index / particles.length) * Math.PI * 2 +
          (Math.random() - 0.5) * 0.5;
        const distance = 20 + progress * (100 + Math.random() * 50); // Particles fly outwards
        const particleOpacity = Math.max(0, 1 - progress * 2); // Fade faster

        const finalStyle: React.CSSProperties = {
          ...style, // Base style with transition
          left: `${x + Math.cos(angle) * distance}px`,
          top: `${y + Math.sin(angle) * distance}px`,
          transform: `translate(-50%, -50%) scale(${1 - progress})`, // Shrink slightly
          opacity: particleOpacity,
        };
        return <div key={index} style={finalStyle}></div>;
      })}

      {/* Optional: Respawn Text */}
      {progress > 0.8 && (
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            color: "#FF5555",
            fontSize: "18px",
            fontFamily: "monospace",
            textShadow: "0 0 5px #FF0000",
            opacity: (progress - 0.8) / 0.2, // Fade in text at the end
          }}
        >
          SYSTEM FAILURE - REINITIALIZING...
        </div>
      )}
    </div>
  );
};

export default DestructionAnimation;
