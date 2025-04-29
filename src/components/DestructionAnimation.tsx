// src/components/DestructionAnimation.tsx
import React, { useEffect, useState, useRef } from "react";
import Particle from "./Particle"; // Import the new component

// --- Interfaces (ParticleState, DestructionAnimationProps) remain the same ---
interface ParticleState {
  id: number;
  delay: number;
  duration: number;
  finalAngle: number;
  finalDistance: number;
  initialRotation: number;
  rotationSpeed: number;
  length: number;
  thickness: number;
}

interface DestructionAnimationProps {
  x: number;
  y: number;
  color: string;
  particleCount?: number;
  maxDistance?: number;
  duration?: number;
  particleLength?: number;
  particleThickness?: number;
  onComplete?: () => void;
}
// --- Styles (overlayStyle, lineBaseStyle) remain the same ---
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100dvh",
  pointerEvents: "none",
  zIndex: 25,
  overflow: "hidden",
};

const lineBaseStyle: React.CSSProperties = {
  position: "absolute",
  transformOrigin: "center right",
  opacity: 1,
};

const DestructionAnimation: React.FC<DestructionAnimationProps> = ({
  x,
  y,
  color,
  particleCount = 40,
  maxDistance = 100,
  duration = 800,
  particleLength = 8,
  particleThickness = 1.5,
  onComplete,
}) => {
  const [particles, setParticles] = useState<ParticleState[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const timeoutRef = useRef<number | null>(null);

  // Generate particle configurations (this useEffect remains the same)
  useEffect(() => {
    const newParticles: ParticleState[] = [];
    for (let i = 0; i < particleCount; i++) {
      const delay = Math.random() * (duration * 0.2);
      const animDuration = duration * (0.7 + Math.random() * 0.3);

      newParticles.push({
        id: i,
        delay: delay,
        duration: animDuration,
        finalAngle: Math.random() * 360,
        finalDistance: maxDistance * (0.5 + Math.random() * 0.5),
        initialRotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 720,
        length: particleLength * (0.8 + Math.random() * 0.4),
        thickness: particleThickness * (0.8 + Math.random() * 0.4),
      });
    }
    setParticles(newParticles);

    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
      if (onComplete) {
        onComplete();
      }
    }, duration + 100);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div style={overlayStyle}>
      {particles.map((p) => {
        // Calculate final rotation
        const finalRotation =
          p.initialRotation + (p.rotationSpeed * p.duration) / 1000;

        // Define initial style object
        const initialStyle: React.CSSProperties = {
          ...lineBaseStyle,
          left: `${x}px`,
          top: `${y}px`,
          width: `${p.length}px`,
          height: `${p.thickness}px`,
          backgroundColor: color,
          transform: `translate(-50%, -50%) rotate(${p.initialRotation}deg) translateX(0px)`,
          opacity: 1,
          transition: `transform ${p.duration}ms ease-out ${p.delay}ms, opacity ${p.duration}ms ease-in ${p.delay}ms`,
        };

        // Define final style object
        const finalStyle: React.CSSProperties = {
          ...initialStyle, // Base it on initial style
          transform: `translate(-50%, -50%) rotate(${finalRotation}deg) translateX(${p.finalDistance}px)`,
          opacity: 0,
        };

        // Render the Particle component, passing the styles
        return (
          <Particle
            key={p.id}
            initialStyle={initialStyle}
            finalStyle={finalStyle}
          />
        );
      })}
    </div>
  );
};

export default DestructionAnimation;
