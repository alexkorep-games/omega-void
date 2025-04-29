import React from "react";
import { Circle } from "react-konva";
import { IProjectile } from "../../game/types";

interface KonvaProjectileProps {
  proj: IProjectile;
  offsetX: number;
  offsetY: number;
}

const KonvaProjectile: React.FC<KonvaProjectileProps> = ({
  proj,
  offsetX,
  offsetY,
}) => {
  return (
    <Circle
      x={proj.x - offsetX}
      y={proj.y - offsetY}
      radius={proj.radius}
      fill={proj.color}
      perfectDrawEnabled={false}
      listening={false}
    />
  );
};

export default KonvaProjectile;
