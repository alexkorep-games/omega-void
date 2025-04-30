/* src/components/Game.tsx */
// src/components/Game.tsx
import SettingsMenu from "./SettingsMenu";
import React, { useRef, useCallback, useEffect } from "react";
import GameCanvas from "./GameCanvas";
import CoordinatesDisplay from "./CoordinatesDisplay";
import DockingAnimation from "./DockingAnimation";
import BuyCargoScreen from "./BuyCargoScreen";
import SellCargoScreen from "./SellCargoScreen";
import StationInfoScreen from "./StationInfoScreen";
import StationLogScreen from "./StationLogScreen"; // Import new screen
import StationDetailsScreen from "./StationDetailsScreen"; // Import new screen
import BottomToolbar from "./BottomToolbar";
import { useGameState } from "../hooks/useGameState";
import { useGameLoop } from "../hooks/useGameLoop";
import { useTouchInput } from "../hooks/useTouchInput";
import TradeScreen from "./TradeScreen";
import ChatScreen from "./ChatScreen";

const Game: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { gameState, updateGame, isInitialized, initializeGameState } =
    useGameState();

  const { touchState, enableTouchTracking } = useTouchInput(containerRef);

  useEffect(() => {
    if (!isInitialized) {
      initializeGameState();
    }
  }, [isInitialized, initializeGameState]);

  useEffect(() => {
    const isActionScreen = gameState.gameView === "playing";
    enableTouchTracking(isActionScreen);
  }, [gameState.gameView, enableTouchTracking]);

  const gameLoopUpdate = useCallback(
    (deltaTime: number, now: number) => {
      const currentTouchState =
        gameState.gameView === "playing" ? touchState : undefined;
      updateGame(deltaTime, now, currentTouchState);
    },
    [updateGame, touchState, gameState.gameView]
  );

  // Loop runs during playing and animations, destruction
  const isLoopRunning =
    isInitialized &&
    (gameState.gameView === "playing" ||
      gameState.gameView === "docking" ||
      gameState.gameView === "undocking" ||
      gameState.gameView === "destroyed"); // Keep loop for destruction animation & timer

  useGameLoop(gameLoopUpdate, isLoopRunning);

  const renderDockedUI = () => {
    switch (gameState.gameView) {
      case "buy_cargo":
        return <BuyCargoScreen />;
      case "sell_cargo":
        return <SellCargoScreen />;
      case "station_info": // Info for currently docked station
        return <StationInfoScreen />;
      case "station_log": // New station log screen
        return <StationLogScreen />;
      case "station_details": // New screen for viewing specific station details from log
        return (
          <StationDetailsScreen stationId={gameState.viewTargetStationId} />
        );
      case "trade_select":
        return <TradeScreen />;
      case "chat_log":
        return (
          <ChatScreen
            messages={[
              { id: 1, sender: "user", text: "Hello, this is a test message." },
              {
                id: 2,
                sender: "ai",
                text: "Hello, how can I assist you today?",
              },
            ]}
          />
        );
      default:
        return null;
    }
  };

  const showDockedUI =
    gameState.gameView === "buy_cargo" ||
    gameState.gameView === "station_info" ||
    gameState.gameView === "sell_cargo" ||
    gameState.gameView === "trade_select" ||
    gameState.gameView === "chat_log" ||
    gameState.gameView === "station_log" || // Show toolbar on station log
    gameState.gameView === "station_details"; // Show toolbar on station details

  return (
    <div className="GameContainer" ref={containerRef}>
      <SettingsMenu />

      <GameCanvas gameState={gameState} touchState={touchState} />

      {/* Coordinate Display (only visible when playing) */}
      {gameState.gameView === "playing" &&
        isInitialized &&
        gameState.player && (
          <CoordinatesDisplay x={gameState.player.x} y={gameState.player.y} />
        )}

      {/* Docking/Undocking Animations */}
      {(gameState.gameView === "docking" ||
        gameState.gameView === "undocking") &&
        isInitialized &&
        gameState.animationState.duration > 0 && (
          <DockingAnimation
            type={gameState.gameView}
            progress={
              gameState.animationState.progress /
              gameState.animationState.duration
            }
          />
        )}

      {/* Docked Screens (Buy/Sell, Info, Trade Select, Chat, Log, Details) */}
      {showDockedUI && isInitialized && renderDockedUI()}

      {/* Bottom Toolbar (shown when docked UI is visible) */}
      {showDockedUI && isInitialized && <BottomToolbar />}
    </div>
  );
};

export default Game;
