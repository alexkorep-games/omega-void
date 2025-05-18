// src/components/GameCanvas.tsx
import React, { memo, useMemo } from "react";
import { Stage, Layer, Text, Group, StageProps } from "react-konva";
import {
  IGameColdState,
  ITouchState,
  IStar,
  IStation,
  IBeacon,
  IAsteroid,
} from "../game/types";
import * as C from "../game/config";

import KonvaStar from "./canvas/KonvaStar";
import KonvaStation from "./canvas/KonvaStation";
import KonvaPlayer from "./canvas/KonvaPlayer";
import KonvaEnemy from "./canvas/KonvaEnemy";
import KonvaProjectile from "./canvas/KonvaProjectile";
import KonvaHUD from "./canvas/KonvaHUD";
import KonvaTouchControls from "./canvas/KonvaTouchControls";
import KonvaDestructionParticle from "./canvas/KonvaDestructionParticle";
import KonvaAsteroid from "./canvas/KonvaAsteroid";
import KonvaBeacon from "./canvas/KonvaBeacon";

interface GameCanvasProps {
  gameState: IGameColdState;
  touchState: ITouchState;
}

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

const PLAYER_SCREEN_X = C.GAME_WIDTH / 2;
const PLAYER_SCREEN_Y = C.GAME_VIEW_HEIGHT * 0.75; // Player rendered towards bottom-center

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, touchState }) => {
  const stageStyle: React.CSSProperties = {
    ...canvasStyleBase,
    visibility:
      gameState.gameView === "playing" || gameState.gameView === "destroyed"
        ? "visible"
        : "hidden",
  };

  const now = performance.now();

  const navTargetInfo = useMemo(() => {
    if (
      gameState.navTargetStationId &&
      gameState.navTargetDirection !== null &&
      gameState.navTargetCoordinates
    ) {
      return {
        id: gameState.navTargetStationId,
        name: null,
        coords: gameState.navTargetCoordinates,
        direction: gameState.navTargetDirection,
      };
    }
    return null;
  }, [
    gameState.navTargetStationId,
    gameState.navTargetDirection,
    gameState.navTargetCoordinates,
  ]);

  if (
    !gameState.isInitialized ||
    stageStyle.visibility === "hidden" ||
    !gameState.player
  ) {
    return <div style={stageStyle} />;
  }

  const playerAngleRad = gameState.player.angle;
  // World rotates inversely to player's angle to keep player looking "up" (-90 deg visual)
  // If player.angle is -PI/2 (up), worldRotationDeg should be 0.
  // If player.angle is 0 (right), worldRotationDeg should be 90.
  // If player.angle is PI/2 (down), worldRotationDeg should be 180.
  // If player.angle is PI (left), worldRotationDeg should be 270 or -90.
  const worldRotationDeg =
    (-((playerAngleRad * 180) / Math.PI) - 90 + 360) % 360;

  const playerVisualRotationDeg = -90; // Player ship sprite always points up on screen

  return (
    <Stage width={C.GAME_WIDTH} height={C.GAME_HEIGHT} style={stageStyle}>
      {/* Layer for all transformed world elements (background, entities, effects) */}
      <Layer
        clipX={0}
        clipY={0}
        clipWidth={C.GAME_WIDTH}
        clipHeight={C.GAME_VIEW_HEIGHT}
        perfectDrawEnabled={false}
        listening={false}
      >
        <Group /* This is the GameWorldGroup */
          x={PLAYER_SCREEN_X} // Pivot point for rotation is player's screen position
          y={PLAYER_SCREEN_Y}
          offsetX={gameState.player.x} // World coordinate that aligns with pivot's origin
          offsetY={gameState.player.y}
          rotation={worldRotationDeg}
        >
          {/* Stars */}
          {gameState.visibleBackgroundObjects
            .filter((obj) => obj.type === "star")
            .map((star) => (
              <KonvaStar key={star.id} star={star as IStar} />
            ))}
          {/* Stations */}
          {gameState.visibleBackgroundObjects
            .filter((obj) => obj.type === "station")
            .map((station) => (
              <KonvaStation
                key={station.id}
                station={station as IStation}
                isNavTarget={station.id === gameState.navTargetStationId}
              />
            ))}
          {/* Asteroids */}
          {gameState.visibleBackgroundObjects
            .filter((obj) => obj.type === "asteroid")
            .map((asteroid) => (
              <KonvaAsteroid
                key={asteroid.id}
                asteroid={asteroid as IAsteroid}
              />
            ))}
          {/* Beacons */}
          {gameState.visibleBackgroundObjects
            .filter((obj) => obj.type === "beacon")
            .map((beacon) => (
              <KonvaBeacon key={beacon.id} beacon={beacon as IBeacon} />
            ))}

          {/* Enemies (conditionally rendered) */}
          {gameState.gameView !== "destroyed" &&
            gameState.enemies.map((enemy) => (
              <KonvaEnemy key={enemy.id} enemy={enemy} />
            ))}
          {/* Projectiles (conditionally rendered) */}
          {gameState.gameView !== "destroyed" &&
            gameState.projectiles.map((proj) => (
              <KonvaProjectile key={proj.id} proj={proj} />
            ))}

          {/* Destruction Animations */}
          {gameState.activeDestructionAnimations.map((anim) => (
            <Group key={anim.id}>
              {anim.particles.map((p) => (
                <KonvaDestructionParticle
                  key={p.id}
                  anim={anim}
                  particle={p}
                  now={now}
                />
              ))}
            </Group>
          ))}
        </Group>
        {/* End of GameWorldGroup */}
      </Layer>

      {/* Station Names Layer (Translates with player, DOES NOT ROTATE) */}
      <Layer
        listening={false}
        perfectDrawEnabled={false}
        clipX={0}
        clipY={0}
        clipWidth={C.GAME_WIDTH}
        clipHeight={C.GAME_VIEW_HEIGHT}
      >
        <Group
          x={PLAYER_SCREEN_X} // Same translation pivot as world
          y={PLAYER_SCREEN_Y}
          offsetX={gameState.player.x}
          offsetY={gameState.player.y}
          // NO rotation for this group, so names stay upright
        >
          {gameState.visibleBackgroundObjects
            .filter(
              (obj): obj is IStation =>
                obj.type === "station" &&
                !!obj.name &&
                obj.radius > 5 &&
                gameState.discoveredStations.includes(obj.id)
            )
            .map((station) => {
              const textWidthApprox = station.name.length * 10 * 0.6; // Crude approximation: char_count * font_size * aspect_ratio
              return (
                <Text
                  key={`${station.id}-name`}
                  x={station.x} // World X
                  y={station.y - station.radius - 18} // World Y, offset above station object's center
                  text={station.name}
                  fontSize={10}
                  fontFamily="monospace"
                  fill={
                    station.id === gameState.navTargetStationId
                      ? C.NAV_TARGET_COLOR
                      : station.color
                  }
                  align="center"
                  listening={false}
                  perfectDrawEnabled={false}
                  offsetX={textWidthApprox / 2} // Offset X to center the text
                  offsetY={5} // Adjust vertical alignment if needed (half font size)
                />
              );
            })}
        </Group>
      </Layer>

      {/* Player Layer (Fixed on screen, specific visual rotation, drawn on top of world and names) */}
      {gameState.gameView !== "destroyed" && gameState.player && (
        <Layer listening={false} perfectDrawEnabled={false}>
          <KonvaPlayer
            player={gameState.player}
            screenX={PLAYER_SCREEN_X}
            screenY={PLAYER_SCREEN_Y}
            fixedRotation={playerVisualRotationDeg}
          />
        </Layer>
      )}

      {/* HUD Layer (static on screen) */}
      {gameState.gameView !== "destroyed" ? (
        <Layer perfectDrawEnabled={false} listening={false}>
          <KonvaHUD
            player={gameState.player}
            cash={gameState.cash}
            gameState={gameState}
            navTargetInfo={navTargetInfo}
          />
        </Layer>
      ) : null}

      {/* Touch Controls Layer (static on screen) */}
      {gameState.gameView === "playing" ? (
        <Layer perfectDrawEnabled={false} listening={false}>
          <KonvaTouchControls touchState={touchState} />
        </Layer>
      ) : null}
    </Stage>
  );
};

export default memo(GameCanvas);
