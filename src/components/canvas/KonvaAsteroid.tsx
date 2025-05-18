// src/components/canvas/KonvaAsteroid.tsx
import React from "react";
import { RegularPolygon } from "react-konva";
import { IAsteroid } from "../../game/types";

interface KonvaAsteroidProps {
  asteroid: IAsteroid;
  // offsetX and offsetY are removed
}

const KonvaAsteroid: React.FC<KonvaAsteroidProps> = ({ asteroid }) => {
  // Asteroid.angle is its visual rotation.
  const angleDegrees = asteroid.angle * (180 / Math.PI);

  return (
    <RegularPolygon
      x={asteroid.x} // Use direct world coordinate
      y={asteroid.y} // Use direct world coordinate
      sides={6}
      radius={asteroid.radius}
      fill={"#888"}
      stroke={"#555"}
      strokeWidth={1}
      rotation={angleDegrees} // Asteroid's own visual rotation
      perfectDrawEnabled={false}
      listening={false}
    />
  );
};

export default KonvaAsteroid;
