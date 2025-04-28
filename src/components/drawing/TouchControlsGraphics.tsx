// src/components/drawing/TouchControlsGraphics.tsx
import React from 'react';
// Removed incorrect import: import { PixiGraphics } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { TouchState } from '../../types';
import * as C from '../../config';
import { clearAndSetLineStyle, clearAndSetFillStyle } from './GraphicsUtils';

interface TouchControlsGraphicsProps {
  touchState: TouchState;
}

export const TouchControlsGraphics: React.FC<TouchControlsGraphicsProps> = React.memo(({ touchState }) => {
  const draw = React.useCallback((g: PIXI.Graphics) => {
    g.clear();

    // --- Movement Joystick ---
    if (touchState.move.active) {
      const { startX, startY, currentX, currentY } = touchState.move;
      const outerRadius = C.TOUCH_JOYSTICK_OUTER_RADIUS;
      const innerRadius = C.TOUCH_JOYSTICK_INNER_RADIUS;

      // Outer ring
      g.lineStyle(2, 0xffffff, 0.3); // White, semi-transparent
      g.drawCircle(startX, startY, outerRadius);

      // Inner stick position calculation
      const dx = currentX - startX;
      const dy = currentY - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(dist, outerRadius); // Limit stick travel
      const angle = dist > 0 ? Math.atan2(dy, dx) : 0;
      const stickX = startX + Math.cos(angle) * clampedDist;
      const stickY = startY + Math.sin(angle) * clampedDist;

      // Inner stick
      g.beginFill(0xffffff, 0.4); // White, more transparent
      g.drawCircle(stickX, stickY, innerRadius);
      g.endFill();
    }

    // --- Shooting Indicator ---
    if (touchState.shoot.active) {
      const { x, y } = touchState.shoot;
       const indicatorRadius = C.TOUCH_SHOOT_INDICATOR_RADIUS;
       const innerDotRadius = C.TOUCH_SHOOT_INNER_DOT_RADIUS;

      // Outer semi-transparent circle
      g.beginFill(C.PLAYER_COLOR, 0.2); // Magenta, very transparent
      g.drawCircle(x, y, indicatorRadius);
      g.endFill();

      // Inner opaque dot
       g.beginFill(C.PLAYER_COLOR, 0.5); // Magenta, less transparent
       g.drawCircle(x, y, innerDotRadius);
       g.endFill();
    }

  }, [touchState]);

  return <pixiGraphics draw={draw} />; // Changed to lowercase 'p'
});