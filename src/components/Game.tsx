// src/components/Game.tsx
import SettingsMenu from "./SettingsMenu";
import React, { useRef, useCallback, useEffect } from "react";
import GameCanvas from "./GameCanvas";
import CoordinatesDisplay from "./CoordinatesDisplay";
// import StationScreen from "./StationScreen"; // No longer needed directly here
import DockingAnimation from "./DockingAnimation";
import BuyCargoScreen from "./BuyCargoScreen"; // Import Buy screen
import SellCargoScreen from "./SellCargoScreen"; // Import Sell screen
import StationInfoScreen from "./StationInfoScreen"; // Import Station Info screen
import BottomToolbar from "./BottomToolbar"; // Import Toolbar
import { useGameState } from "../hooks/useGameState";
import { useGameLoop } from "../hooks/useGameLoop";
import { useTouchInput } from "../hooks/useTouchInput";
import TradeScreen from "./TradeScreen";
import ChatScreen from "./ChatScreen";

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { gameState, updateGame, isInitialized, initializeGameState } =
    useGameState();

  const { touchState, resetTouchState } = useTouchInput(canvasRef);

  // Initialize game state on first render
  useEffect(() => {
    if (!isInitialized) {
      initializeGameState();
    }
  }, [isInitialized, initializeGameState]);

  useEffect(() => {
    // Reset touch if docking starts or if we enter a non-playing view
    if (
      gameState.gameView === "docking" ||
      gameState.gameView === "buy_cargo" ||
      gameState.gameView === "station_info" ||
      gameState.gameView === "sell_cargo" ||
      gameState.gameView === "trade_select" ||
      gameState.gameView === "chat_log"
    ) {
      resetTouchState();
    }
  }, [gameState.gameView, resetTouchState]);

  const gameLoopUpdate = useCallback(
    (deltaTime: number, now: number) => {
      const currentTouchState =
        gameState.gameView === "playing" ? touchState : undefined;
      updateGame(deltaTime, now, currentTouchState);
    },
    [updateGame, touchState, gameState.gameView]
  );

  // Loop runs during playing and animations
  const isLoopRunning =
    isInitialized &&
    (gameState.gameView === "playing" ||
      gameState.gameView === "docking" ||
      gameState.gameView === "undocking");

  useGameLoop(gameLoopUpdate, isLoopRunning);

  // --- Determine which docked UI component to show ---
  const renderDockedUI = () => {
    // console.log(`Rendering UI for game view: ${gameState.gameView}`); // Less noisy log
    switch (gameState.gameView) {
      case "buy_cargo":
        return <BuyCargoScreen />;
      case "sell_cargo":
        return <SellCargoScreen />;
      case "station_info":
        return <StationInfoScreen />;
      case "trade_select":
        return <TradeScreen />;
      case "chat_log":
        return (
          <ChatScreen
            messages={[
              {
                id: 1,
                sender: "user",
                text: "Hello, this is a test message.",
              },
              {
                id: 2,
                sender: "ai",
                text: "Hello, how can I assist you today?",
              },
            ]}
          />
        );
      default:
        return null; // Should not happen in a docked state with toolbar
    }
  };

  // Determine if any docked UI should be visible
  const showDockedUI =
    gameState.gameView === "buy_cargo" ||
    gameState.gameView === "station_info" ||
    gameState.gameView === "sell_cargo" ||
    gameState.gameView === "trade_select" ||
    gameState.gameView === "chat_log";

  return (
    <div className="GameContainer">
      <SettingsMenu />

      {/* Game Canvas (only visible when playing) */}
      <GameCanvas
        gameState={gameState}
        touchState={touchState}
        canvasRef={canvasRef}
      />

      {/* Coordinate Display (only visible when playing) */}
      {gameState.gameView === "playing" && isInitialized && (
        <CoordinatesDisplay x={gameState.player.x} y={gameState.player.y} />
      )}

      {/* Docking/Undocking Animations */}
      {(gameState.gameView === "docking" ||
        gameState.gameView === "undocking") &&
        isInitialized && (
          <DockingAnimation
            type={gameState.gameView}
            progress={
              gameState.animationState.progress /
              gameState.animationState.duration
            }
          />
        )}

      {/* Docked Screens (Buy/Sell, Info, Trade Select, Chat) */}
      {showDockedUI && isInitialized && renderDockedUI()}

      {/* Bottom Toolbar (shown when docked UI is visible) */}
      {showDockedUI && isInitialized && <BottomToolbar />}
    </div>
  );
};

export default Game;
