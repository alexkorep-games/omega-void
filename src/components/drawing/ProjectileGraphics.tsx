// src/components/drawing/ProjectileGraphics.tsx
import React from 'react';
// Removed incorrect import: import { PixiGraphics } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { ProjectileState } from '../../types';
import { PROJECTILE_COLOR } from '../../config';
import { clearAndSetFillStyle } from './GraphicsUtils';

interface ProjectileGraphicsProps {
  projectile: ProjectileState;
}

export const ProjectileGraphics: React.FC<ProjectileGraphicsProps> = React.memo(({ projectile }) => {
  const draw = React.useCallback((g: PIXI.Graphics) => {
    clearAndSetFillStyle(g, PROJECTILE_COLOR);
    g.drawCircle(0, 0, projectile.radius);
    g.endFill();
  }, [projectile.radius]);

  return (
    <pixiGraphics // Changed to lowercase 'p'
      draw={draw}
      x={projectile.x}
      y={projectile.y}
    />
  );
});
