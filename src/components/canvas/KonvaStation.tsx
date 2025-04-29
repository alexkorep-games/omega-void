import React from "react";
import { Group, Line, Rect } from "react-konva";
import { IStation } from "../../game/types";

interface KonvaStationProps {
  station: IStation;
  offsetX: number;
  offsetY: number;
}

const KonvaStation: React.FC<KonvaStationProps> = ({
  station,
  offsetX,
  offsetY,
}) => {
  const screenX = station.x - offsetX;
  const screenY = station.y - offsetY;
  const r = station.radius;
  const angleDegrees = station.angle * (180 / Math.PI); // Konva uses degrees

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
    >
      {/* Main Octagon */}
      <Line
        points={flatPoints}
        stroke={station.color}
        strokeWidth={2}
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
        stroke={station.color}
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
        stroke={station.color}
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
      <Rect
        x={points[3].x * innerScale}
        y={points[3].y * innerScale}
        width={(points[4].x - points[3].x) * innerScale}
        height={(points[4].y - points[3].y) * innerScale}
        stroke={station.color}
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
        stroke={station.color}
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
        stroke={station.color}
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
        stroke={station.color}
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
        stroke={station.color}
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
    </Group>
  );
};

export default KonvaStation;
