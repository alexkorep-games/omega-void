/* src/components/canvas/KonvaHUD.tsx */
import React from "react";
import { Rect, Line, Text, Group, Shape } from "react-konva";
import { IGameState, IPlayer, IPosition } from "../../game/types";
import * as C from "../../game/config";

interface NavTargetInfo {
  id: string;
  name: string | null; // Name might not be easily available here
  coords: IPosition;
  direction: number; // Angle in radians from player to target
}

interface KonvaHUDProps {
  player: IPlayer | null;
  cash: number;
  gameState: IGameState; // Pass full gameState for scanner access and upgrades
  navTargetInfo: NavTargetInfo | null; // Optional navigation target info
}

const KonvaHUD: React.FC<KonvaHUDProps> = ({
  player,
  cash,
  gameState,
  navTargetInfo,
}) => {
  const hudY = C.GAME_VIEW_HEIGHT;
  const padding = 5;
  const scannerCenterX = C.GAME_WIDTH / 2;
  const scannerCenterY = hudY + C.HUD_HEIGHT / 2 + 5;
  const scannerRadiusX = (C.HUD_HEIGHT / 2 - padding * 2) * 1.2; // Ellipse radii
  const scannerRadiusY = (C.HUD_HEIGHT / 2 - padding * 2) * 0.8;
  const scannerMaxDist = C.SCANNER_MAX_DIST;

  if (!player) return null; // Don't draw HUD if player doesn't exist

  // --- Scanner Object Renderer ---
  const renderScannerObject = (
    objId: string, // Use ID for key and nav check
    objX: number,
    objY: number,
    baseColor: string,
    size: number
  ) => {
    const dx = objX - player.x;
    const dy = objY - player.y;
    const dist = Math.hypot(dx, dy);

    // Determine color based on nav target status
    const isNavTarget = navTargetInfo?.id === objId;
    const color = isNavTarget ? C.NAV_TARGET_COLOR : baseColor;
    const finalSize = isNavTarget ? size * 1.5 : size; // Make nav target bigger

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
            key={`scanner-${objId}`} // Use unique ID in key
            x={Math.floor(displayX - finalSize / 2)}
            y={Math.floor(displayY - finalSize / 2)}
            width={finalSize}
            height={finalSize}
            fill={color}
            perfectDrawEnabled={false}
            listening={false}
            shadowColor={isNavTarget ? C.NAV_TARGET_COLOR : undefined} // Optional glow
            shadowBlur={isNavTarget ? 5 : 0}
          />
        );
      }
    }
    return null;
  };

  // --- Shield Bar ---
  const leftX = padding * 2;
  const shieldLabelY = hudY + padding * 4 + 30;
  const shieldBarY = shieldLabelY + 12; // Space after label
  const shieldBarWidth = C.GAME_WIDTH / 3 - padding * 6;
  const shieldBarHeight = 10;
  // Use maxShield from player object
  const shieldFillWidth =
    player.maxShield > 0
      ? Math.max(0, (player.shieldLevel / player.maxShield) * shieldBarWidth)
      : 0;

  // --- Nav Indicator ---
  const navIndicatorSize = 8; // Adjust size as needed

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
      {/* Display Nav Target ID if active */}
      <Text
        text={navTargetInfo ? navTargetInfo.id.split("_")[1] : "LOCAL"} // Show Cell X part of ID or LOCAL
        x={leftX + 40}
        y={hudY + padding * 4 + 15}
        fill={navTargetInfo ? C.NAV_TARGET_COLOR : C.HUD_ACCENT_COLOR}
        fontSize={10}
        fontFamily="monospace"
        ellipsis={true}
        width={C.GAME_WIDTH / 3 - leftX - 45} // Prevent overflow
      />

      {/* Display Distance if Nav Computer installed and target exists */}
      {gameState.cold.hasNavComputer && gameState.cold.navTargetDistance !== null && (
        <Text
          text={`DIST:`}
          x={leftX}
          y={hudY + padding * 4 + 15 + 15} // Below NAV line
          fill={C.HUD_COLOR}
          fontSize={10}
          fontFamily="monospace"
        />
      )}
      {gameState.cold.hasNavComputer && gameState.cold.navTargetDistance !== null && (
        <Text
          text={gameState.cold.navTargetDistance.toFixed(0)}
          x={leftX + 40}
          y={hudY + padding * 4 + 15 + 15} // Below NAV line
          fill={C.NAV_TARGET_COLOR}
          fontSize={10}
          fontFamily="monospace"
        />
      )}

      {/* --- Navigation Indicator (Dot on Circle) --- */}
      {navTargetInfo && // Only draw if there is a nav target
        (() => {
          const angle = navTargetInfo.direction; // Direction in radians
          const displayX = scannerCenterX + Math.cos(angle) * scannerRadiusX;
          const displayY = scannerCenterY + Math.sin(angle) * scannerRadiusY;

          // Check if the target station is visible on the scanner
          const isTargetVisible = gameState.hot.visibleBackgroundObjects.some(
            (bg) => bg.id === navTargetInfo.id
          );

          if (isTargetVisible) return null; // Hide the indicator if the target is visible

          return (
            <Rect
              x={displayX - navIndicatorSize / 2} // Center the dot
              y={displayY - navIndicatorSize / 2}
              width={navIndicatorSize}
              height={navIndicatorSize}
              fill={C.NAV_TARGET_COLOR} // Fill with navigation target color
              stroke={C.NAV_TARGET_COLOR} // Outline with the same color
              strokeWidth={1} // Thin outline
              perfectDrawEnabled={false} // Optimization for simple shapes
              listening={false}
            />
          );
        })()}

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
        // Display current / max shield
        text={`${player.shieldLevel.toFixed(0)}/${player.maxShield.toFixed(0)}`}
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
      {gameState.hot.enemies.map((e) =>
        renderScannerObject(e.id, e.x, e.y, C.ENEMY_COLOR, 3)
      )}
      {gameState.hot.projectiles.map((p) =>
        renderScannerObject(p.id, p.x, p.y, C.PROJECTILE_COLOR, 1)
      )}
      {gameState.hot.visibleBackgroundObjects
        .filter((bg) => bg.type === "station")
        .map((s) =>
          renderScannerObject(s.id, s.x, s.y, s.color || C.STATION_COLOR, 5)
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
        text={`NONE`} // Targeting system not implemented yet
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
