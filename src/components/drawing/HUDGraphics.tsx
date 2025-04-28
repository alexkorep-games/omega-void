// src/components/drawing/HUDGraphics.tsx
import React from 'react';
import * as PIXI from 'pixi.js';
import { GameState } from '../../types';
import * as C from '../../config';
import { clearAndSetLineStyle, clearAndSetFillStyle } from './GraphicsUtils';

interface HUDGraphicsProps {
  gameState: GameState; // Need player pos, enemies, stations for scanner
}

// Pre-create text styles for HUD (adjust as needed)
const hudTextStyle = new PIXI.TextStyle({
    fontFamily: 'monospace',
    fontSize: 12,
    fill: C.HUD_COLOR,
});
const hudAccentStyle = new PIXI.TextStyle({ ...hudTextStyle, fill: C.HUD_ACCENT_COLOR });
const hudTitleStyle = new PIXI.TextStyle({ ...hudTextStyle, fontSize: 16 });
const hudSmallStyle = new PIXI.TextStyle({ ...hudTextStyle, fontSize: 10 });


export const HUDGraphics: React.FC<HUDGraphicsProps> = React.memo(({ gameState }) => {
  const draw = React.useCallback((g: PIXI.Graphics) => {
    g.clear(); // Clear previous HUD drawing

    const hudY = C.GAME_VIEW_HEIGHT;
    const padding = 5;
    const sectionWidth = C.GAME_WIDTH / 3 - padding * 1.5;
    const scannerCenterX = C.GAME_WIDTH / 2;
    const scannerCenterY = hudY + C.HUD_HEIGHT / 2 + 5;
    const scannerRadius = C.HUD_HEIGHT / 2 - padding * 2;
    const scannerMaxDist = 800; // Max distance shown on scanner

    // --- Main HUD Box ---
    g.lineStyle(2, C.HUD_COLOR);
    g.drawRect(padding, hudY + padding, C.GAME_WIDTH - 2 * padding, C.HUD_HEIGHT - 2 * padding);

    // --- Left Panel ---
    const leftX = padding * 2;
    let currentLeftY = hudY + padding * 3;
    g.lineStyle(1, C.HUD_COLOR); // Thinner lines for details
    g.beginFill(C.HUD_COLOR); // For text
    // Replace fillText with g.drawText (requires Pixi v7+ Text support in Graphics or use Text component)
    // For simplicity here, we'll stick to shapes. Use Text component for actual text.
    // Example Text: SCANNER (use Text component instead)
    currentLeftY += 15;
     for (let i = 0; i < 4; i++) {
        g.drawRect(leftX, currentLeftY + i * 6, sectionWidth * 0.8, 4);
     }
    currentLeftY += 35;
    g.beginFill(C.HUD_ACCENT_COLOR);
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 4; j++) {
            g.drawRect(leftX + j * 10, currentLeftY + i * 10, 7, 7);
        }
    }
    g.beginFill(C.HUD_COLOR);
    for (let i = 0; i < 1; i++) {
        for (let j = 0; j < 4; j++) {
            g.drawRect(leftX + j * 10, currentLeftY - 10 + i * 10, 7, 7);
        }
    }
    g.endFill(); // Finish filling


    // --- Center Panel (Scanner) ---
    g.lineStyle(1.5, C.HUD_COLOR);
    g.drawEllipse(scannerCenterX, scannerCenterY, scannerRadius * 1.2, scannerRadius * 0.8);
    // Dotted lines (use dashed line methods if available, or draw segments)
    // Pixi Graphics doesn't have native setLineDash. Simulate or use TilingSprite.
    // Simple line approximation:
    g.lineStyle(1, C.HUD_COLOR);
    g.moveTo(scannerCenterX - scannerRadius * 1.2, scannerCenterY); g.lineTo(scannerCenterX + scannerRadius * 1.2, scannerCenterY);
    g.moveTo(scannerCenterX, scannerCenterY - scannerRadius * 0.8); g.lineTo(scannerCenterX, scannerCenterY + scannerRadius * 0.8);
    const diagOffsetX = scannerRadius * 1.2 * Math.cos(Math.PI / 4);
    const diagOffsetY = scannerRadius * 0.8 * Math.sin(Math.PI / 4);
    g.moveTo(scannerCenterX - diagOffsetX, scannerCenterY - diagOffsetY); g.lineTo(scannerCenterX + diagOffsetX, scannerCenterY + diagOffsetY);
    g.moveTo(scannerCenterX - diagOffsetX, scannerCenterY + diagOffsetY); g.lineTo(scannerCenterX + diagOffsetX, scannerCenterY - diagOffsetY);


    // Scanner Objects
    const drawScannerObject = (objX: number, objY: number, color: number, size: number) => {
        const dx = objX - gameState.player.x;
        const dy = objY - gameState.player.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0 && dist < scannerMaxDist) {
            const angle = Math.atan2(dy, dx);
            const displayDistRatio = dist / scannerMaxDist;
            // Scale position based on ellipse shape
            const displayX = scannerCenterX + Math.cos(angle) * displayDistRatio * (scannerRadius * 1.2);
            const displayY = scannerCenterY + Math.sin(angle) * displayDistRatio * (scannerRadius * 0.8);

            // Check if point is inside ellipse
             const normX = (displayX - scannerCenterX) / (scannerRadius * 1.2);
             const normY = (displayY - scannerCenterY) / (scannerRadius * 0.8);
             if(normX * normX + normY * normY <= 1) {
                g.beginFill(color);
                g.drawRect(Math.floor(displayX - size/2), Math.floor(displayY - size/2), size, size);
                g.endFill();
             }
        }
    };

    gameState.enemies.forEach(e => drawScannerObject(e.x, e.y, C.ENEMY_COLOR, 3));
    gameState.visibleBackgroundObjects.forEach(bgObj => {
        if (bgObj.type === 'station') {
            drawScannerObject(bgObj.x, bgObj.y, bgObj.color, 5);
        }
    });


    // --- Right Panel ---
    const rightX = C.GAME_WIDTH - padding * 2 - sectionWidth;
    let currentRightY = hudY + padding * 3;
    g.beginFill(C.HUD_COLOR);
    g.lineStyle(1, C.HUD_COLOR);
    // Example Text: SPACE (use Text component instead)
    g.drawRect(rightX + 45, currentRightY - 8, sectionWidth * 0.4, 8);
    currentRightY += 12;
    // Example Text: MIS (use Text component instead)
    g.drawRect(rightX + 45, currentRightY - 8, sectionWidth * 0.4, 8);
    currentRightY += 12;
    // Example Text: CS (use Text component instead)
    g.drawRect(rightX + 45, currentRightY - 8, sectionWidth * 0.4, 8);
    currentRightY += 15;
    for (let i = 0; i < 5; i++) {
        g.drawRect(rightX, currentRightY + i * 6, sectionWidth * 0.8, 4);
    }
    g.endFill(); // End fill for text placeholders

    // Bar Indicator
    const barIndicatorX = C.GAME_WIDTH - padding * 4 - 10;
    const barIndicatorY = hudY + padding * 3;
    const barIndicatorH = C.HUD_HEIGHT - padding * 6;
    g.lineStyle(1, C.HUD_COLOR);
    g.drawRect(barIndicatorX, barIndicatorY, 10, barIndicatorH);
    const fillHeight = barIndicatorH * 0.7; // Example fill level
    g.beginFill(C.HUD_COLOR);
    g.drawRect(barIndicatorX + 1, barIndicatorY + barIndicatorH - fillHeight + 1, 8, fillHeight - 2);
    g.endFill();
    for (let i = 1; i < 5; i++) {
        const tickY = barIndicatorY + (barIndicatorH / 5) * i;
        g.moveTo(barIndicatorX, tickY); g.lineTo(barIndicatorX + 10, tickY);
    }
    g.moveTo(barIndicatorX - 3, barIndicatorY + barIndicatorH); g.lineTo(barIndicatorX + 10 + 3, barIndicatorY + barIndicatorH);
    g.moveTo(barIndicatorX + 5, barIndicatorY + barIndicatorH); g.lineTo(barIndicatorX + 5, barIndicatorY + barIndicatorH + 5);
    g.stroke(); // Draw the lines


     // --- Add Text Elements using Text component (Example) ---
     // This part should ideally be separate Text components positioned correctly,
     // as Graphics text rendering is limited/deprecated in newer Pixi versions.

  }, [gameState]); // Redraw HUD when game state changes

  // Use Text components here for actual HUD text for better control and performance
  const hudY = C.GAME_VIEW_HEIGHT;
  const padding = 5;
  const leftX = padding * 2;
  const rightX = C.GAME_WIDTH - padding * 2 - (C.GAME_WIDTH / 3 - padding * 1.5);
  const scannerCenterX = C.GAME_WIDTH / 2;

  return (
    <>
      <pixiGraphics draw={draw} /> {/* Changed to lowercase 'p' */}
      {/* Example Text Components (Position based on calculations in draw) */}
      <pixiText text="SCANNER" x={leftX} y={hudY + padding * 3} style={hudTextStyle} /> {/* Changed to lowercase 'p' */}
      <pixiText text="ELITE" x={scannerCenterX} y={hudY + C.HUD_HEIGHT - padding * 2 - 8} style={hudTitleStyle} anchor={0.5} /> {/* Changed to lowercase 'p' */}
       <pixiText text="SPACE" x={rightX} y={hudY + padding * 3} style={hudSmallStyle} /> {/* Changed to lowercase 'p' */}
       <pixiText text=" MIS" x={rightX + 10} y={hudY + padding * 3 + 12} style={hudSmallStyle} /> {/* Changed to lowercase 'p' */}
       <pixiText text="  CS" x={rightX + 10} y={hudY + padding * 3 + 24} style={hudSmallStyle} /> {/* Changed to lowercase 'p' */}
    </>
    );
});
