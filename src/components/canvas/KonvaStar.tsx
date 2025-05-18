// src/components/canvas/KonvaStar.tsx
import React from "react";
import { Rect } from "react-konva";
import { IStar } from "../../game/types";

interface KonvaStarProps {
  star: IStar;
  // offsetX and offsetY are no longer passed from GameCanvas
}

const KonvaStar: React.FC<KonvaStarProps> = ({ star }) => {
  return (
    <Rect
      x={Math.floor(star.x)} // Use direct world coordinate
      y={Math.floor(star.y)} // Use direct world coordinate
      width={Math.ceil(star.size)}
      height={Math.ceil(star.size)}
      fill={star.color}
      perfectDrawEnabled={false}
      listening={false}
    />
  );
};

export default KonvaStar;
