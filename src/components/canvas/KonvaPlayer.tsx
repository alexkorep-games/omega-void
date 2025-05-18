// src/components/canvas/KonvaPlayer.tsx
import React from "react";
import { Group, Line } from "react-konva";
import { IPlayer } from "../../game/types";

interface KonvaPlayerProps {
  player: IPlayer;
  screenX: number; // Player's fixed X position on screen
  screenY: number; // Player's fixed Y position on screen
  fixedRotation: number; // Player's fixed visual rotation in degrees
}

const KonvaPlayer: React.FC<KonvaPlayerProps> = ({
  player,
  screenX,
  screenY,
  fixedRotation,
}) => {
  const r = player.radius;

  // Shape points remain relative to (0,0)
  const mainBodyPoints = [
    0,
    -r,
    r * 0.7,
    r * 0.7,
    0,
    r * 0.3,
    -r * 0.7,
    r * 0.7,
  ];
  const wing1Points = [-r * 0.7, r * 0.7, -r * 1.2, r * 0.5];
  const wing2Points = [r * 0.7, r * 0.7, r * 1.2, r * 0.5];

  return (
    <Group
      x={screenX} // Use direct screen coordinates
      y={screenY}
      rotation={fixedRotation} // Use the fixed visual rotation
      listening={false}
    >
      <Line
        points={mainBodyPoints}
        stroke={player.color}
        strokeWidth={2}
        closed={true}
        perfectDrawEnabled={false}
      />
      <Line
        points={wing1Points}
        stroke={player.color}
        strokeWidth={2}
        closed={false}
        perfectDrawEnabled={false}
      />
      <Line
        points={wing2Points}
        stroke={player.color}
        strokeWidth={2}
        closed={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
};

export default KonvaPlayer;
