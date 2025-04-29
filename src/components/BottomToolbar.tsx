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
  const { gameState, setGameView, initiateUndocking, startNewGame } =
    useGameState();

  const handleNavigate = useCallback(
    (targetView: GameView) => {
      // Logic to regenerate market is handled within useGameState on docking
      setGameView(targetView);
    },
    [setGameView]
  );

  // Define the action for the New Game button
  const handleNewGameClick = useCallback(() => {
    const confirmed = window.confirm(
      "Start a new game? This will erase your current progress (coordinates, cash, cargo)."
    );
    if (confirmed) {
      startNewGame();
    }
  }, [startNewGame]);

  // Define the buttons and their target game views or actions
  const buttons: Array<{
    label: string;
    targetView: GameView;
    action?: () => void;
  }> = [
    {
      label: "Trade",
      targetView: "trade_select",
      action: () => setGameView("trade_select"),
    },
    { label: "Undock", targetView: "undocking", action: initiateUndocking },
    { label: "Info", targetView: "station_info" },
    {
      label: "New Game",
      targetView: "undocking",
      action: handleNewGameClick,
    },
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
