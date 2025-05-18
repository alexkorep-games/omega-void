// src/components/canvas/KonvaDestructionParticle.tsx
import React from "react";
import { Line } from "react-konva";
import { DestructionAnimationData, ParticleState } from "../../game/types";

function easeOutQuad(t: number): number {
  return t * (2 - t);
}
function easeInQuad(t: number): number {
  return t * t;
}

interface KonvaDestructionParticleProps {
  anim: DestructionAnimationData;
  particle: ParticleState;
  now: number; // Current time
  // offsetX and offsetY are removed
}

const KonvaDestructionParticle: React.FC<KonvaDestructionParticleProps> = ({
  anim,
  particle: p,
  now,
}) => {
  const elapsedTime = now - (anim.startTime + p.delay);

  if (elapsedTime < 0 || elapsedTime > p.duration) {
    return null;
  }

  const progressRatio = Math.max(0, Math.min(1, elapsedTime / p.duration));
  const moveProgress = easeOutQuad(progressRatio);
  const opacityProgress = easeInQuad(progressRatio);
  const currentDistance = p.finalDistance * moveProgress;
  const currentOpacity = 1 - opacityProgress;

  // Particle's visual rotation (currentRotation) is relative to its travel direction.
  // Its travel direction (finalAngle) is a world angle.
  // The Line component's rotation prop is absolute.
  const currentRotationDeg =
    p.initialRotation + p.rotationSpeed * (elapsedTime / 1000);

  const travelAngleRad = p.finalAngle * (Math.PI / 180);

  const particleOffsetX = Math.cos(travelAngleRad) * currentDistance;
  const particleOffsetY = Math.sin(travelAngleRad) * currentDistance;

  // Final world position of the particle's origin
  const worldX = anim.x + particleOffsetX;
  const worldY = anim.y + particleOffsetY;

  return (
    <Line
      x={worldX} // Particle's origin in world space
      y={worldY} // Particle's origin in world space
      points={[0, 0, p.length, 0]} // Line drawn along its own X-axis
      stroke={anim.color}
      strokeWidth={p.thickness}
      rotation={currentRotationDeg} // Visual rotation of the particle itself
      opacity={currentOpacity}
      perfectDrawEnabled={false}
      listening={false}
    />
  );
};

export default KonvaDestructionParticle;
