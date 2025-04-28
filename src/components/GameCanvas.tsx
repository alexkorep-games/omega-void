// src/components/GameCanvas.tsx
import React, { useRef, useEffect, memo } from "react";
import { IGameState, ITouchState } from "../game/types";
import { drawGame } from "../game/drawing";
import { GAME_WIDTH, GAME_HEIGHT } from "../game/config";

interface GameCanvasProps {
  gameState: IGameState;
  touchState: ITouchState;
  canvasRef: React.RefObject<HTMLCanvasElement | null>; // Receive ref from parent
}

const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  touchState,
  canvasRef,
}) => {
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Get drawing context
  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctxRef.current = ctx;
        console.log("Canvas context obtained.");
      } else {
        console.error("Failed to get 2D context");
      }
    }
  }, [canvasRef]); // Only depends on canvasRef

  // Drawing effect - runs whenever gameState changes
  useEffect(() => {
    if (ctxRef.current && gameState.isInitialized) {
      // console.log("Drawing game state frame..."); // Debug log (can be noisy)
      drawGame(ctxRef.current, gameState, touchState);
    }
  }, [gameState, touchState]); // Re-draw when game or touch state changes

  return (
    <canvas
      ref={canvasRef}
      width={GAME_WIDTH}
      height={GAME_HEIGHT}
      style={{ touchAction: "none" }} // Reinforce touch action style
    />
  );
};

// Memoize the component to prevent re-renders if props haven't changed.
// Note: gameState *will* change every frame, causing re-renders, which is expected.
// The main benefit here is if the parent component re-renders for other reasons.
export default memo(GameCanvas);
