// src/components/BottomToolbar.tsx
import React, { useCallback } from "react";
import { GameView } from "../game/types";
import { useGameState } from "../hooks/useGameState";
import "./BottomToolbar.css";

interface ToolbarButtonProps {
  label: string;
  targetView: GameView | (() => void);
  currentView: GameView;
  onClick: (targetViewOrAction: GameView | (() => void)) => void;
  disabled?: boolean;
  title?: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  label,
  targetView,
  currentView,
  onClick,
  disabled = false,
  title = "",
}) => {
  // Determine if active based on related views
  let isActive = false;
  if (targetView === "station_info") {
    isActive =
      currentView === "station_info" || currentView === "station_details";
  } else if (targetView === "trade_select") {
    isActive =
      currentView === "trade_select" ||
      currentView === "buy_cargo" ||
      currentView === "sell_cargo" ||
      currentView === "upgrade_ship";
  } else if (targetView === "chat_log") {
    isActive = currentView === "chat_log";
  } else if (targetView === "system_map") {
    isActive = currentView === "system_map";
  } else if (targetView === "station_log") {
    isActive = true;
  }

  const handleClick = () => {
    if (!disabled) {
      onClick(targetView); // Pass targetView or action function
    }
  };

  return (
    <button
      className={`toolbar-button ${isActive ? "active" : ""} ${
        disabled ? "disabled" : ""
      }`}
      onClick={handleClick}
      disabled={disabled}
      title={title || label}
    >
      {label}
    </button>
  );
};

const BottomToolbar: React.FC = () => {
  const { gameState, setGameView, initiateUndocking } = useGameState();

  const handleNavigate = useCallback(
    (targetOrAction: GameView | (() => void)) => {
      if (typeof targetOrAction === "function") {
        targetOrAction();
      } else {
        if (targetOrAction === "station_info") setGameView("station_info");
        else if (targetOrAction === "trade_select") setGameView("trade_select");
        else if (targetOrAction === "system_map") setGameView("system_map");
        else setGameView(targetOrAction);
      }
    },
    [setGameView]
  );

  type Button = {
    label: string;
    targetView: GameView | (() => void);
    title?: string;
    disabled?: boolean;
  };

  const buttons: Button[] = [
    {
      label: "Market",
      targetView: "trade_select",
      title: "Access Market & Shipyard",
    },
    {
      label: "Info",
      targetView: "station_info",
      title: "View Station Information",
    },
    {
      label: "Comms",
      targetView: "chat_log",
      title: "View Communications Log",
    },
    { label: "Undock", targetView: initiateUndocking, title: "Leave Station" },
  ];

  // Determine which views show the toolbar
  const toolbarVisibleViews: GameView[] = [
    "trade_select",
    "buy_cargo",
    "sell_cargo",
    "station_info",
    "chat_log",
    "station_log",
    "station_details",
    "upgrade_ship",
    "contract_log",
    "system_map",
  ];
  // Only render if the current gameView is one where the toolbar should be visible
  if (!toolbarVisibleViews.includes(gameState.gameView)) {
    return null;
  }

  return (
    <div className="bottom-toolbar">
      {buttons.map((button) => (
        <ToolbarButton
          key={button.label}
          label={button.label}
          // Pass the targetView or action function to onClick handler
          targetView={button.targetView}
          currentView={gameState.gameView}
          onClick={handleNavigate} // Use the navigation handler
          title={button.title}
        />
      ))}
    </div>
  );
};

export default BottomToolbar;
