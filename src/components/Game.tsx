// src/components/Game.tsx
import React, { useRef, useCallback, useMemo, useEffect } from "react";
import GameCanvas from "./GameCanvas";
import CoordinatesDisplay from "./CoordinatesDisplay";
import StationScreen from "./StationScreen"; // Import StationScreen
import DockingAnimation from "./DockingAnimation"; // Import DockingAnimation
import { useGameState } from "../hooks/useGameState";
import { useGameLoop } from "../hooks/useGameLoop";
import { useTouchInput } from "../hooks/useTouchInput";

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    gameState,
    updateGame,
    isInitialized,
    initiateUndocking, // Get undocking trigger
    findStationById, // Get helper function
  } = useGameState(); // Get state and functions from hook

  const { touchState, resetTouchState } = useTouchInput(canvasRef);

  // Reset touch controls when docking starts
  useEffect(() => {
    if (gameState.gameView === "docking") {
      resetTouchState();
    }
  }, [gameState.gameView, resetTouchState]);

  // Memoize the game update callback
  const gameLoopUpdate = useCallback(
    (deltaTime: number, now: number) => {
      // Only pass touchState if the game is in 'playing' mode
      const currentTouchState =
        gameState.gameView === "playing" ? touchState : undefined;
      updateGame(deltaTime, now, currentTouchState);
    },
    [updateGame, touchState, gameState.gameView] // Recreate if view changes
  );

  // Conditionally run the game loop based on gameView
  // Stop loop when docked, resume when playing/animating
  const isLoopRunning =
    isInitialized &&
    (gameState.gameView === "playing" ||
      gameState.gameView === "docking" ||
      gameState.gameView === "undocking");

  useGameLoop(gameLoopUpdate, isLoopRunning);

  // Find the current station data when docked
  const currentStation = useMemo(() => {
    if (gameState.gameView === "docked" && gameState.dockingStationId) {
      return findStationById(gameState.dockingStationId);
    }
    return null;
  }, [gameState.gameView, gameState.dockingStationId, findStationById]);

  // --- Render Logic based on gameView ---
  const renderContent = () => {
    if (!isInitialized) {
      return <div>Loading...</div>;
    }

    switch (gameState.gameView) {
      case "playing":
        return (
          <>
            <CoordinatesDisplay x={gameState.player.x} y={gameState.player.y} />
            <GameCanvas
              gameState={gameState}
              touchState={touchState}
              canvasRef={canvasRef}
            />
          </>
        );
      case "docking":
        return (
          <DockingAnimation
            type="docking"
            progress={
              gameState.animationState.progress /
              gameState.animationState.duration
            }
          />
        );
      case "docked":
        return (
          <StationScreen
            station={currentStation}
            onUndock={initiateUndocking}
          />
        );
      case "undocking":
        return (
          <DockingAnimation
            type="undocking"
            progress={
              gameState.animationState.progress /
              gameState.animationState.duration
            }
          />
        );
      default:
        return <div>Error: Unknown Game View</div>;
    }
  };

  return (
    <div className="GameContainer" style={{ position: "relative" }}>
      {/*
         Render the canvas *only* if playing, otherwise performance suffers.
         Or keep it rendered but hidden/paused. Let's keep it simple and only render when playing.
         The DockingAnimation and StationScreen handle their own full-screen display.
      */}
      {renderContent()}

      {/* Keep the canvas element present but potentially hidden for touch input */}
      <canvas
        ref={canvasRef}
        width={1} // minimal size when not actively used
        height={1}
        style={{
          position: "absolute",
          top: "-10px", // Hide it off-screen
          left: "-10px",
          zIndex: -1, // Ensure it's behind everything
          visibility: gameState.gameView === "playing" ? "visible" : "hidden", // Control visibility
          touchAction: "none",
        }}
      />
    </div>
  );
};

export default Game;
