// src/components/drawing/StationGraphics.tsx
import React from 'react';
import * as PIXI from 'pixi.js';
import { StationData } from '../../types';
import { clearAndSetLineStyle } from './GraphicsUtils';

interface StationGraphicsProps {
  station: StationData;
}

// Pre-create text style
const stationTextStyle = new PIXI.TextStyle({
    fontFamily: 'monospace',
    fontSize: 10,
    fill: 0x00FFFF, // Default to station color, can be overridden
    align: 'center',
});

export const StationGraphics: React.FC<StationGraphicsProps> = React.memo(({ station }) => {
  const draw = React.useCallback((g: PIXI.Graphics) => {
    const r = station.radius;
    clearAndSetLineStyle(g, 2, station.color);

     // Coriolis Style Drawing (rotated)
    const points = [
        { x: -r, y: -r * 0.5 }, { x: -r * 0.5, y: -r },
        { x: r * 0.5, y: -r }, { x: r, y: -r * 0.5 },
        { x: r, y: r * 0.5 }, { x: r * 0.5, y: r },
        { x: -r * 0.5, y: r }, { x: -r, y: r * 0.5 },
    ];
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.closePath();
    g.stroke(); // Use stroke for station shape

    // Inner structure (less thick line)
    g.lineStyle(1, station.color); // Thinner line
    const innerScale = 0.4;
    g.drawRect(
        points[3].x * innerScale, points[3].y * innerScale,
        (points[4].x - points[3].x) * innerScale,
        (points[4].y - points[3].y) * innerScale
    );
    const detailScale = 0.7;
    const detailPointsIndices = [1, 2, 5, 6, 3, 4]; // Indices for connection lines
    detailPointsIndices.forEach(idx => {
        g.moveTo(points[idx].x * detailScale, points[idx].y * detailScale);
        g.lineTo(points[idx].x, points[idx].y);
    })
    g.stroke();

  }, [station.radius, station.color]);

  // Calculate text position relative to the station center
  const textYOffset = -station.radius - 12; // Above the station

  return (
    <>
      {/* Graphics for the station body */}
      <pixiGraphics // Changed to lowercase 'p'
        draw={draw}
        x={station.x}
        y={station.y}
        rotation={station.angle} // Apply rotation
      />
      {/* Text label - positioned relative to station, but not rotated */}
      {station.name && station.radius > 5 && (
        <pixiText // Changed to lowercase 'p'
          text={station.name}
          anchor={0.5} // Center align text
          x={station.x}
          y={station.y + textYOffset} // Position above
          style={{...stationTextStyle, fill: station.color}} // Use station color
        />
      )}
    </>
  );
});
