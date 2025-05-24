// src/components/SettingsMenu.tsx
import React, { useState, useCallback } from "react";
import { useGameState } from "../hooks/useGameState";
import "./SettingsMenu.css"; // We'll create this next

const SettingsMenu: React.FC = () => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  // Use updatePlayerState to modify cash (credits)
  const { startNewGame, updatePlayerState } = useGameState();
  // Cheat: track title clicks
  const [, setTitleClickCount] = useState(0);

  // Cheat: handle Settings title click
  const handleTitleClick = useCallback(() => {
    setTitleClickCount((prev) => {
      const next = prev + 1;
      if (next === 6) {
        updatePlayerState((oldState) => ({
          cash: (oldState.cash || 0) + 5000,
        }));
        setTimeout(() => setTitleClickCount(0), 200); // Reset after cheat
      }
      return next === 6 ? 0 : next;
    });
  }, [updatePlayerState]);

  const togglePopup = () => {
    setIsPopupOpen(!isPopupOpen);
  };

  const handleNewGameClick = useCallback(() => {
    const confirmed = window.confirm(
      "Start a new game? This will erase your current progress (coordinates, cash, cargo)."
    );
    if (confirmed) {
      startNewGame();
      setIsPopupOpen(false); // Close popup after starting new game
    }
  }, [startNewGame, setIsPopupOpen]);

  return (
    <>
      {/* Settings Icon Button */}
      <button className="settings-icon-button" onClick={togglePopup}>
        +
      </button>

      {/* Settings Popup */}
      {isPopupOpen && (
        <div className="settings-popup-overlay" onClick={togglePopup}>
          <div
            className="settings-popup-content"
            onClick={(e) => e.stopPropagation()} // Prevent overlay click when clicking inside popup
          >
            <h2 className="settings-popup-title" onClick={handleTitleClick} style={{ cursor: "pointer" }}>Settings</h2>
            <div className="settings-popup-options">
              <button
                className="settings-popup-button"
                onClick={handleNewGameClick}
              >
                New Game
              </button>
              {/* Add more settings options here later */}
            </div>
            <button className="settings-popup-close-button" onClick={togglePopup}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default SettingsMenu;