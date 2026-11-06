import * as Notifications from 'expo-notifications';
import moment from 'moment';
import { parseDateSafely } from '../lib/classHelpers';

export const playNotification = async () => {
    await Notifications.scheduleNotificationAsync({
        content: {
            title: "New Guest Message",
            body: "A new guest is waiting for assistance.",
            sound: 'default',
        },
        trigger: null, // immediately
    });
};

export const generateId = () => {
    return Math.random().toString(36).substring(2, 15);
};

export const processMessagesWithDates = (messages: any[]) => {
  if (!messages || messages.length === 0) return [];

  const result: any[] = [];
  let lastDateKey: string | null = null;

  messages.forEach((msg) => {
    const rawTs = msg.createdAt || msg.timestamp;
    const parsedDate = parseDateSafely(rawTs);

    let dateKey = "Unknown";
    let dateLabel = "Recent";

    if (parsedDate) {
      const mDate = moment(parsedDate);
      dateKey = mDate.format("YYYY-MM-DD");

      const today = moment().startOf("day");
      const yesterday = moment().subtract(1, "days").startOf("day");

      if (mDate.isSame(today, "day")) {
        dateLabel = "Today";
      } else if (mDate.isSame(yesterday, "day")) {
        dateLabel = "Yesterday";
      } else if (mDate.isAfter(moment().subtract(7, "days"), "day")) {
        dateLabel = mDate.format("dddd"); // e.g. Monday
      } else {
        dateLabel = mDate.format("MMMM D, YYYY"); // e.g. October 24, 2023
      }
    }

    if (dateKey !== lastDateKey) {
      result.push({
        isDateHeader: true,
        id: `date_${dateKey}_${Math.random()}`,
        label: dateLabel,
      });
      lastDateKey = dateKey;
    }

    result.push(msg);
  });

  return result;
};
