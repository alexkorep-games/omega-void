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

const canvasStyleBase: React.CSSProperties = {
  display: "block",
  backgroundColor: "#000",
  imageRendering: "pixelated",
  // imageRendering: '-moz-crisp-edges', // Firefox might need this
  // imageRendering: 'crisp-edges', // More modern browsers
  touchAction: "none", // Prevent default touch actions like scroll/zoom
  userSelect: "none", // Prevent text selection
  WebkitUserSelect: "none", // Safari
  msUserSelect: "none", // IE
  width: "100%", // Use CSS to control display size
  height: "100%",
  objectFit: "contain", // Scale the canvas content while maintaining aspect ratio
  maxWidth: `${GAME_WIDTH}px`, // Limit max CSS size to native res
  maxHeight: `${GAME_HEIGHT}px`, // Limit max CSS size to native res
  position: "relative", // Needed for absolute positioning of children like CoordinatesDisplay if inside GameCanvas
  zIndex: 1, // Base layer
};

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
        // Disable smoothing for pixelated look - set it once context is obtained
        ctx.imageSmoothingEnabled = false;
        console.log("Canvas context obtained, smoothing disabled.");
      } else {
        console.error("Failed to get 2D context");
      }
    }
  }, [canvasRef]); // Only depends on canvasRef

  // Drawing effect - runs whenever gameState changes *or* touchState changes (for controls)
  useEffect(() => {
    if (
      ctxRef.current &&
      gameState.isInitialized &&
      (gameState.gameView === "playing" || gameState.gameView === "destroyed") // Draw during destruction too (for explosion bg maybe)
    ) {
      // console.log("Drawing game state frame..."); // Debug log (can be noisy)
      drawGame(ctxRef.current, gameState, touchState);
    } else if (
      ctxRef.current &&
      gameState.gameView !== "playing" &&
      gameState.gameView !== "destroyed"
    ) {
      // Clear canvas if not playing to avoid stale graphics
      ctxRef.current.fillStyle = "#000";
      ctxRef.current.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
  }, [gameState, touchState]); // Re-draw when game or touch state changes or game view

  // Dynamic style to hide canvas when not playing OR destroyed (to let overlay show)
  // Let's keep canvas visible during 'destroyed' so background/stars are visible
  const canvasStyle: React.CSSProperties = {
    ...canvasStyleBase,
    visibility:
      gameState.gameView === "playing" || gameState.gameView === "destroyed"
        ? "visible"
        : "hidden",
  };

  return (
    <canvas
      ref={canvasRef}
      width={GAME_WIDTH}
      height={GAME_HEIGHT}
      style={canvasStyle} // Apply dynamic style
    />
  );
};

// Memoize the component
export default memo(GameCanvas);
