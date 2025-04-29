import React from "react";
import { Group, Line } from "react-konva";
import { IPlayer } from "../../game/types";

interface KonvaPlayerProps {
  player: IPlayer;
  offsetX: number;
  offsetY: number;
}

const KonvaPlayer: React.FC<KonvaPlayerProps> = ({
  player,
  offsetX,
  offsetY,
}) => {
  const screenX = player.x - offsetX;
  const screenY = player.y - offsetY;
  const r = player.radius;
  const angleDegrees = (player.angle + Math.PI / 2) * (180 / Math.PI); // Konva uses degrees, adjust angle

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
      x={screenX}
      y={screenY}
      rotation={angleDegrees}
      listening={false} // Player shape doesn't need clicks
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
