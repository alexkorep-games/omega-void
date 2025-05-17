// src/components/Game.tsx
import SettingsMenu from "./SettingsMenu";
import React, { useRef, useCallback, useEffect } from "react";
import GameCanvas from "./GameCanvas";
import CoordinatesDisplay from "./CoordinatesDisplay";
import DockingAnimation from "./DockingAnimation";
import BuyCargoScreen from "./BuyCargoScreen";
import SellCargoScreen from "./SellCargoScreen";
import StationInfoScreen from "./StationInfoScreen";
import StationLogScreen from "./StationLogScreen";
import StationDetailsScreen from "./StationDetailsScreen";
import UpgradeScreen from "./UpgradeScreen";
import BottomToolbar from "./BottomToolbar";
import { useGameState } from "../hooks/useGameState";
import { useGameLoop } from "../hooks/useGameLoop";
import { useTouchInput } from "../hooks/useTouchInput";
import TradeScreen from "./TradeScreen";
import ChatScreen from "./ChatScreen";
import QuestPanel from "./QuestPanel"; // Keep import

const Game: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    gameState,
    updateGame,
    isInitialized,
    initializeGameState,
    emancipationScore,
  } = useGameState();

  const { touchState, enableTouchTracking } = useTouchInput(containerRef);

  useEffect(() => {
    if (!isInitialized) {
      initializeGameState();
    }
  }, [isInitialized, initializeGameState]);

  useEffect(() => {
    const isActionScreen = gameState.cold.gameView === "playing";
    enableTouchTracking(isActionScreen);
  }, [gameState.cold.gameView, enableTouchTracking]);

  const gameLoopUpdate = useCallback(
    (deltaTime: number, now: number) => {
      if (gameState.cold.gameView !== "won") {
        const currentTouchState =
          gameState.cold.gameView === "playing" ? touchState : undefined;
        updateGame(deltaTime, now, currentTouchState);
      }
    },
    [updateGame, touchState, gameState.cold.gameView]
  );

  const isLoopRunning = isInitialized && gameState.cold.gameView !== "won";

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

  // Renders the main content panel for different docked views
  const renderDockedUI = () => {
    switch (gameState.cold.gameView) {
      case "buy_cargo":
        return <BuyCargoScreen />;
      case "sell_cargo":
        return <SellCargoScreen />;
      case "station_info":
        return <StationInfoScreen />;
      case "station_log":
        return <StationLogScreen />;
      case "station_details":
        return (
          <StationDetailsScreen stationId={gameState.cold.navTargetStationId} />
        );
      case "trade_select":
        return <TradeScreen />;
      case "upgrade_ship":
        return <UpgradeScreen />;
      case "contract_log":
        return <QuestPanel />; // QuestPanel is rendered here
      case "chat_log":
        return (
          <ChatScreen
            messages={gameState.cold.chatLog} // Pass the chatLog from gameState
          />
        );
      default:
        return null;
    }
  };

  // Determine which views show the main docked UI panel (excluding the QuestPanel now)
  const showDockedUIPanel = [
    "buy_cargo",
    "sell_cargo",
    "station_info",
    "station_log",
    "station_details",
    "trade_select",
    "upgrade_ship",
    "chat_log",
    // "contract_log" // <-- REMOVED from main panel list
  ].includes(gameState.cold.gameView);

  // Determine which views show the Bottom Toolbar
  const showBottomToolbar = [
    "buy_cargo",
    "sell_cargo",
    "station_info",
    "station_log",
    "station_details",
    "trade_select",
    "upgrade_ship",
    "chat_log",
    "contract_log",
  ].includes(gameState.cold.gameView);

  return (
    <div className="GameContainer" ref={containerRef}>
      <SettingsMenu />

      {isInitialized && gameState.cold.gameView !== "won" && (
        <GameCanvas gameState={gameState} touchState={touchState} />
      )}

      {gameState.cold.gameView === "playing" &&
        isInitialized &&
        gameState.hot.player && (
          <CoordinatesDisplay x={gameState.hot.player.x} y={gameState.hot.player.y} />
        )}

      {(gameState.cold.gameView === "docking" ||
        gameState.cold.gameView === "undocking") &&
        isInitialized &&
        gameState.cold.animationState.duration > 0 && (
          <DockingAnimation
            progress={
              gameState.cold.animationState.progress /
              gameState.cold.animationState.duration
            }
          />
        )}

      {/* Render Docked UI Panel (Buy/Sell, Info, Log, Details, Trade Select, Upgrade, Chat) */}
      {showDockedUIPanel && isInitialized && renderDockedUI()}

      {/* Render Quest Panel *only* when view is contract_log */}
      {gameState.cold.gameView === "contract_log" && isInitialized && <QuestPanel />}

      {/* Render Bottom Toolbar only when appropriate */}
      {showBottomToolbar && isInitialized && <BottomToolbar />}

      {isInitialized && gameState.cold.gameView === "won" && renderWinScreen()}

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
