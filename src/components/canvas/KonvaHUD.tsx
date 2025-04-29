import React from "react";
import { Rect, Line, Text, Group, Shape } from "react-konva";
import { IGameState, IPlayer } from "../../game/types";
import * as C from "../../game/config";

interface KonvaHUDProps {
  player: IPlayer | null;
  cash: number;
  gameState: IGameState;
}

const KonvaHUD: React.FC<KonvaHUDProps> = ({ player, cash, gameState }) => {
  const hudY = C.GAME_VIEW_HEIGHT;
  const padding = 5;
  const scannerCenterX = C.GAME_WIDTH / 2;
  const scannerCenterY = hudY + C.HUD_HEIGHT / 2 + 5;
  const scannerRadiusX = (C.HUD_HEIGHT / 2 - padding * 2) * 1.2; // Ellipse radii
  const scannerRadiusY = (C.HUD_HEIGHT / 2 - padding * 2) * 0.8;
  const scannerMaxDist = C.SCANNER_MAX_DIST;

  if (!player) return null; // Don't draw HUD if player doesn't exist (e.g., destroyed view starting)

  // --- Scanner Object Renderer ---
  const renderScannerObject = (
    objX: number,
    objY: number,
    color: string,
    size: number,
    key: string
  ) => {
    // Add key param
    const dx = objX - player.x;
    const dy = objY - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < scannerMaxDist && dist > 0) {
      const angle = Math.atan2(dy, dx);
      const displayDist = dist / scannerMaxDist; // Ratio 0 to 1
      const displayX =
        scannerCenterX + Math.cos(angle) * displayDist * scannerRadiusX;
      const displayY =
        scannerCenterY + Math.sin(angle) * displayDist * scannerRadiusY;

      // Check if inside the ellipse bounds before drawing
      const normalizedX = (displayX - scannerCenterX) / scannerRadiusX;
      const normalizedY = (displayY - scannerCenterY) / scannerRadiusY;
      if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) {
        return (
          <Rect
            key={key} // Use passed key
            x={Math.floor(displayX - size / 2)}
            y={Math.floor(displayY - size / 2)}
            width={size}
            height={size}
            fill={color}
            perfectDrawEnabled={false}
            listening={false}
          />
        );
      }
    }
    return null;
  };

  // --- Shield Bar ---
  const leftX = padding * 2;
  // Adjust Y pos to account for font size and line height of "SHIELD:" text
  const shieldLabelY = hudY + padding * 4 + 30;
  const shieldBarY = shieldLabelY + 12; // Space after label
  const shieldBarWidth = C.GAME_WIDTH / 3 - padding * 6;
  const shieldBarHeight = 10;
  const shieldFillWidth = Math.max(
    0,
    (player.shieldLevel / 100) * shieldBarWidth
  );

  return (
    <Group listening={false}>
      {/* HUD Outline */}
      <Rect
        x={padding}
        y={hudY + padding}
        width={C.GAME_WIDTH - 2 * padding}
        height={C.HUD_HEIGHT - 2 * padding}
        stroke={C.HUD_COLOR}
        strokeWidth={1.5}
      />
      {/* Separator Lines */}
      <Line
        points={[
          C.GAME_WIDTH / 3,
          hudY + padding,
          C.GAME_WIDTH / 3,
          C.GAME_HEIGHT - padding,
        ]}
        stroke={C.HUD_COLOR}
        strokeWidth={1.5}
      />
      <Line
        points={[
          (C.GAME_WIDTH * 2) / 3,
          hudY + padding,
          (C.GAME_WIDTH * 2) / 3,
          C.GAME_HEIGHT - padding,
        ]}
        stroke={C.HUD_COLOR}
        strokeWidth={1.5}
      />

      {/* Left Panel Text */}
      <Text
        text={`CASH:`}
        x={leftX}
        y={hudY + padding * 4}
        fill={C.HUD_COLOR}
        fontSize={10}
        fontFamily="monospace"
      />
      <Text
        text={`${cash.toFixed(1)} CR`}
        x={leftX + 40}
        y={hudY + padding * 4}
        fill="#00FF00"
        fontSize={10}
        fontFamily="monospace"
      />
      <Text
        text={`NAV:`}
        x={leftX}
        y={hudY + padding * 4 + 15}
        fill={C.HUD_COLOR}
        fontSize={10}
        fontFamily="monospace"
      />
      <Text
        text={`LOCAL`}
        x={leftX + 40}
        y={hudY + padding * 4 + 15}
        fill={C.HUD_ACCENT_COLOR}
        fontSize={10}
        fontFamily="monospace"
      />
      <Text
        text={`SHIELD:`}
        x={leftX}
        y={shieldLabelY} // Use calculated label Y
        fill={C.HUD_COLOR}
        fontSize={10}
        fontFamily="monospace"
      />

      {/* Shield Bar */}
      <Rect
        x={leftX}
        y={shieldBarY} // Use calculated bar Y
        width={shieldBarWidth}
        height={shieldBarHeight}
        fill={C.HUD_SHIELD_BAR_EMPTY_COLOR}
      />
      <Rect
        x={leftX}
        y={shieldBarY}
        width={shieldFillWidth}
        height={shieldBarHeight}
        fill={C.HUD_SHIELD_BAR_COLOR}
      />
      <Rect
        x={leftX}
        y={shieldBarY}
        width={shieldBarWidth}
        height={shieldBarHeight}
        stroke={C.HUD_COLOR}
        strokeWidth={1}
      />
      <Text
        text={`${Math.max(0, player.shieldLevel).toFixed(0)}%`}
        x={leftX}
        y={shieldBarY}
        width={shieldBarWidth}
        height={shieldBarHeight}
        fill={C.HUD_COLOR}
        fontSize={8}
        fontFamily="monospace"
        align="center"
        verticalAlign="middle"
        padding={1}
      />

      {/* Center Panel (Scanner) */}
      <Shape
        sceneFunc={(context) => {
          context.beginPath();
          context.ellipse(
            scannerCenterX,
            scannerCenterY,
            scannerRadiusX,
            scannerRadiusY,
            0,
            0,
            Math.PI * 2
          );
          // context.closePath(); // No need for ellipse
          context.setAttr("strokeStyle", C.HUD_COLOR);
          context.setAttr("lineWidth", 1.5);
          context.stroke();
        }}
      />
      <Line
        points={[
          scannerCenterX - scannerRadiusX,
          scannerCenterY,
          scannerCenterX + scannerRadiusX,
          scannerCenterY,
        ]}
        stroke={C.HUD_COLOR}
        strokeWidth={1}
        dash={[2, 3]}
      />
      <Line
        points={[
          scannerCenterX,
          scannerCenterY - scannerRadiusY,
          scannerCenterX,
          scannerCenterY + scannerRadiusY,
        ]}
        stroke={C.HUD_COLOR}
        strokeWidth={1}
        dash={[2, 3]}
      />
      {/* Player blip */}
      <Rect
        x={scannerCenterX - 1}
        y={scannerCenterY - 1}
        width={3}
        height={3}
        fill={C.PLAYER_COLOR}
      />
      {/* Scanner Objects */}
      {gameState.enemies.map((e) =>
        renderScannerObject(e.x, e.y, C.ENEMY_COLOR, 3, `scanner-${e.id}`)
      )}
      {gameState.projectiles.map((p) =>
        renderScannerObject(p.x, p.y, C.PROJECTILE_COLOR, 1, `scanner-${p.id}`)
      )}
      {gameState.visibleBackgroundObjects
        .filter((bg) => bg.type === "station")
        .map((s) =>
          renderScannerObject(
            s.x,
            s.y,
            s.color || C.STATION_COLOR,
            5,
            `scanner-${s.id}`
          )
        )}

      {/* Right Panel Text */}
      <Text
        text={`STATUS`}
        x={(C.GAME_WIDTH * 2) / 3 + padding * 2}
        y={hudY + padding * 4}
        fill={C.HUD_COLOR}
        fontSize={10}
        fontFamily="monospace"
      />
      <Text
        text={`Target:`}
        x={(C.GAME_WIDTH * 2) / 3 + padding * 2}
        y={hudY + padding * 4 + 15}
        fill={C.HUD_COLOR}
        fontSize={10}
        fontFamily="monospace"
      />
      <Text
        text={`NONE`}
        x={(C.GAME_WIDTH * 2) / 3 + padding * 2 + 50}
        y={hudY + padding * 4 + 15}
        fill={C.HUD_ACCENT_COLOR}
        fontSize={10}
        fontFamily="monospace"
      />
    </Group>
  );
};

export default KonvaHUD;
