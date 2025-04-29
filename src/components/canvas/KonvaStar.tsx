import React from "react";
import { Rect } from "react-konva";
import { IStar } from "../../game/types";

interface KonvaStarProps {
  star: IStar;
  offsetX: number;
  offsetY: number;
}

const KonvaStar: React.FC<KonvaStarProps> = ({ star, offsetX, offsetY }) => {
  // Konva Rect draws from top-left
  return (
    <Rect
      x={Math.floor(star.x - offsetX)}
      y={Math.floor(star.y - offsetY)}
      width={Math.ceil(star.size)}
      height={Math.ceil(star.size)}
      fill={star.color}
      perfectDrawEnabled={false} // Optimize for many simple shapes
      listening={false} // Stars don't need interaction
    />
  );
};

export default KonvaStar;
