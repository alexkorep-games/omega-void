// src/components/UpgradeScreen.tsx
import React, { useState, useCallback, useRef } from "react";
import { useGameState } from "../hooks/useGameState";
import "./Market.css"; // Reuse market styles
import "./UpgradeScreen.css"; // Add specific styles
import { UpgradeKey } from "../game/logic";
import { UPGRADE_CONFIG } from "../game/upgradesConfig";

interface StatusMessage {
  text: string;
  type: "info" | "error" | "success";
  timestamp: number;
}

const MESSAGE_DURATION = 2500;

const UpgradeScreen: React.FC = () => {
  const { gameState, purchaseUpgrade } = useGameState();
  const {
    cash,
    cargoPodLevel,
    shieldCapacitorLevel,
    engineBoosterLevel,
    hasAutoloader,
    hasNavComputer,
  } = gameState;

  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null
  );
  const messageTimeoutRef = useRef<number | null>(null);

  const showMessage = useCallback(
    (text: string, type: StatusMessage["type"]) => {
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      setStatusMessage({ text, type, timestamp: Date.now() });
      messageTimeoutRef.current = window.setTimeout(() => {
        setStatusMessage(null);
      }, MESSAGE_DURATION);
    },
    []
  );

  const handlePurchase = (key: UpgradeKey) => {
    const success = purchaseUpgrade(key);
    if (success) {
      const config = UPGRADE_CONFIG[key];
      showMessage(`${config.name} purchased/upgraded!`, "success");
    } else {
      // Determine reason for failure (could refine this)
      const config = UPGRADE_CONFIG[key];
      let currentLevel = 0;
      switch (key) {
        case "cargoPod":
          currentLevel = cargoPodLevel;
          break;
        case "shieldCapacitor":
          currentLevel = shieldCapacitorLevel;
          break;
        case "engineBooster":
          currentLevel = engineBoosterLevel;
          break;
        case "autoloader":
          currentLevel = hasAutoloader ? 1 : 0;
          break;
        case "navComputer":
          currentLevel = hasNavComputer ? 1 : 0;
          break;
      }

      if (currentLevel >= config.maxLevel) {
        showMessage(`Error: ${config.name} already at max level.`, "error");
      } else if (cash < config.costs[currentLevel]) {
        showMessage(`Error: Insufficient credits for ${config.name}.`, "error");
      } else {
        showMessage(`Error: Cannot purchase ${config.name}.`, "error"); // Generic fallback
      }
    }
  };

  const upgrades: UpgradeKey[] = [
    "cargoPod",
    "shieldCapacitor",
    "engineBooster",
    "autoloader",
    "navComputer",
  ];

  return (
    <div className="market-container upgrade-screen">
      <div className="market-header">
        <div className="market-title">SHIP UPGRADES</div>
        <div className="market-credits">{cash.toFixed(1)} CR</div>
      </div>

      <div className="upgrade-list">
        {upgrades.map((key) => {
          const config = UPGRADE_CONFIG[key];
          let currentLevel = 0;
          switch (key) {
            case "cargoPod":
              currentLevel = cargoPodLevel;
              break;
            case "shieldCapacitor":
              currentLevel = shieldCapacitorLevel;
              break;
            case "engineBooster":
              currentLevel = engineBoosterLevel;
              break;
            case "autoloader":
              currentLevel = hasAutoloader ? 1 : 0;
              break;
            case "navComputer":
              currentLevel = hasNavComputer ? 1 : 0;
              break;
          }

          const isMaxLevel = currentLevel >= config.maxLevel;
          const cost = isMaxLevel ? 0 : config.costs[currentLevel];
          const canAfford = cash >= cost;
          const isDisabled = isMaxLevel || !canAfford;

          let statusText = "";
          if (config.maxLevel > 1) {
            statusText = `Level: ${currentLevel} / ${config.maxLevel}`;
          } else {
            statusText = currentLevel > 0 ? "Installed" : "Not Installed";
          }
          if (isMaxLevel && config.maxLevel > 0) {
            statusText += " (MAX)";
          }

          return (
            <div key={key} className="upgrade-item">
              <div className="upgrade-info">
                <span className="upgrade-name">{config.name}</span>
                <span className="upgrade-effect">{config.effectDesc}</span>
                <span className="upgrade-status">{statusText}</span>
              </div>
              <div className="upgrade-action">
                <span
                  className={`upgrade-cost ${
                    !isMaxLevel && !canAfford ? "unaffordable" : ""
                  }`}
                >
                  {!isMaxLevel ? `${cost.toFixed(1)} CR` : "-"}
                </span>
                <button
                  className={`upgrade-button ${isDisabled ? "disabled" : ""}`}
                  onClick={() => !isDisabled && handlePurchase(key)}
                  disabled={isDisabled}
                  title={
                    isMaxLevel
                      ? "Maximum level reached"
                      : !canAfford
                      ? `Need ${cost.toFixed(1)} CR`
                      : `Purchase for ${cost.toFixed(1)} CR`
                  }
                >
                  {isMaxLevel
                    ? "MAX"
                    : currentLevel > 0
                    ? "UPGRADE"
                    : "PURCHASE"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="market-footer">
        {statusMessage && (
          <div
            className="status-message"
            style={{
              color:
                statusMessage.type === "error"
                  ? "#FF5555"
                  : statusMessage.type === "success"
                  ? "#55FF55"
                  : "#FFFF00",
              width: "100%", // Make status message take full width
              textAlign: "center", // Center the text
            }}
          >
            {statusMessage.text}
          </div>
        )}
        {!statusMessage && <span>Select an upgrade to purchase.</span>}
      </div>
    </div>
  );
};

export default UpgradeScreen;
