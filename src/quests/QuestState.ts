export interface ObjectiveProgress {
  done: boolean;
  current?: number | string;
  data?: Record<string, any>;
}

export type QuestProgress = Record<string, ObjectiveProgress>;

export interface QuestState {
  quests: Record<string, QuestProgress>;
}

export const initialQuestState: QuestState = {
  quests: {},
};
