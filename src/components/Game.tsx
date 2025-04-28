// src/components/Game.tsx
import React, { useRef, useCallback } from "react";
import GameCanvas from "./GameCanvas";
import CoordinatesDisplay from "./CoordinatesDisplay";
import { useGameState } from "../hooks/useGameState";
import { useGameLoop } from "../hooks/useGameLoop";
import { useTouchInput } from "../hooks/useTouchInput";

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null); // Create ref here
  const { gameState, updateGame, isInitialized } = useGameState();
  const touchState = useTouchInput(canvasRef); // Pass ref to touch hook

  // Memoize the game update callback to ensure stability for useGameLoop
  const gameLoopUpdate = useCallback(
    (deltaTime: number, now: number) => {
      // Pass the current touchState directly to the updateGame function
      updateGame(deltaTime, now, touchState);
    },
    [updateGame, touchState]
  ); // Recreate if updateGame or touchState changes reference

  // Start the game loop only when the state is initialized
  useGameLoop(gameLoopUpdate, isInitialized);

  return (
    <div style={{ position: "relative" }}>
      {" "}
      {/* Container for positioning */}
      {isInitialized && (
        <>
          <CoordinatesDisplay x={gameState.player.x} y={gameState.player.y} />
          <GameCanvas
            gameState={gameState}
            touchState={touchState}
            canvasRef={canvasRef} // Pass down the ref
          />
        </>
      )}
      {!isInitialized && <div>Loading...</div>}{" "}
      {/* Optional loading indicator */}
    </div>
  );
};

export default Game;
