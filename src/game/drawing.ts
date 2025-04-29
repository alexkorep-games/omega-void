// src/game/drawing.ts
import {
  IGameState,
  IPlayer,
  IEnemy,
  IProjectile,
  IStar,
  IStation,
  ITouchState,
} from "./types";
import * as C from "./config"; // Use C for brevity

type Ctx = CanvasRenderingContext2D;

// --- Entity Drawing Helpers ---

function drawPlayer(
  ctx: Ctx,
  player: IPlayer,
  offsetX: number,
  offsetY: number
): void {
  const screenX = player.x - offsetX;
  const screenY = player.y - offsetY;
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(player.angle + Math.PI / 2); // Adjust angle for drawing
  ctx.strokeStyle = player.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Ship shape (adjust as needed)
  ctx.moveTo(0, -player.radius);
  ctx.lineTo(player.radius * 0.7, player.radius * 0.7);
  ctx.lineTo(0, player.radius * 0.3);
  ctx.lineTo(-player.radius * 0.7, player.radius * 0.7);
  ctx.closePath();
  // Wings/details
  ctx.moveTo(-player.radius * 0.7, player.radius * 0.7);
  ctx.lineTo(-player.radius * 1.2, player.radius * 0.5);
  ctx.moveTo(player.radius * 0.7, player.radius * 0.7);
  ctx.lineTo(player.radius * 1.2, player.radius * 0.5);
  ctx.stroke();
  ctx.restore();
}

function drawEnemy(
  ctx: Ctx,
  enemy: IEnemy,
  offsetX: number,
  offsetY: number
): void {
  const screenX = enemy.x - offsetX;
  const screenY = enemy.y - offsetY;
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(enemy.angle + Math.PI / 2); // Adjust angle for drawing
  ctx.strokeStyle = enemy.color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // Enemy shape (adjust as needed)
  ctx.moveTo(0, -enemy.radius);
  ctx.lineTo(enemy.radius * 0.6, enemy.radius * 0.8);
  ctx.lineTo(0, enemy.radius * 0.4);
  ctx.lineTo(-enemy.radius * 0.6, enemy.radius * 0.8);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawProjectile(
  ctx: Ctx,
  proj: IProjectile,
  offsetX: number,
  offsetY: number
): void {
  ctx.fillStyle = proj.color;
  ctx.beginPath();
  ctx.arc(proj.x - offsetX, proj.y - offsetY, proj.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawStar(
  ctx: Ctx,
  star: IStar,
  offsetX: number,
  offsetY: number
): void {
  ctx.fillStyle = star.color;
  // Use Math.floor for position and Math.ceil for size for pixel-perfect rendering
  ctx.fillRect(
    Math.floor(star.x - offsetX),
    Math.floor(star.y - offsetY),
    Math.ceil(star.size),
    Math.ceil(star.size)
  );
}

function drawStation(
  ctx: Ctx,
  station: IStation,
  offsetX: number,
  offsetY: number
): void {
  const screenX = station.x - offsetX;
  const screenY = station.y - offsetY;
  const r = station.radius;
  const angle = station.angle; // Use the pre-calculated angle

  // --- Draw Station Geometry (Rotated) ---
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(angle);

  ctx.strokeStyle = station.color;
  ctx.lineWidth = 2;
  const points = [
    { x: -r, y: -r * 0.5 },
    { x: -r * 0.5, y: -r },
    { x: r * 0.5, y: -r },
    { x: r, y: -r * 0.5 },
    { x: r, y: r * 0.5 },
    { x: r * 0.5, y: r },
    { x: -r * 0.5, y: r },
    { x: -r, y: r * 0.5 },
  ];
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.stroke();
  // Inner structure
  const innerScale = 0.4;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(points[3].x * innerScale, points[3].y * innerScale);
  ctx.lineTo(points[3].x, points[3].y);
  ctx.moveTo(points[4].x * innerScale, points[4].y * innerScale);
  ctx.lineTo(points[4].x, points[4].y);
  ctx.rect(
    points[3].x * innerScale,
    points[3].y * innerScale,
    (points[4].x - points[3].x) * innerScale,
    (points[4].y - points[3].y) * innerScale
  );
  const detailScale = 0.7;
  ctx.moveTo(points[1].x * detailScale, points[1].y * detailScale);
  ctx.lineTo(points[1].x, points[1].y);
  ctx.moveTo(points[2].x * detailScale, points[2].y * detailScale);
  ctx.lineTo(points[2].x, points[2].y);
  ctx.moveTo(points[5].x * detailScale, points[5].y * detailScale);
  ctx.lineTo(points[5].x, points[5].y);
  ctx.moveTo(points[6].x * detailScale, points[6].y * detailScale);
  ctx.lineTo(points[6].x, points[6].y);
  ctx.stroke();

  ctx.restore(); // Restore context state AFTER station transform (removes rotation)
  // --- End Station Geometry ---

  // --- Draw Station Name (Unrotated, Above, No Scaling) ---
  if (station.name && r > 5) {
    // Check if name exists and station is minimally visible
    const fontSize = 10; // Fixed font size
    const paddingAbove = 8; // Pixels above station top

    ctx.save(); // Isolate text transformations/settings

    // Calculate position for the bottom-center of the text
    const textX = screenX; // Center horizontally with station
    const textY = screenY - r - paddingAbove; // Position above station

    // Set drawing properties
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = station.color;

    // Draw the text at the calculated position
    ctx.fillText(station.name, textX, textY);

    ctx.restore(); // Restore context state
  }
}

// --- HUD and Controls Drawing ---

function drawHUD(ctx: Ctx, player: IPlayer, cash: number): void {
  const hudY = C.GAME_VIEW_HEIGHT;
  const padding = 5;
  // const sectionWidth = C.GAME_WIDTH / 3 - padding * 4; // Not directly used now
  const scannerCenterX = C.GAME_WIDTH / 2;
  const scannerCenterY = hudY + C.HUD_HEIGHT / 2 + 5;
  const scannerRadius = C.HUD_HEIGHT / 2 - padding * 2;
  // const scannerMaxDist = C.SCANNER_MAX_DIST; // Moved to main drawGame

  ctx.strokeStyle = C.HUD_COLOR;
  ctx.fillStyle = C.HUD_COLOR;
  ctx.lineWidth = 1.5; // Slightly thinner HUD lines
  ctx.strokeRect(
    padding,
    hudY + padding,
    C.GAME_WIDTH - 2 * padding,
    C.HUD_HEIGHT - 2 * padding
  );
  // Separator lines
  ctx.beginPath();
  ctx.moveTo(C.GAME_WIDTH / 3, hudY + padding);
  ctx.lineTo(C.GAME_WIDTH / 3, C.GAME_HEIGHT - padding);
  ctx.moveTo((C.GAME_WIDTH * 2) / 3, hudY + padding);
  ctx.lineTo((C.GAME_WIDTH * 2) / 3, C.GAME_HEIGHT - padding);
  ctx.stroke();

  // --- Left Panel (simplified) ---
  const leftX = padding * 2;
  let currentLeftY = hudY + padding * 4;
  ctx.font = "10px monospace";
  ctx.fillText("CASH:", leftX, currentLeftY);
  ctx.fillStyle = "#00FF00"; // Green cash
  ctx.fillText(`${cash.toFixed(1)} CR`, leftX + 40, currentLeftY);
  ctx.fillStyle = C.HUD_COLOR; // Reset fill color
  currentLeftY += 15;
  ctx.fillText("NAV:", leftX, currentLeftY);
  ctx.fillStyle = C.HUD_ACCENT_COLOR;
  ctx.fillText("LOCAL", leftX + 40, currentLeftY);
  ctx.fillStyle = C.HUD_COLOR; // Reset fill color
  currentLeftY += 15;

  // Shield Bar
  ctx.fillText("SHIELD:", leftX, currentLeftY);
  currentLeftY += 12;
  const shieldBarWidth = C.GAME_WIDTH / 3 - padding * 6;
  const shieldBarHeight = 10;
  // Background
  ctx.fillStyle = C.HUD_SHIELD_BAR_EMPTY_COLOR;
  ctx.fillRect(leftX, currentLeftY, shieldBarWidth, shieldBarHeight);
  // Fill
  const shieldFillWidth = Math.max(
    0,
    (player.shieldLevel / 100) * shieldBarWidth
  ); // Ensure non-negative width
  ctx.fillStyle = C.HUD_SHIELD_BAR_COLOR;
  ctx.fillRect(leftX, currentLeftY, shieldFillWidth, shieldBarHeight);
  // Border
  ctx.strokeStyle = C.HUD_COLOR;
  ctx.lineWidth = 1;
  ctx.strokeRect(leftX, currentLeftY, shieldBarWidth, shieldBarHeight);
  // Percentage Text (optional, centered on bar)
  ctx.fillStyle = C.HUD_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "8px monospace";
  ctx.fillText(
    `${Math.max(0, player.shieldLevel).toFixed(0)}%`,
    leftX + shieldBarWidth / 2,
    currentLeftY + shieldBarHeight / 2 + 1
  ); // Ensure non-negative display
  ctx.textAlign = "left"; // Reset alignment
  ctx.textBaseline = "alphabetic"; // Reset baseline

  // --- Center Panel (Scanner) ---
  // Scanner Ellipse
  ctx.strokeStyle = C.HUD_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(
    scannerCenterX,
    scannerCenterY,
    scannerRadius * 1.2,
    scannerRadius * 0.8,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  // Scanner Grid Lines
  ctx.setLineDash([2, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(scannerCenterX - scannerRadius * 1.2, scannerCenterY);
  ctx.lineTo(scannerCenterX + scannerRadius * 1.2, scannerCenterY);
  ctx.moveTo(scannerCenterX, scannerCenterY - scannerRadius * 0.8);
  ctx.lineTo(scannerCenterX, scannerCenterY + scannerRadius * 0.8);
  ctx.stroke();
  ctx.setLineDash([]); // Reset dashes

  // --- Draw player in center of scanner (always) ---
  ctx.fillStyle = C.PLAYER_COLOR;
  ctx.fillRect(scannerCenterX - 1, scannerCenterY - 1, 3, 3);

  // --- Right Panel (simplified) ---
  const rightX = (C.GAME_WIDTH * 2) / 3 + padding * 2;
  let currentRightY = hudY + padding * 4;
  ctx.font = "10px monospace";
  ctx.fillText("STATUS", rightX, currentRightY);
  currentRightY += 15;
  ctx.fillText("Target:", rightX, currentRightY);
  ctx.fillStyle = C.HUD_ACCENT_COLOR;
  ctx.fillText("NONE", rightX + 50, currentRightY);
  ctx.fillStyle = C.HUD_COLOR; // Reset fill color
  currentRightY += 15;
}

function drawTouchControls(ctx: Ctx, touchState: ITouchState): void {
  // Movement Joystick
  if (touchState.move.active) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      touchState.move.startX,
      touchState.move.startY,
      C.TOUCH_JOYSTICK_OUTER_RADIUS,
      0,
      Math.PI * 2
    );
    ctx.stroke();

    const dx = touchState.move.currentX - touchState.move.startX;
    const dy = touchState.move.currentY - touchState.move.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = dist > 0 ? Math.atan2(dy, dx) : 0;
    const clampedDist = Math.min(dist, C.TOUCH_JOYSTICK_OUTER_RADIUS);
    const stickX = touchState.move.startX + Math.cos(angle) * clampedDist;
    const stickY = touchState.move.startY + Math.sin(angle) * clampedDist;

    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.beginPath();
    ctx.arc(stickX, stickY, C.TOUCH_JOYSTICK_INNER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shooting Indicator
  if (touchState.shoot.active) {
    ctx.fillStyle = "rgba(255, 0, 255, 0.2)"; // Magenta, semi-transparent
    ctx.beginPath();
    ctx.arc(
      touchState.shoot.x,
      touchState.shoot.y,
      C.TOUCH_SHOOT_INDICATOR_RADIUS,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = "rgba(255, 0, 255, 0.5)"; // Magenta, less transparent
    ctx.beginPath();
    ctx.arc(
      touchState.shoot.x,
      touchState.shoot.y,
      C.TOUCH_SHOOT_INDICATOR_INNER_RADIUS,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

// --- Main Drawing Orchestrator ---

export function drawGame(
  ctx: Ctx,
  state: IGameState,
  touchState: ITouchState
): void {
  const scannerMaxDist = C.SCANNER_MAX_DIST; // Define here for scanner drawing access
  // Clear canvas
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, C.GAME_WIDTH, C.GAME_HEIGHT);

  // --- Draw Game View ---
  ctx.save();
  // Clip to game area (above HUD)
  ctx.rect(0, 0, C.GAME_WIDTH, C.GAME_VIEW_HEIGHT);
  ctx.clip();
  // Disable smoothing for pixelated look
  ctx.imageSmoothingEnabled = false;

  const offsetX = state.camera.x;
  const offsetY = state.camera.y;

  // --- Handle Destroyed View ---
  if (state.gameView === "destroyed") {
    // Only draw background? Or nothing in game view?
    // Explosion is drawn by DestructionAnimation component now.
    // We can draw stars/stations still.
  }

  // Draw Background Objects (Stars and Stations)
  state.visibleBackgroundObjects.forEach((obj) => {
    // Basic culling (can be refined)
    const screenX = obj.x - offsetX;
    const screenY = obj.y - offsetY;
    const size = obj.type === "star" ? obj.size : obj.radius * 2; // Approx size for culling
    if (
      screenX > -size - 50 &&
      screenX < C.GAME_WIDTH + 50 &&
      screenY > -size - 50 &&
      screenY < C.GAME_VIEW_HEIGHT + 50
    ) {
      if (obj.type === "star") {
        drawStar(ctx, obj, offsetX, offsetY);
      } else if (obj.type === "station") {
        drawStation(ctx, obj, offsetX, offsetY);
      }
    }
  });

  // Draw Game Entities (only if not destroyed)
  if (state.gameView !== "destroyed") {
    state.enemies.forEach((enemy) => drawEnemy(ctx, enemy, offsetX, offsetY));
    state.projectiles.forEach((proj) =>
      drawProjectile(ctx, proj, offsetX, offsetY)
    );
    // Ensure player object exists before drawing
    if (state.player) {
      drawPlayer(ctx, state.player, offsetX, offsetY);
    }
  }

  ctx.restore(); // Remove clipping

  // --- Draw HUD (only if not destroyed and player exists) ---
  if (state.gameView !== "destroyed" && state.player) {
    // Moved Scanner Drawing Logic Here from drawHUD
    const hudY = C.GAME_VIEW_HEIGHT;
    const padding = 5;
    const scannerCenterX = C.GAME_WIDTH / 2;
    const scannerCenterY = hudY + C.HUD_HEIGHT / 2 + 5;
    const scannerRadius = C.HUD_HEIGHT / 2 - padding * 2;

    const drawScannerObject = (
      objX: number,
      objY: number,
      color: string,
      size: number
    ) => {
      const dx = objX - state.player.x;
      const dy = objY - state.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < scannerMaxDist && dist > 0) {
        // Don't draw player self on scanner
        const angle = Math.atan2(dy, dx);
        // Project onto ellipse shape
        const displayDist = dist / scannerMaxDist;
        const displayX =
          scannerCenterX + Math.cos(angle) * displayDist * scannerRadius * 1.2;
        const displayY =
          scannerCenterY + Math.sin(angle) * displayDist * scannerRadius * 0.8;

        // Check if inside the ellipse bounds before drawing
        const normalizedX = (displayX - scannerCenterX) / (scannerRadius * 1.2);
        const normalizedY = (displayY - scannerCenterY) / (scannerRadius * 0.8);
        if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) {
          ctx.fillStyle = color;
          ctx.fillRect(
            Math.floor(displayX - size / 2),
            Math.floor(displayY - size / 2),
            size,
            size
          );
        }
      }
    };

    // Clear previous scanner objects (needed if drawn every frame)
    // Alternatively, redraw the scanner background elements in drawHUD

    // Draw Objects
    state.enemies.forEach((e) => drawScannerObject(e.x, e.y, C.ENEMY_COLOR, 3));
    state.projectiles.forEach((p) =>
      drawScannerObject(p.x, p.y, C.PROJECTILE_COLOR, 1)
    );
    state.visibleBackgroundObjects.forEach((bgObj) => {
      if (bgObj.type === "station") {
        drawScannerObject(bgObj.x, bgObj.y, bgObj.color || C.STATION_COLOR, 5);
      }
    });

    // Draw HUD Frame and Info Panels
    drawHUD(ctx, state.player, state.cash);
  }

  // --- Draw Touch Controls (only if playing) ---
  if (state.gameView === "playing") {
    drawTouchControls(ctx, touchState);
  }
}
