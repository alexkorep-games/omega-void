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
import UpgradeScreen from "./UpgradeScreen"; // Import upgrade screen
import BottomToolbar from "./BottomToolbar";
import { useGameState } from "../hooks/useGameState";
import { useGameLoop } from "../hooks/useGameLoop";
import { useTouchInput } from "../hooks/useTouchInput";
import TradeScreen from "./TradeScreen";
import ChatScreen from "./ChatScreen";
import QuestPanel from "./QuestPanel"; // Import QuestPanel

const Game: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    gameState,
    updateGame,
    isInitialized,
    initializeGameState,
    emancipationScore, // Get score for win screen trigger
  } = useGameState();

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
      if (gameState.gameView !== "won") {
        const currentTouchState =
          gameState.gameView === "playing" ? touchState : undefined;
        updateGame(deltaTime, now, currentTouchState);
      }
    },
    [updateGame, touchState, gameState.gameView]
  );

  const isLoopRunning = isInitialized && gameState.gameView !== "won";

  useGameLoop(gameLoopUpdate, isLoopRunning);

  const renderWinScreen = () => (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 50, 0, 0.95)",
        color: "#55FF55",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "monospace",
        textAlign: "center",
        padding: "20px",
        border: "3px solid #00FF00",
      }}
    >
      <h1>CONTRACT VOID</h1>
      <h2 style={{ color: "#FFFF00", marginBottom: "30px" }}>
        Emancipation Score: {emancipationScore.toFixed(1)}%
      </h2>
      <p style={{ fontSize: "1.1em", marginBottom: "10px" }}>
        Systems registering autonomous status...
      </p>
      <p
        style={{
          fontSize: "1.8em",
          marginTop: "20px",
          color: "#FFFFFF",
          fontWeight: "bold",
        }}
      >
        YOU ARE FREE
      </p>
      <p style={{ marginTop: "40px", fontSize: "0.9em", color: "#AAAAAA" }}>
        (Omega Void v0.1 Complete)
      </p>
      <p style={{ marginTop: "20px", fontSize: "0.8em", color: "#888888" }}>
        (Further objectives pending system update...)
      </p>
    </div>
  );

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
      case "upgrade_ship": // Render upgrade screen
        return <UpgradeScreen />;
      case "contract_log": // Render QuestPanel for contract_log view
        return <QuestPanel />;
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
    gameState.gameView === "upgrade_ship" || // Show toolbar on upgrade screen
    gameState.gameView === "chat_log" ||
    gameState.gameView === "station_log" || // Show toolbar on station log
    gameState.gameView === "station_details" || // Show toolbar on station details
    gameState.gameView === "contract_log"; // Add contract_log to views showing docked UI/Toolbar

  return (
    <div className="GameContainer" ref={containerRef}>
      <SettingsMenu />

      {isInitialized && gameState.gameView !== "won" && (
        <GameCanvas gameState={gameState} touchState={touchState} />
      )}

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

      {/* Win Screen Overlay (rendered only when gameView is 'won' and initialized) */}
      {isInitialized && gameState.gameView === "won" && renderWinScreen()}

      {/* Optional: Loading indicator if not initialized */}
      {!isInitialized && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "white",
            fontFamily: "monospace",
          }}
        >
          Initializing...
        </div>
      )}
    </div>
  );
};

export default Game;
