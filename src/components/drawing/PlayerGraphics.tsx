// src/components/drawing/PlayerGraphics.tsx
import React from 'react';
// Removed incorrect import: import { PixiGraphics } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { PlayerState } from '../../types';
import { PLAYER_COLOR } from '../../config';
import { clearAndSetLineStyle } from './GraphicsUtils';

interface PlayerGraphicsProps {
  player: PlayerState;
}

export const PlayerGraphics: React.FC<PlayerGraphicsProps> = React.memo(({ player }) => {
  const draw = React.useCallback((g: PIXI.Graphics) => {
    clearAndSetLineStyle(g, 2, PLAYER_COLOR);
    const r = player.radius;

    // Draw player shape (triangle with wings)
    g.moveTo(0, -r);
    g.lineTo(r * 0.7, r * 0.7);
    g.lineTo(0, r * 0.3);
    g.lineTo(-r * 0.7, r * 0.7);
    g.closePath();

    // Wings
    g.moveTo(-r * 0.7, r * 0.7);
    g.lineTo(-r * 1.2, r * 0.5);
    g.moveTo(r * 0.7, r * 0.7);
    g.lineTo(r * 1.2, r * 0.5);

    g.stroke(); // Use stroke for wireframe look

  }, [player.radius]); // Only redraw if radius changes (unlikely)

  return (
    <pixiGraphics // Changed to lowercase 'p'
      draw={draw}
      x={player.x}
      y={player.y}
      rotation={player.angle + Math.PI / 2} // Adjust rotation offset if needed
    />
  );
});
