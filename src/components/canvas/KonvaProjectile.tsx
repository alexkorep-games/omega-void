// src/components/canvas/KonvaProjectile.tsx
import React from "react";
import { Circle } from "react-konva";
import { IProjectile } from "../../game/types";

interface KonvaProjectileProps {
  proj: IProjectile;
  // offsetX and offsetY are removed
}

const KonvaProjectile: React.FC<KonvaProjectileProps> = ({ proj }) => {
  return (
    <Circle
      x={proj.x} // Use direct world coordinate
      y={proj.y} // Use direct world coordinate
      radius={proj.radius}
      fill={proj.color}
      perfectDrawEnabled={false}
      listening={false}
    />
  );
};

export default KonvaProjectile;
