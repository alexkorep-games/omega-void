// src/components/drawing/EnemyGraphics.tsx
import React from 'react';
import * as PIXI from 'pixi.js';
import { EnemyState } from '../../types';
import { ENEMY_COLOR } from '../../config';
import { clearAndSetLineStyle } from './GraphicsUtils';

interface EnemyGraphicsProps {
  enemy: EnemyState;
}

export const EnemyGraphics: React.FC<EnemyGraphicsProps> = React.memo(({ enemy }) => {
  const draw = React.useCallback((g: PIXI.Graphics) => {
    clearAndSetLineStyle(g, 1.5, ENEMY_COLOR);
    const r = enemy.radius;

    // Draw enemy shape (different triangle)
    g.moveTo(0, -r);
    g.lineTo(r * 0.6, r * 0.8);
    g.lineTo(0, r * 0.4);
    g.lineTo(-r * 0.6, r * 0.8);
    g.closePath();
    g.stroke();

  }, [enemy.radius]);

  return (
    <pixiGraphics
      draw={draw}
      x={enemy.x}
      y={enemy.y}
      rotation={enemy.angle + Math.PI / 2}
    />
  );
});
