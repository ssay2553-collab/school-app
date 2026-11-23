import { db } from '../../firebaseConfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { RoboticsUserProgress } from './roboticsStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_QUEUE_KEY = 'EDUEAZ_ROBOTICS_OFFLINE_SYNC_QUEUE_V1';

export async function syncRoboticsProgressToFirebase(
  userId: string,
  userName: string,
  progress: RoboticsUserProgress
): Promise<boolean> {
  if (!userId) return false;

  const payload = {
    ...progress,
    userId,
    userName: userName || 'Student/Teacher',
    timestamp: serverTimestamp(),
  };

  try {
    // Attempt primary sync
    await setDoc(doc(db, 'robotics_progress', userId), payload, { merge: true });

    // Also process any queued offline syncs if available
    await processOfflineQueue(userId);
    return true;
  } catch (e) {
    console.error('Error syncing robotics progress to Firebase, queueing offline:', e);
    await queueOfflineSync(userId, payload);
    return false;
  }
}

async function queueOfflineSync(userId: string, payload: any) {
  try {
    const existing = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue = existing ? JSON.parse(existing) : [];
    queue.push({ userId, payload, queuedAt: new Date().toISOString() });
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Error queueing offline robotics sync:', err);
  }
}

async function processOfflineQueue(userId: string) {
  try {
    const existing = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!existing) return;
    const queue: Array<{ userId: string; payload: any; queuedAt: string }> = JSON.parse(existing);
    if (queue.length === 0) return;

    const remaining = [];
    for (const item of queue) {
      try {
        await setDoc(doc(db, 'robotics_progress', item.userId), item.payload, { merge: true });
      } catch (err) {
        remaining.push(item);
      }
    }

    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  } catch (err) {
    console.error('Error processing offline robotics sync queue:', err);
  }
}
