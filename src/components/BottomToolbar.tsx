// src/components/BottomToolbar.tsx
import React, { useCallback } from "react";
import { GameView } from "../game/types"; // Use Game 2 types
import { useGameState } from "../hooks/useGameState"; // Use Game 2 hook
import "./BottomToolbar.css"; // New CSS file

interface ToolbarButtonProps {
  label: string;
  targetView: GameView;
  currentView: GameView;
  onClick: (state: GameView) => void;
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
  } else {
    // Default: active only if exact match
    isActive = currentView === targetView;
  }

  return (
    <button
      className={`toolbar-button ${isActive ? "active" : ""} ${
        disabled ? "disabled" : ""
      }`}
      onClick={() => !disabled && onClick(targetView)}
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
    (targetView: GameView) => {
      // Always navigate to the *docked* station info when clicking the main Info button
      if (targetView === "station_info") {
        setGameView("station_info");
      }
      // Always navigate to the trade select screen when clicking Trade button (or related)
      else if (targetView === "trade_select") {
        setGameView("trade_select");
      } else {
        setGameView(targetView);
      }
    },
    [setGameView]
  );

  // Define the buttons and their target game views or actions
  const buttons: Array<{
    label: string;
    targetView: GameView;
    action?: () => void;
  }> = [
    {
      label: "Trade", // Label remains "Trade"
      targetView: "trade_select", // Always targets the trade select screen
      action: () => setGameView("trade_select"), // Ensure it goes to trade_select
    },
    { label: "Undock", targetView: "undocking", action: initiateUndocking },
    { label: "Info", targetView: "station_info" }, // Always targets the main info screen
    {
      label: "Messages",
      targetView: "chat_log",
      action: () => setGameView("chat_log"),
    },
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
          targetView={button.targetView}
          currentView={gameState.gameView}
          onClick={button.action || handleNavigate} // Use specific action if provided, else navigate
          title={button.label} // Simple title for now
        />
      ))}
    </div>
  );
};

export default BottomToolbar;
