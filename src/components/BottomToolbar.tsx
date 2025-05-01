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
    // Added chat log active state check
    isActive = currentView === "chat_log";
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
    (targetViewOrAction: GameView | (() => void)) => {
      if (typeof targetViewOrAction === "function") {
        targetViewOrAction(); // Call action function (e.g., undock)
      } else {
        // Handle view navigation
        if (targetViewOrAction === "station_info") setGameView("station_info");
        else if (targetViewOrAction === "trade_select")
          setGameView("trade_select");
        // Add other primary views if needed (like chat_log if it behaves similarly)
        else setGameView(targetViewOrAction); // Default navigation
      }
    },
    [setGameView] // No need for initiateUndocking here, passed directly
  );

  // Define the buttons and their target game views or actions
  const buttons: Array<{
    label: string;
    targetView: GameView | (() => void); // Keep union type
    title?: string;
  }> = [
    {
      label: "Trade",
      targetView: "trade_select",
      title: "Access Market & Shipyard",
    },
    { label: "Undock", targetView: initiateUndocking, title: "Leave Station" }, // Pass action directly
    {
      label: "Info",
      targetView: "station_info",
      title: "View Station Information",
    },
    {
      label: "Messages",
      targetView: "chat_log",
      title: "View Communications Log", // Added title
    },
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
  ];
console.log('gameState.gameView', gameState.gameView);
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
          targetView={button.targetView} // Pass target/action directly
          currentView={gameState.gameView}
          onClick={handleNavigate} // Use the navigation handler
          title={button.title}
        />
      ))}
    </div>
  );
};

export default BottomToolbar;
