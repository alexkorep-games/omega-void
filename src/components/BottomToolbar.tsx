// src/components/BottomToolbar.tsx
import React, { useCallback } from "react";
import { GameView } from "../game/types"; // Use Game 2 types
import { useGameState } from "../hooks/useGameState"; // Use Game 2 hook
import "./BottomToolbar.css"; // New CSS file

interface ToolbarButtonProps {
  label: string;
  targetView: GameView;
  currentView: GameView;
  onClick: (state: GameView | (() => void)) => void; // Allow function for action buttons
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
    // "Info" button is active for both docked station info and details view from log
    isActive =
      currentView === "station_info" || currentView === "station_details";
  } else if (targetView === "trade_select") {
    // "Trade" button is active for trade select, buy, sell, and upgrade screens
    isActive =
      currentView === "trade_select" ||
      currentView === "buy_cargo" ||
      currentView === "sell_cargo" ||
      currentView === "upgrade_ship"; // Add upgrade screen here
  } else if (targetView === "contract_log") {
    // Make Contract button active for its view
    isActive = currentView === "contract_log";
  } else {
    // Default: active only if exact match
    isActive = currentView === targetView;
  }

  const handleClick = () => {
    if (!disabled) {
      // If targetView is a valid GameView, pass it to onClick
      // If it's an action (like undock), the action itself is passed in button definition
      onClick(targetView);
    }
  };

  return (
    <button
      className={`toolbar-button ${isActive ? "active" : ""} ${
        disabled ? "disabled" : ""
      }`}
      onClick={handleClick} // Use internal handler
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
        // If it's an action function (like initiateUndocking), call it
        targetViewOrAction();
      } else {
        // Otherwise, it's a GameView, set the view
        // Special handling for primary navigation buttons to reset sub-views if needed
        if (targetViewOrAction === "station_info") setGameView("station_info");
        else if (targetViewOrAction === "trade_select")
          setGameView("trade_select");
        // Add other primary views if necessary
        else setGameView(targetViewOrAction); // Default navigation
      }
    },
    [setGameView] // Removed initiateUndocking from deps, passed directly
  );

  // Define the buttons and their target game views or actions
  const buttons: Array<{
    label: string;
    targetView: GameView | (() => void);
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
      label: "Contract",
      targetView: "contract_log",
      title: "View Contract Status",
    }, // NEW Contract button
    {
      label: "Messages",
      targetView: "chat_log",
      action: () => setGameView("chat_log"),
    }, // Keep if needed
  ];

  // Determine which views show the toolbar
  const toolbarVisibleViews: GameView[] = [
    "trade_select",
    "buy_cargo",
    "sell_cargo",
    "station_info",
    "chat_log",
    "station_log", // Show on Station Log
    "station_details", // Show on Station Details
    "upgrade_ship", // Show on Upgrade Screen
    "contract_log", // Show toolbar on contract log screen
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
          targetView={
            typeof button.targetView === "string"
              ? button.targetView
              : gameState.gameView
          } // Pass dummy view if action
          currentView={gameState.gameView}
          onClick={() => handleNavigate(button.targetView)} // Pass target/action to handler
          title={button.title}
        />
      ))}
    </div>
  );
};

export default BottomToolbar;
