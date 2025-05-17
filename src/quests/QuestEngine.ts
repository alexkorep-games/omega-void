import { QuestDefinition, Condition } from "./QuestDefinition";
import { QuestState, QuestProgress, ObjectiveProgress } from "./QuestState";
import { IGameColdState } from "../game/types";

export class QuestEngine {
  private definitions: Record<string, QuestDefinition>;

  constructor(definitions: QuestDefinition[]) {
    this.definitions = definitions.reduce((acc, def) => {
      acc[def.id] = def;
      return acc;
    }, {} as Record<string, QuestDefinition>);
    console.log(
      `QuestEngine initialized with ${
        Object.keys(this.definitions).length
      } quest definitions.`
    );
  }

  update(
    prevState: QuestState,
    currentGameState: IGameColdState
  ): QuestState {
    const nextState = structuredClone(prevState);
    let stateChanged = false;

    // Initialize progress for any new quests
    for (const questId of Object.keys(this.definitions)) {
      if (!nextState.quests[questId]) {
        nextState.quests[questId] = this.initializeQuestProgress(questId);
        stateChanged = true;
      }
    }

    // Check objectives for all active quests
    for (const questDef of Object.values(this.definitions)) {
      const questId = questDef.id;
      const questProgress = nextState.quests[questId];
      if (!questProgress) continue; // Should not happen after initialization step

      for (const objective of questDef.objectives) {
        const objectiveId = objective.id;
        // Ensure objective progress exists
        if (!questProgress[objectiveId]) {
          questProgress[objectiveId] = { done: false };
          stateChanged = true;
        }
        const objectiveProgress = questProgress[objectiveId];

        // Skip already completed objectives
        if (objectiveProgress.done) continue;

        // Check if the condition is met based on the event and current game state
        const completed = this._checkCondition(
          objective.condition,
          objectiveProgress, // Pass progress object for potential updates (e.g., counters)
          currentGameState // Pass full game state
        );

        if (completed) {
          objectiveProgress.done = true;
          stateChanged = true;
          console.log(
            `Quest objective completed: [${questId}] -> ${objectiveId}`
          );
          // TODO: Handle rewards, reveals etc.
        } else if (objectiveProgress.current !== undefined) {
          // If condition wasn't met but progress counter was updated, mark state as changed
          stateChanged = true;
        }
      }
    }

    // Only return new object if state actually changed
    return stateChanged ? nextState : prevState;
  }

  private initializeQuestProgress(questId: string): QuestProgress {
    const definition = this.definitions[questId];
    if (!definition) {
      console.error(
        `Cannot initialize progress for unknown quest ID: ${questId}`
      );
      return {};
    }
    const progress: QuestProgress = {};
    for (const objective of definition.objectives) {
      progress[objective.id] = { done: false };
    }
    return progress;
  }

  // Updated _checkCondition to use gameState and update objectiveProgress.current
  private _checkCondition(
    condition: Condition,
    objectiveProgress: ObjectiveProgress,
    gameState: IGameColdState
  ): boolean {
    switch (condition.kind) {
      case "credits":
        objectiveProgress.current = gameState.cash;
        return gameState.cash >= condition.amount;

      default:
        return false;
    }
  }

  // Calculate completion percentage based on non-optional objectives
  public calculateQuestCompletion(
    questId: string,
    questState: QuestState
  ): number {
    const definition = this.definitions[questId];
    const progress = questState.quests[questId];
    if (!definition || !progress) return 0;

    const requiredObjectives = definition.objectives.filter(
      (obj) => !obj.optional
    );
    if (requiredObjectives.length === 0) return 100; // No required objectives means 100% complete

    const completedRequired = requiredObjectives.filter(
      (obj) => progress[obj.id]?.done
    ).length;

    // Calculate percentage based on required objectives
    return (completedRequired / requiredObjectives.length) * 100;
  }

  // Generate display text for an objective
  public getObjectiveProgressText(
    questId: string,
    objectiveId: string,
    questState: QuestState
  ): string {
    const definition = this.definitions[questId];
    const objective = definition?.objectives.find(
      (obj) => obj.id === objectiveId
    );
    const progress = questState.quests[questId]?.[objectiveId];

    if (!objective || !progress) return objective?.description || objectiveId;

    const desc = objective.description || objectiveId; // Fallback to ID if no description
    const cond = objective.condition;
    const currentVal = progress.current; // Use stored current value from objectiveProgress

    const prefix = progress.done ? "[✔]" : "[ ]";

    // Add progress details for specific condition types if not done
    if (!progress.done) {
      if (cond.kind === "credits" && typeof currentVal === "number") {
        return `${prefix} [${currentVal.toFixed(0)} / ${cond.amount}] ${desc}`;
      }
    }

    // Default display (prefix + description)
    return `${prefix} ${desc}`;
  }
}
