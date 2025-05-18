// src/components/canvas/KonvaBeacon.tsx
import React from "react";
import { Group, Star } from "react-konva";
import { IBeacon } from "../../game/types";

interface KonvaBeaconProps {
  beacon: IBeacon;
  // offsetX and offsetY are removed
}

const KonvaBeacon: React.FC<KonvaBeaconProps> = ({ beacon }) => {
  const color = beacon.color;
  const now = Date.now();
  const blinkIntensity = beacon.isActive ? 0.1 : 0.4;
  const opacity = beacon.isActive
    ? 0.9
    : 0.6 + Math.sin(now / 200) * blinkIntensity;

  return (
    <Group
      x={beacon.x} // Use direct world coordinate
      y={beacon.y} // Use direct world coordinate
      listening={false}
    >
      <Star
        numPoints={4}
        innerRadius={beacon.radius * 0.5}
        outerRadius={beacon.radius * 1.2}
        fill={color}
        stroke={"#FFFFFF"}
        strokeWidth={1}
        rotation={45} // Beacon has a fixed visual rotation
        perfectDrawEnabled={false}
        opacity={opacity}
        shadowColor={color}
        shadowBlur={beacon.isActive ? 3 : 5}
        shadowOpacity={0.7}
      />
    </Group>
  );
};

export default KonvaBeacon;
