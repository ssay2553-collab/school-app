import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'EDUEAZ_ROBOTICS_LAB_STATE_V1';

export interface RoboticsUserProgress {
  completedLessons: string[];
  completedChallenges: number[];
  totalPoints: number;
  earnedBadges: string[];
  assessmentScores: Record<string, number>;
  updatedAt: string;
}

const DEFAULT_PROGRESS: RoboticsUserProgress = {
  completedLessons: [],
  completedChallenges: [],
  totalPoints: 0,
  earnedBadges: [],
  assessmentScores: {},
  updatedAt: new Date().toISOString(),
};

export async function getLocalRoboticsProgress(): Promise<RoboticsUserProgress> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (data) {
      return { ...DEFAULT_PROGRESS, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('Error reading local robotics progress:', e);
  }
  return DEFAULT_PROGRESS;
}

export async function saveLocalRoboticsProgress(progress: Partial<RoboticsUserProgress>): Promise<RoboticsUserProgress> {
  try {
    const current = await getLocalRoboticsProgress();
    const updated: RoboticsUserProgress = {
      ...current,
      ...progress,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Error saving local robotics progress:', e);
    throw e;
  }
}
