// src/components/canvas/KonvaEnemy.tsx
import React from "react";
import { Group, Line } from "react-konva";
import { IEnemy } from "../../game/types";

interface KonvaEnemyProps {
  enemy: IEnemy;
  // offsetX and offsetY are removed
}

const KonvaEnemy: React.FC<KonvaEnemyProps> = ({ enemy }) => {
  const r = enemy.radius;
  // enemy.angle is its world-space facing direction (0 rad = right).
  // The shape [0, -r, ...] is designed with its "nose" at (0, -r), which is "up" in its local coordinates.
  // To make this "up-designed" sprite point in the direction of enemy.angle:
  // Convert enemy.angle to degrees and add 90 degrees.
  // (e.g., if enemy.angle = 0 (right), sprite rotates 90 deg. If enemy.angle = -PI/2 (up), sprite rotates 0 deg.)
  const angleDegrees = enemy.angle * (180 / Math.PI) + 90;

  const shapePoints = [0, -r, r * 0.6, r * 0.8, 0, r * 0.4, -r * 0.6, r * 0.8];

  return (
    <Group
      x={enemy.x} // Use direct world coordinate
      y={enemy.y} // Use direct world coordinate
      rotation={angleDegrees}
      listening={false}
    >
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
