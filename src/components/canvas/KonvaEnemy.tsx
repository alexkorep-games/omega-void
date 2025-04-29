import React from "react";
import { Group, Line } from "react-konva";
import { IEnemy } from "../../game/types";

interface KonvaEnemyProps {
  enemy: IEnemy;
  offsetX: number;
  offsetY: number;
}

const KonvaEnemy: React.FC<KonvaEnemyProps> = ({ enemy, offsetX, offsetY }) => {
  const screenX = enemy.x - offsetX;
  const screenY = enemy.y - offsetY;
  const r = enemy.radius;
  const angleDegrees = (enemy.angle + Math.PI / 2) * (180 / Math.PI); // Konva uses degrees, adjust angle

  const shapePoints = [0, -r, r * 0.6, r * 0.8, 0, r * 0.4, -r * 0.6, r * 0.8];

  return (
    <Group x={screenX} y={screenY} rotation={angleDegrees} listening={false}>
      <Line
        points={shapePoints}
        stroke={enemy.color}
        strokeWidth={1.5}
        closed={true}
        perfectDrawEnabled={false}
      />
    </Group>
  );
};

export default KonvaEnemy;
