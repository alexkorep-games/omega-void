// src/components/SettingsMenu.tsx
import React, { useState, useCallback } from "react";
import { useGameState } from "../hooks/useGameState";
import "./SettingsMenu.css"; // We'll create this next

const SettingsMenu: React.FC = () => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const { startNewGame } = useGameState();

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
            <h2 className="settings-popup-title">Settings</h2>
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