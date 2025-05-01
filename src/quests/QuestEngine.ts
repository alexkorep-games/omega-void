import { GameEvent } from "./QuestEvents";
import { QuestDefinition, Condition } from "./QuestDefinition";
import { QuestState, QuestProgress, ObjectiveProgress } from "./QuestState";
import { IGameState } from "../game/types";

export class QuestEngine {
  private definitions: Map<string, QuestDefinition>;

  constructor(definitions: QuestDefinition[]) {
    this.definitions = new Map(definitions.map((def) => [def.id, def]));
    console.log(
      `QuestEngine initialized with ${this.definitions.size} quest definitions.`
    );
  }

  update(
    prevState: QuestState,
    event: GameEvent,
    currentGameState: IGameState
  ): QuestState {
    const nextState = structuredClone(prevState);
    let stateChanged = false;

    // Initialize progress for any new quests
    for (const questId of this.definitions.keys()) {
      if (!nextState.quests[questId]) {
        nextState.quests[questId] = this.initializeQuestProgress(questId);
        stateChanged = true;
      }
    }

    // Check objectives for all active quests
    for (const questDef of this.definitions.values()) {
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
          event,
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
    const definition = this.definitions.get(questId);
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
    event: GameEvent,
    objectiveProgress: ObjectiveProgress,
    gameState: IGameState
  ): boolean {
    switch (condition.kind) {
      case "credits":
        // Always check current state, update progress counter
        objectiveProgress.current = gameState.cash;
        return gameState.cash >= condition.amount;

      case "dockAt":
        return (
          event.type === "DOCK_FINISH" &&
          event.stationId === condition.stationId
        );

      case "collectItem":
        // Always check current state, update progress counter
        const currentItemCount =
          gameState.questInventory.get(condition.item) || 0;
        objectiveProgress.current = currentItemCount;
        return currentItemCount >= condition.count;

      case "reachWaypoint":
        // Check event for waypoint reached
        return (
          event.type === "WAYPOINT_REACHED" &&
          event.waypointId === condition.waypointId
        );

      case "haveCargo":
        // Always check current state, update progress counter
        const currentCargoCount =
          gameState.cargoHold.get(condition.commodity) || 0;
        objectiveProgress.current = currentCargoCount;
        return currentCargoCount >= condition.count;

      case "killEnemy":
        // Update counter on event, then check total
        if (event.type === "ENEMY_KILL") {
          const roleMatch = !condition.role || event.role === condition.role;
          // const typeMatch = !condition.type || event.enemyType === condition.type; // If type is added later
          if (roleMatch /* && typeMatch */) {
            objectiveProgress.current =
              ((objectiveProgress.current as number) || 0) + 1;
          }
        }
        // Check if total count is met
        return ((objectiveProgress.current as number) || 0) >= condition.count;

      case "deliverItem":
        // This condition is typically met by a specific player action (button press)
        // that consumes the item and potentially triggers an ITEM_REMOVED event.
        // The check here might verify if the player *could* deliver (docked + has item).
        const isDockedCorrectly =
          gameState.gameView !== "playing" &&
          gameState.dockingStationId === condition.stationId;
        const hasRequiredItem =
          (gameState.questInventory.get(condition.item) || 0) >=
          condition.count;
        objectiveProgress.data = {
          ...objectiveProgress.data,
          readyToDeliver: isDockedCorrectly && hasRequiredItem,
        };

        // Actual completion might rely on an ITEM_REMOVED event check elsewhere or a custom event.
        // For simplicity, let's assume completion happens when ITEM_REMOVED matches.
        if (
          event.type === "ITEM_REMOVED" &&
          event.itemId === condition.item &&
          event.quantity >= condition.count && // Ensure enough were removed
          gameState.lastDockedStationId === condition.stationId
        ) {
          // Check context (last docked station)
          return true;
        }
        return false;

      case "custom":
        // Pass full gameState to custom checks
        return condition.test(objectiveProgress, gameState);

      default:
        // Ensure exhaustive check or handle unknown kinds
        // const _exhaustiveCheck: never = condition;
        return false;
    }
  }

  // Calculate completion percentage based on non-optional objectives
  public calculateQuestCompletion(
    questId: string,
    questState: QuestState
  ): number {
    const definition = this.definitions.get(questId);
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
    const definition = this.definitions.get(questId);
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
      if (
        (cond.kind === "collectItem" ||
          cond.kind === "killEnemy" ||
          cond.kind === "haveCargo") &&
        typeof currentVal === "number"
      ) {
        // Ensure currentVal is treated as a number, default to 0 if undefined/null
        const currentNum = Number(currentVal) || 0;
        return `${prefix} [${currentNum} / ${cond.count}] ${desc}`;
      }
      if (cond.kind === "deliverItem" && progress.data?.readyToDeliver) {
        return `${prefix} [Ready to Deliver] ${desc}`;
      }
      // Add more specific progress displays here if needed
    }

    // Default display (prefix + description)
    return `${prefix} ${desc}`;
  }
}
