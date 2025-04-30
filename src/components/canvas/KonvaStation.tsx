/* src/components/canvas/KonvaStation.tsx */
import React from "react";
import { Group, Line, Rect } from "react-konva";
import { IStation } from "../../game/types";
import * as C from "../../game/config"; // Import config for colors

interface KonvaStationProps {
  station: IStation;
  offsetX: number;
  offsetY: number;
  isNavTarget: boolean; // New prop
}

const KonvaStation: React.FC<KonvaStationProps> = ({
  station,
  offsetX,
  offsetY,
  isNavTarget,
}) => {
  const screenX = station.x - offsetX;
  const screenY = station.y - offsetY;
  const r = station.radius;
  const angleDegrees = station.angle * (180 / Math.PI); // Konva uses degrees
  const color = isNavTarget ? C.NAV_TARGET_COLOR : station.color; // Use nav color if target

  const points = [
    // Relative points for the octagon shape
    { x: -r, y: -r * 0.5 },
    { x: -r * 0.5, y: -r },
    { x: r * 0.5, y: -r },
    { x: r, y: -r * 0.5 },
    { x: r, y: r * 0.5 },
    { x: r * 0.5, y: r },
    { x: -r * 0.5, y: r },
    { x: -r, y: r * 0.5 },
  ];
  const flatPoints = points.reduce(
    (acc, p) => acc.concat(p.x, p.y),
    [] as number[]
  );
  const innerScale = 0.4;
  const detailScale = 0.7;

  return (
    <Group
      x={screenX}
      y={screenY}
      rotation={angleDegrees}
      // Offset needed if rotation should be around the center
      offsetX={0}
      offsetY={0}
      listening={false}
      // Optional: Add glow effect for nav target
      shadowColor={isNavTarget ? C.NAV_TARGET_COLOR : undefined}
      shadowBlur={isNavTarget ? 10 : 0}
      shadowOpacity={isNavTarget ? 0.8 : 0}
    >
      {/* Main Octagon */}
      <Line
        points={flatPoints}
        stroke={color} // Use dynamic color
        strokeWidth={isNavTarget ? 2.5 : 2} // Slightly thicker if nav target
        closed={true}
        perfectDrawEnabled={false}
      />
      {/* Inner structure lines */}
      <Line
        points={[
          points[3].x * innerScale,
          points[3].y * innerScale,
          points[3].x,
          points[3].y,
        ]}
        stroke={color} // Use dynamic color
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
      <Line
        points={[
          points[4].x * innerScale,
          points[4].y * innerScale,
          points[4].x,
          points[4].y,
        ]}
        stroke={color} // Use dynamic color
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
      <Rect
        x={points[3].x * innerScale}
        y={points[3].y * innerScale}
        width={(points[4].x - points[3].x) * innerScale}
        height={(points[4].y - points[3].y) * innerScale}
        stroke={color} // Use dynamic color
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
      <Line
        points={[
          points[1].x * detailScale,
          points[1].y * detailScale,
          points[1].x,
          points[1].y,
        ]}
        stroke={color} // Use dynamic color
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
      <Line
        points={[
          points[2].x * detailScale,
          points[2].y * detailScale,
          points[2].x,
          points[2].y,
        ]}
        stroke={color} // Use dynamic color
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
      <Line
        points={[
          points[5].x * detailScale,
          points[5].y * detailScale,
          points[5].x,
          points[5].y,
        ]}
        stroke={color} // Use dynamic color
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
      <Line
        points={[
          points[6].x * detailScale,
          points[6].y * detailScale,
          points[6].x,
          points[6].y,
        ]}
        stroke={color} // Use dynamic color
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
    </Group>
  );
};

export default KonvaStation;
