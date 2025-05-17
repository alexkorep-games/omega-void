import React, { memo, useMemo } from "react";
import { Stage, Layer, Text, Group, StageProps } from "react-konva";
import {
  IGameState,
  ITouchState,
  IStar,
  IStation,
  IPosition,
  IBeacon,
} from "../game/types";
import * as C from "../game/config"; // Use C for brevity

// Import individual Konva components
import KonvaStar from "./canvas/KonvaStar";
import KonvaStation from "./canvas/KonvaStation";
import KonvaPlayer from "./canvas/KonvaPlayer";
import KonvaEnemy from "./canvas/KonvaEnemy";
import KonvaProjectile from "./canvas/KonvaProjectile";
import KonvaHUD from "./canvas/KonvaHUD";
import KonvaTouchControls from "./canvas/KonvaTouchControls";
import KonvaDestructionParticle from "./canvas/KonvaDestructionParticle";
import KonvaAsteroid from "./canvas/KonvaAsteroid"; // Import Asteroid renderer
import KonvaBeacon from "./canvas/KonvaBeacon"; // Import Beacon renderer
import Konva from "konva";

// --- Interfaces ---
interface GameCanvasProps {
  gameState: IGameState;
  touchState: ITouchState;
  layerRef: React.RefObject<Konva.Layer | null>;
  counter: number;
}

// --- Canvas Styling ---
const canvasStyleBase: React.CSSProperties = {
  display: "block",
  backgroundColor: "#000",
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  msUserSelect: "none",
  width: "100%",
  height: "100%",
  objectFit: "contain",
  maxWidth: `${C.GAME_WIDTH}px`,
  maxHeight: `${C.GAME_HEIGHT}px`,
  position: "relative",
  zIndex: 1,
};

// --- Main GameCanvas Component ---
const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, touchState, layerRef, counter }) => {
  const stageStyle: React.CSSProperties = {
    ...canvasStyleBase,
    visibility:
      gameState.cold.gameView === "playing" || gameState.cold.gameView === "destroyed"
        ? "visible"
        : "hidden",
  };

  // Get current time for animations - useMemo ensures it's fetched on relevant re-renders
  // Depends on the array of animations itself (for adding/removing) and the game view (to trigger re-render on view change)
  const now = performance.now();

  // Navigation Target Data (for HUD)
  const navTargetInfo: {
    id: string;
    name: string | null;
    coords: IPosition;
    direction: number;
  } | null = useMemo(() => {
    if (
      gameState.cold.navTargetStationId &&
      gameState.cold.navTargetDirection !== null &&
      gameState.cold.navTargetCoordinates
    ) {
      // We need the name for the HUD, but `findStationById` is in the hook.
      // For now, we'll pass null and maybe enhance later if needed.
      return {
        id: gameState.cold.navTargetStationId,
        name: null, // We don't have easy access to the full station object here
        coords: gameState.cold.navTargetCoordinates,
        direction: gameState.cold.navTargetDirection,
      };
    }
    return null;
  }, [
    gameState.cold.navTargetStationId,
    gameState.cold.navTargetDirection,
    gameState.cold.navTargetCoordinates,
  ]);

  if (!gameState.cold.isInitialized || stageStyle.visibility === "hidden") {
    return <div style={stageStyle} />;
  }

  const offsetX = gameState.hot.camera.x;
  const offsetY = gameState.hot.camera.y;

  return (
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
        ref={layerRef}
      >
        {/* Stars */}
        {gameState.hot.visibleBackgroundObjects
          .filter((obj) => obj.type === "star")
          .map((star) => (
            <KonvaStar
              key={star.id}
              star={star as IStar}
              offsetX={offsetX}
              offsetY={offsetY}
            />
          ))}
        {/* Stations */}
        {gameState.hot.visibleBackgroundObjects
          .filter((obj) => obj.type === "station")
          .map((station) => (
            <KonvaStation
              key={station.id}
              station={station as IStation}
              offsetX={offsetX}
              offsetY={offsetY}
              isNavTarget={station.id === gameState.cold.navTargetStationId}
            />
          ))}
        {/* Asteroids */}
        {gameState.hot.visibleBackgroundObjects
          .filter((obj) => obj.type === "asteroid")
          .map((asteroid) => (
            <KonvaAsteroid
              key={asteroid.id}
              asteroid={asteroid}
              offsetX={offsetX}
              offsetY={offsetY}
            />
          ))}
        {/* Beacons */}
        {gameState.hot.visibleBackgroundObjects
          .filter((obj) => obj.type === "beacon")
          .map((beacon) => (
            <KonvaBeacon
              key={beacon.id}
              beacon={beacon as IBeacon}
              offsetX={offsetX}
              offsetY={offsetY}
            />
          ))}
        {/* Station Names (Rendered separately for no rotation) */}
        {gameState.hot.visibleBackgroundObjects
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
              fill={
                station.id === gameState.cold.navTargetStationId
                  ? C.NAV_TARGET_COLOR
                  : station.color
              }
              align="center"
              listening={false}
              perfectDrawEnabled={false}
            />
          ))}
      </Layer>

      {/* Game Entities Layer (Player, Enemies, Projectiles) */}
      {/* Render only if not destroyed */}
      {gameState.cold.gameView !== "destroyed" ? (
        <Layer
          clipX={0}
          clipY={0}
          clipWidth={C.GAME_WIDTH}
          clipHeight={C.GAME_VIEW_HEIGHT}
          listening={false}
          perfectDrawEnabled={false}
        >
          {/* Enemies */}
          {gameState.hot.enemies.map((enemy) => (
            <KonvaEnemy
              key={enemy.id}
              enemy={enemy}
              offsetX={offsetX}
              offsetY={offsetY}
            />
          ))}
          {/* Projectiles */}
          {gameState.hot.projectiles.map((proj) => (
            <KonvaProjectile
              key={proj.id}
              proj={proj}
              offsetX={offsetX}
              offsetY={offsetY}
            />
          ))}
          {/* Player */}
          {gameState.hot.player && (
            <KonvaPlayer
              key={gameState.hot.player.id}
              player={gameState.hot.player}
              offsetX={offsetX}
              offsetY={offsetY}
            />
          )}
        </Layer>
      ) : null}

      {/* Destruction Animations Layer */}
      <Layer
        clipX={0}
        clipY={0}
        clipWidth={C.GAME_WIDTH}
        clipHeight={C.GAME_VIEW_HEIGHT} // Clip effects to game view area
        listening={false}
        perfectDrawEnabled={false}
      >
        {gameState.cold.activeDestructionAnimations.map((anim) => (
          // Render particles for each active animation
          <Group key={anim.id}>
            {anim.particles.map((p) => (
              <KonvaDestructionParticle
                key={p.id}
                anim={anim}
                particle={p}
                offsetX={offsetX}
                offsetY={offsetY}
                now={now} // Pass current time
              />
            ))}
          </Group>
        ))}
      </Layer>

      {/* HUD Layer */}
      {/* Render only if not destroyed */}
      {gameState.cold.gameView !== "destroyed" ? (
        <Layer
          // No clipping needed for HUD, drawn below game view height
          perfectDrawEnabled={false}
          listening={false}
        >
          <KonvaHUD
            player={gameState.hot.player}
            cash={gameState.cold.cash}
            gameState={gameState}
            navTargetInfo={navTargetInfo} // Pass navigation info
          />
        </Layer>
      ) : null}

      {/* Touch Controls Layer */}
      {/* Render only if playing */}
      {gameState.cold.gameView === "playing" ? (
        <Layer perfectDrawEnabled={false} listening={false}>
          <KonvaTouchControls touchState={touchState} />
        </Layer>
      ) : null}
    </Stage>
  );
};

// Memoize the component
export default memo(GameCanvas);
