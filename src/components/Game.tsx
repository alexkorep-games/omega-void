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
import QuestPanel from "./QuestPanel";
import CommodityStationsScreen from "./CommodityStationsScreen"; // Import new screen
import MapScreen from "./MapScreen";

const Game: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    gameState,
    updateGame,
    isInitialized,
    initializeGameState,
    emancipationScore,
  } = useGameState();

  const { touchState, enableTouchTracking, resetKeyboardState } =
    useTouchInput(containerRef);

  useEffect(() => {
    if (!isInitialized) {
      initializeGameState();
    }
  }, [isInitialized, initializeGameState]);

  useEffect(() => {
    const isActionScreen = gameState.gameView === "playing";
    enableTouchTracking(isActionScreen);

    // Reset keyboard state when entering any docked/non-action view
    if (!isActionScreen) {
      resetKeyboardState();
    }
  }, [gameState.gameView, enableTouchTracking, resetKeyboardState]);

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
      case "station_info":
        return <StationInfoScreen />;
      case "station_log":
        return <StationLogScreen />;
      case "station_details":
        return (
          <StationDetailsScreen stationId={gameState.viewTargetStationId} />
        );
      case "trade_select":
        return <TradeScreen />;
      case "upgrade_ship":
        return <UpgradeScreen />;
      case "contract_log":
        return <QuestPanel />;
      case "chat_log":
        return <ChatScreen messages={gameState.chatLog} />;
      case "commodity_stations_list": // New case
        return (
          <CommodityStationsScreen
            commodityKey={gameState.viewTargetCommodityKey}
          />
        );
      case "system_map":
        return <MapScreen />;
      default:
        return null;
    }
  };

  const showDockedUIPanel = [
    "buy_cargo",
    "sell_cargo",
    "station_info",
    "station_log",
    "station_details",
    "trade_select",
    "upgrade_ship",
    "chat_log",
    "commodity_stations_list", // Add new view to list
    "system_map",
  ].includes(gameState.gameView);

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
    "commodity_stations_list", // Add new view to list
    "system_map",
  ].includes(gameState.gameView);

  return (
    <div className="GameContainer" ref={containerRef}>
      <SettingsMenu />

      {isInitialized && gameState.gameView !== "won" && (
        <GameCanvas gameState={gameState} touchState={touchState} />
      )}

      {gameState.gameView === "playing" &&
        isInitialized &&
        gameState.player && (
          <CoordinatesDisplay x={gameState.player.x} y={gameState.player.y} />
        )}

      {(gameState.gameView === "docking" ||
        gameState.gameView === "undocking") &&
        isInitialized &&
        gameState.animationState.duration > 0 && (
          <DockingAnimation
            progress={
              gameState.animationState.progress /
              gameState.animationState.duration
            }
          />
        )}

      {showDockedUIPanel && isInitialized && renderDockedUI()}

      {gameState.gameView === "contract_log" && isInitialized && <QuestPanel />}

      {showBottomToolbar && isInitialized && <BottomToolbar />}

      {isInitialized && gameState.gameView === "won" && renderWinScreen()}

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
