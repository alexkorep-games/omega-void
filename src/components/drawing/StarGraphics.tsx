// src/components/drawing/StarGraphics.tsx
import React from 'react';
// Removed incorrect import: import { PixiGraphics } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { StarData } from '../../types';
import { clearAndSetFillStyle } from './GraphicsUtils';

interface StarGraphicsProps {
  star: StarData;
}

export const StarGraphics: React.FC<StarGraphicsProps> = React.memo(({ star }) => {
  const draw = React.useCallback((g: PIXI.Graphics) => {
    clearAndSetFillStyle(g, star.color);
    // Draw small rectangle, rounding handled by Pixi
    g.drawRect(-star.size / 2, -star.size / 2, star.size, star.size);
    g.endFill();
  }, [star.color, star.size]);

  return (
    <pixiGraphics // Changed to lowercase 'p'
      draw={draw}
      x={star.x}
      y={star.y}
      // No rotation needed for stars
    />
  );
});
