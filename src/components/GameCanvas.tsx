// src/components/GameCanvas.tsx
import React, { memo } from "react";
import {
  Stage,
  Layer,
  Rect,
  Circle,
  Line,
  Text,
  Group,
  Shape,
  StageProps,
} from "react-konva";
import {
  IGameState,
  ITouchState,
  IPlayer,
  IEnemy,
  IProjectile,
  IStar,
  IStation,
} from "../game/types";
import * as C from "../game/config"; // Use C for brevity

interface GameCanvasProps {
  gameState: IGameState;
  touchState: ITouchState;
}

const canvasStyleBase: React.CSSProperties = {
  display: "block",
  backgroundColor: "#000",
  touchAction: "none", // Prevent default touch actions like scroll/zoom
  userSelect: "none", // Prevent text selection
  WebkitUserSelect: "none", // Safari
  msUserSelect: "none", // IE
  width: "100%", // Use CSS to control display size
  height: "100%",
  objectFit: "contain", // Scale the canvas content while maintaining aspect ratio
  maxWidth: `${C.GAME_WIDTH}px`, // Limit max CSS size to native res
  maxHeight: `${C.GAME_HEIGHT}px`, // Limit max CSS size to native res
  position: "relative", // Needed for absolute positioning of children
  zIndex: 1, // Base layer
};

// --- Konva Component Renderers ---

const KonvaStar: React.FC<{
  star: IStar;
  offsetX: number;
  offsetY: number;
}> = ({ star, offsetX, offsetY }) => {
  // Konva Rect draws from top-left
  return (
    <Rect
      key={star.id} // Add key prop here
      x={Math.floor(star.x - offsetX)}
      y={Math.floor(star.y - offsetY)}
      width={Math.ceil(star.size)}
      height={Math.ceil(star.size)}
      fill={star.color}
      perfectDrawEnabled={false} // Optimize for many simple shapes
      listening={false} // Stars don't need interaction
    />
  );
};

const KonvaStation: React.FC<{
  station: IStation;
  offsetX: number;
  offsetY: number;
}> = ({ station, offsetX, offsetY }) => {
  const screenX = station.x - offsetX;
  const screenY = station.y - offsetY;
  const r = station.radius;
  const angleDegrees = station.angle * (180 / Math.PI); // Konva uses degrees

  const points = [
    // Relative points for the octagon shape
    { x: -r, y: -r * 0.5 },
    { x: -r * 0.5, y: -r },
    { x: r * 0.5, y: -r },
    { x: r, y: -r * 0.5 },
    { x: r, y: r * 0.5 },
    { x: r * 0.5, y: r },
    { x: -r * 0.5, y: r },
    { x: -r, y: r * 0.5 },
  ];
  const flatPoints = points.reduce(
    (acc, p) => acc.concat(p.x, p.y),
    [] as number[]
  );
  const innerScale = 0.4;
  const detailScale = 0.7;

  return (
    <Group
      key={station.id} // Add key prop here
      x={screenX}
      y={screenY}
      rotation={angleDegrees}
      // Offset needed if rotation should be around the center
      offsetX={0}
      offsetY={0}
      listening={false}
    >
      {/* Main Octagon */}
      <Line
        points={flatPoints}
        stroke={station.color}
        strokeWidth={2}
        closed={true}
        perfectDrawEnabled={false}
      />
      {/* Inner structure lines */}
      <Line
        points={[
          points[3].x * innerScale,
          points[3].y * innerScale,
          points[3].x,
          points[3].y,
        ]}
        stroke={station.color}
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
      <Line
        points={[
          points[4].x * innerScale,
          points[4].y * innerScale,
          points[4].x,
          points[4].y,
        ]}
        stroke={station.color}
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
      <Rect
        x={points[3].x * innerScale}
        y={points[3].y * innerScale}
        width={(points[4].x - points[3].x) * innerScale}
        height={(points[4].y - points[3].y) * innerScale}
        stroke={station.color}
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
      <Line
        points={[
          points[1].x * detailScale,
          points[1].y * detailScale,
          points[1].x,
          points[1].y,
        ]}
        stroke={station.color}
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
      <Line
        points={[
          points[2].x * detailScale,
          points[2].y * detailScale,
          points[2].x,
          points[2].y,
        ]}
        stroke={station.color}
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
      <Line
        points={[
          points[5].x * detailScale,
          points[5].y * detailScale,
          points[5].x,
          points[5].y,
        ]}
        stroke={station.color}
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
      <Line
        points={[
          points[6].x * detailScale,
          points[6].y * detailScale,
          points[6].x,
          points[6].y,
        ]}
        stroke={station.color}
        strokeWidth={1}
        perfectDrawEnabled={false}
      />

      {/* Station Name Text - Rendered outside the rotated group */}
      {/* We'll handle this separately outside the KonvaStation component */}
    </Group>
  );
};

const KonvaPlayer: React.FC<{
  player: IPlayer;
  offsetX: number;
  offsetY: number;
}> = ({ player, offsetX, offsetY }) => {
  const screenX = player.x - offsetX;
  const screenY = player.y - offsetY;
  const r = player.radius;
  const angleDegrees = (player.angle + Math.PI / 2) * (180 / Math.PI); // Konva uses degrees, adjust angle

  const mainBodyPoints = [
    0,
    -r,
    r * 0.7,
    r * 0.7,
    0,
    r * 0.3,
    -r * 0.7,
    r * 0.7,
  ];
  const wing1Points = [-r * 0.7, r * 0.7, -r * 1.2, r * 0.5];
  const wing2Points = [r * 0.7, r * 0.7, r * 1.2, r * 0.5];

  return (
    <Group
      key={player.id} // Add key prop here
      x={screenX}
      y={screenY}
      rotation={angleDegrees}
      listening={false} // Player shape doesn't need clicks
    >
      <Line
        points={mainBodyPoints}
        stroke={player.color}
        strokeWidth={2}
        closed={true}
        perfectDrawEnabled={false}
      />
      <Line
        points={wing1Points}
        stroke={player.color}
        strokeWidth={2}
        closed={false}
        perfectDrawEnabled={false}
      />
      <Line
        points={wing2Points}
        stroke={player.color}
        strokeWidth={2}
        closed={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
};

const KonvaEnemy: React.FC<{
  enemy: IEnemy;
  offsetX: number;
  offsetY: number;
}> = ({ enemy, offsetX, offsetY }) => {
  const screenX = enemy.x - offsetX;
  const screenY = enemy.y - offsetY;
  const r = enemy.radius;
  const angleDegrees = (enemy.angle + Math.PI / 2) * (180 / Math.PI); // Konva uses degrees, adjust angle

  const shapePoints = [0, -r, r * 0.6, r * 0.8, 0, r * 0.4, -r * 0.6, r * 0.8];

  return (
    <Group
      key={enemy.id} // Add key prop here
      x={screenX}
      y={screenY}
      rotation={angleDegrees}
      listening={false}
    >
      <Line
        points={shapePoints}
        stroke={enemy.color}
        strokeWidth={1.5}
        closed={true}
        perfectDrawEnabled={false}
      />
    </Group>
  );
};

const KonvaProjectile: React.FC<{
  proj: IProjectile;
  offsetX: number;
  offsetY: number;
}> = ({ proj, offsetX, offsetY }) => {
  return (
    <Circle
      key={proj.id} // Add key prop here
      x={proj.x - offsetX}
      y={proj.y - offsetY}
      radius={proj.radius}
      fill={proj.color}
      perfectDrawEnabled={false}
      listening={false}
    />
  );
};

const KonvaHUD: React.FC<{
  player: IPlayer | null;
  cash: number;
  gameState: IGameState;
}> = ({ player, cash, gameState }) => {
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
  const currentLeftY = hudY + padding * 4 + 30; // Adjusted Y pos for shield label + bar
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
        y={hudY + padding * 4 + 30}
        fill={C.HUD_COLOR}
        fontSize={10}
        fontFamily="monospace"
      />

      {/* Shield Bar */}
      <Rect
        x={leftX}
        y={currentLeftY}
        width={shieldBarWidth}
        height={shieldBarHeight}
        fill={C.HUD_SHIELD_BAR_EMPTY_COLOR}
      />
      <Rect
        x={leftX}
        y={currentLeftY}
        width={shieldFillWidth}
        height={shieldBarHeight}
        fill={C.HUD_SHIELD_BAR_COLOR}
      />
      <Rect
        x={leftX}
        y={currentLeftY}
        width={shieldBarWidth}
        height={shieldBarHeight}
        stroke={C.HUD_COLOR}
        strokeWidth={1}
      />
      <Text
        text={`${Math.max(0, player.shieldLevel).toFixed(0)}%`}
        x={leftX}
        y={currentLeftY}
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

const KonvaTouchControls: React.FC<{ touchState: ITouchState }> = ({
  touchState,
}) => {
  return (
    <Group listening={false}>
      {/* Movement Joystick */}
      {touchState.move.active && (
        <>
          <Circle
            x={touchState.move.startX}
            y={touchState.move.startY}
            radius={C.TOUCH_JOYSTICK_OUTER_RADIUS}
            stroke={"rgba(255, 255, 255, 0.3)"}
            strokeWidth={2}
          />
          {(() => {
            const dx = touchState.move.currentX - touchState.move.startX;
            const dy = touchState.move.currentY - touchState.move.startY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const angle = dist > 0 ? Math.atan2(dy, dx) : 0;
            const clampedDist = Math.min(dist, C.TOUCH_JOYSTICK_OUTER_RADIUS);
            const stickX =
              touchState.move.startX + Math.cos(angle) * clampedDist;
            const stickY =
              touchState.move.startY + Math.sin(angle) * clampedDist;
            return (
              <Circle
                x={stickX}
                y={stickY}
                radius={C.TOUCH_JOYSTICK_INNER_RADIUS}
                fill={"rgba(255, 255, 255, 0.4)"}
              />
            );
          })()}
        </>
      )}
      {/* Shooting Indicator */}
      {touchState.shoot.active && (
        <>
          <Circle
            x={touchState.shoot.x}
            y={touchState.shoot.y}
            radius={C.TOUCH_SHOOT_INDICATOR_RADIUS}
            fill={"rgba(255, 0, 255, 0.2)"}
          />
          <Circle
            x={touchState.shoot.x}
            y={touchState.shoot.y}
            radius={C.TOUCH_SHOOT_INDICATOR_INNER_RADIUS}
            fill={"rgba(255, 0, 255, 0.5)"}
          />
        </>
      )}
    </Group>
  );
};

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, touchState }) => {
  // Dynamic style to hide canvas when not playing OR destroyed
  const stageStyle: React.CSSProperties = {
    ...canvasStyleBase,
    visibility:
      gameState.gameView === "playing" || gameState.gameView === "destroyed"
        ? "visible"
        : "hidden",
  };

  // Prevent rendering Konva stage if not initialized or hidden
  if (!gameState.isInitialized || stageStyle.visibility === "hidden") {
    // Render a placeholder or null to keep the container size
    return <div style={stageStyle} />;
  }

  const offsetX = gameState.camera.x;
  const offsetY = gameState.camera.y;

  return (
    // Cast props to StageProps to help TypeScript
    <Stage
      {...({
        width: C.GAME_WIDTH,
        height: C.GAME_HEIGHT,
        style: stageStyle,
      } as StageProps)}
    >
      {/* Background Layer (Stars, Stations) */}
      <Layer
        clipX={0}
        clipY={0}
        clipWidth={C.GAME_WIDTH}
        clipHeight={C.GAME_VIEW_HEIGHT} // Clip to game view area
        listening={false} // Optimization: Layer itself doesn't need events
        perfectDrawEnabled={false} // Optimize layer
      >
        {/* Stars */}
        {gameState.visibleBackgroundObjects
          .filter((obj) => obj.type === "star")
          .map((star) =>
            // Render the component directly
            KonvaStar({ star: star as IStar, offsetX, offsetY })
          )}
        {/* Stations */}
        {gameState.visibleBackgroundObjects
          .filter((obj) => obj.type === "station")
          .map((station) =>
            // Render the component directly
            KonvaStation({ station: station as IStation, offsetX, offsetY })
          )}
        {/* Station Names (Rendered separately for no rotation) */}
        {gameState.visibleBackgroundObjects
          .filter(
            (obj): obj is IStation =>
              obj.type === "station" && !!obj.name && obj.radius > 5
          )
          .map((station) => (
            <Text
              key={`${station.id}-name`}
              x={station.x - offsetX} // Centered horizontally
              y={station.y - offsetY - station.radius - 8 - 10} // Above station, adjust for text height
              text={station.name}
              fontSize={10}
              fontFamily="monospace"
              fill={station.color}
              align="center"
              listening={false}
              perfectDrawEnabled={false}
              // Removed offset and width/height which might conflict with align="center"
            />
          ))}
      </Layer>

      {/* Game Entities Layer (Player, Enemies, Projectiles) */}
      {/* FIX: Use ternary operator to return null instead of false */}
      {gameState.gameView !== "destroyed" ? (
        <Layer
          clipX={0}
          clipY={0}
          clipWidth={C.GAME_WIDTH}
          clipHeight={C.GAME_VIEW_HEIGHT}
          listening={false}
          perfectDrawEnabled={false}
        >
          {/* Enemies */}
          {gameState.enemies.map((enemy) =>
            KonvaEnemy({ enemy, offsetX, offsetY })
          )}
          {/* Projectiles */}
          {gameState.projectiles.map((proj) =>
            KonvaProjectile({ proj, offsetX, offsetY })
          )}
          {/* Player */}
          {gameState.player &&
            KonvaPlayer({ player: gameState.player, offsetX, offsetY })}
        </Layer>
      ) : null}

      {/* HUD Layer */}
      {/* FIX: Use ternary operator */}
      {gameState.gameView !== "destroyed" ? (
        <Layer
          // No clipping needed for HUD, drawn below game view height
          perfectDrawEnabled={false}
          listening={false}
        >
          <KonvaHUD
            player={gameState.player}
            cash={gameState.cash}
            gameState={gameState}
          />
        </Layer>
      ) : null}

      {gameState.gameView === "playing" ? (
        <Layer perfectDrawEnabled={false} listening={false}>
          <KonvaTouchControls touchState={touchState} />
        </Layer>
      ) : null}
    </Stage>
  );
};

// Memoize the component
export default memo(GameCanvas);
