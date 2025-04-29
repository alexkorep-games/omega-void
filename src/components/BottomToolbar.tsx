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
  const isActive = currentView === targetView;
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
  const { gameState, setGameView, initiateUndocking } = useGameState(); // Use Game 2 hook and setter

  const handleNavigate = useCallback(
    (targetView: GameView) => {
      // Logic to regenerate market is handled within useGameState on docking
      setGameView(targetView);
    },
    [setGameView]
  );

  // Define the buttons and their target game views
  // Keep it simple for now: Buy, Sell, Undock
  const buttons: Array<{
    label: string;
    targetView: GameView;
    action?: () => void;
  }> = [
    { label: "Buy", targetView: "buy_cargo" },
    { label: "Sell", targetView: "sell_cargo" },
    // Add more later like Shipyard, Equipment...
    { label: "Undock", targetView: "undocking", action: initiateUndocking },
  ];

  // Determine which views show the toolbar
  const toolbarVisibleViews: GameView[] = [
    "docked", // Show on the initial docked screen
    "buy_cargo",
    "sell_cargo",
    // Add other docked views here if they are created
  ];

  // Only render if the current gameView is one where the toolbar should be visible
  if (!toolbarVisibleViews.includes(gameState.gameView)) {
    return null;
  }

  return (
    <div className="bottom-toolbar">
      {buttons.map((button) => (
        <ToolbarButton
          key={button.label} // Use label as key assuming labels are unique here
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