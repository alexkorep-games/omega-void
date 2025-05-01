import React from "react";
import { Group, Star } from "react-konva";
import { IBeacon } from "../../game/types";

interface KonvaBeaconProps {
  beacon: IBeacon;
  offsetX: number;
  offsetY: number;
}

const KonvaBeacon: React.FC<KonvaBeaconProps> = ({
  beacon,
  offsetX,
  offsetY,
}) => {
  const screenX = beacon.x - offsetX;
  const screenY = beacon.y - offsetY;

  // Use beacon's current color (which reflects its isActive state)
  const color = beacon.color;
  const now = Date.now();
  // Blinking effect intensity depends on whether it's active
  const blinkIntensity = beacon.isActive ? 0.1 : 0.4;
  const opacity = beacon.isActive
    ? 0.9
    : 0.6 + Math.sin(now / 200) * blinkIntensity;

  return (
    <Group x={screenX} y={screenY} listening={false}>
      {/* Render as a 4-point star */}
      <Star
        numPoints={4}
        innerRadius={beacon.radius * 0.5} // Adjust size as needed
        outerRadius={beacon.radius * 1.2}
        fill={color}
        stroke={"#FFFFFF"}
        strokeWidth={1}
        rotation={45} // Align points vertically/horizontally
        perfectDrawEnabled={false} // May improve performance
        opacity={opacity}
        shadowColor={color} // Add glow matching color
        shadowBlur={beacon.isActive ? 3 : 5} // Reduce glow when active?
        shadowOpacity={0.7}
      />
    </Group>
  );
};

export default KonvaBeacon;
