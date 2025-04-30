import React from "react";
import { RegularPolygon } from "react-konva";
import { IAsteroid } from "../../game/types"; // Use the type

interface KonvaAsteroidProps {
  asteroid: IAsteroid;
  offsetX: number;
  offsetY: number;
}

const KonvaAsteroid: React.FC<KonvaAsteroidProps> = ({
  asteroid,
  offsetX,
  offsetY,
}) => {
  const screenX = asteroid.x - offsetX;
  const screenY = asteroid.y - offsetY;
  const angleDegrees = asteroid.angle * (180 / Math.PI);

  return (
    <RegularPolygon
      x={screenX}
      y={screenY}
      sides={6}
      radius={asteroid.radius}
      fill={"#888"}
      stroke={"#555"}
      strokeWidth={1}
      rotation={angleDegrees}
      perfectDrawEnabled={false}
      listening={false}
    />
  );
};

export default KonvaAsteroid;
