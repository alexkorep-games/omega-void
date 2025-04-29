import React from "react";
import { Line } from "react-konva";
import { DestructionAnimationData, ParticleState } from "../../game/types";

// --- Easing Functions ---
function easeOutQuad(t: number): number {
  return t * (2 - t);
}
function easeInQuad(t: number): number {
  return t * t;
}

interface KonvaDestructionParticleProps {
  anim: DestructionAnimationData;
  particle: ParticleState;
  offsetX: number; // Camera offset X
  offsetY: number; // Camera offset Y
  now: number; // Current time
}

const KonvaDestructionParticle: React.FC<KonvaDestructionParticleProps> = ({
  anim,
  particle: p,
  offsetX,
  offsetY,
  now,
}) => {
  const elapsedTime = now - (anim.startTime + p.delay);

  if (elapsedTime < 0 || elapsedTime > p.duration) {
    return null; // Particle not active yet or finished
  }

  // Clamp progress ratio between 0 and 1
  const progressRatio = Math.max(0, Math.min(1, elapsedTime / p.duration));

  // Apply easing
  const moveProgress = easeOutQuad(progressRatio);
  const opacityProgress = easeInQuad(progressRatio); // Fades *in* over time, so use directly for opacity fade *out*

  const currentDistance = p.finalDistance * moveProgress;
  const currentOpacity = 1 - opacityProgress; // Opacity goes from 1 down to 0

  // Calculate rotation in DEGREES for Konva
  const currentRotation =
    p.initialRotation + p.rotationSpeed * (elapsedTime / 1000); // Rotate based on elapsed time

  // Convert finalAngle (direction of travel) to radians for Math.cos/sin
  const travelAngleRad = p.finalAngle * (Math.PI / 180);

  // Calculate particle position relative to animation center
  const particleOffsetX = Math.cos(travelAngleRad) * currentDistance;
  const particleOffsetY = Math.sin(travelAngleRad) * currentDistance;

  // Calculate final screen position
  const screenX = anim.x - offsetX + particleOffsetX;
  const screenY = anim.y - offsetY + particleOffsetY;

  // Use Konva Line for the particle "streak"
  // Points define the line relative to its position (screenX, screenY)
  // Rotate the line itself
  // Offset ensures rotation happens around the particle's "start"
  return (
    <Line
      x={screenX}
      y={screenY}
      points={[0, 0, p.length, 0]} // Draw line along x-axis, length p.length
      stroke={anim.color}
      strokeWidth={p.thickness}
      rotation={currentRotation} // Apply visual rotation (degrees)
      opacity={currentOpacity}
      perfectDrawEnabled={false} // Optimization
      listening={false}
    />
  );
};

export default KonvaDestructionParticle;
