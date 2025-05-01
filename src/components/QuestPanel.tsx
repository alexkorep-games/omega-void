import React from "react";
import { useGameState } from "../hooks/useGameState";
import { QuestDefinition, V01_QUEST_DEFINITIONS } from "../quests";
import "./Market.css"; // Reuse market styles for consistency
import "./QuestPanel.css"; // Create specific styles

const QuestPanel: React.FC = () => {
  const { gameState, questEngine } = useGameState();
  const { questState, cash } = gameState;

  // For v0.1, we only have one quest definition
  const questDef: QuestDefinition | undefined = V01_QUEST_DEFINITIONS[0];

  if (!questDef) {
    return (
      <div className="market-container quest-panel">
        <div className="market-header">
          <div className="market-title">CONTRACT STATUS</div>
        </div>
        <div className="market-loading">Quest definitions not loaded...</div>
      </div>
    );
  }

  const questId = questDef.id;
  // Ensure quest progress exists in the state before accessing
  const currentQuestProgress = questState?.quests?.[questId];

  // Calculate score using the engine helper, handle potential undefined state
  const emancipationScore = questState
    ? questEngine.calculateQuestCompletion(questId, questState)
    : 0;

  return (
    <div className="market-container quest-panel">
      <div className="market-header">
        <div className="market-title">CONTRACT STATUS</div>
        <div className="market-credits">{cash.toFixed(1)} CR</div>
      </div>

      <div className="quest-list">
        {/* Display the main v0.1 quest */}
        <div className="quest-item main-quest">
          <div className="quest-title">{questDef.title}</div>
          {questDef.description && (
            <div className="quest-description">{questDef.description}</div>
          )}
          <div className="quest-overall-progress">
            Emancipation Progress: {emancipationScore.toFixed(1)}%
          </div>
          <div className="quest-objectives">
            {/* Render objectives only if progress exists */}
            {currentQuestProgress &&
              questDef.objectives
                .filter((obj) => !obj.hidden) // Filter out hidden objectives
                .map((objective) => {
                  const progress = currentQuestProgress[objective.id];
                  const progressText = questEngine.getObjectiveProgressText(
                    questId,
                    objective.id,
                    questState
                  );
                  const isDone = progress?.done ?? false;
                  return (
                    <div
                      key={objective.id}
                      className={`objective-item ${
                        isDone ? "done" : "incomplete"
                      }`}
                      title={objective.description} // Add tooltip with full description
                    >
                      {progressText}
                    </div>
                  );
                })}
            {/* Show message if quest progress hasn't been initialized yet */}
            {!currentQuestProgress && <div>Loading objectives...</div>}
          </div>
        </div>
        {/* Placeholder for potentially listing other active quests in the future */}
        {/* {Object.keys(questState.quests).filter(id => id !== questId).map(otherQuestId => ...)} */}
      </div>

      <div className="market-footer">
        <span>Review your progress towards freedom.</span>
      </div>
    </div>
  );
};

export default QuestPanel;
