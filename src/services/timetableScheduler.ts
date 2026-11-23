import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { SHS_PROGRAMS } from "../../constants/Curriculum";

export interface Lesson {
  subject: string;
  startTime: string; // "08:00 AM"
  endTime: string;
  day: string; // "Monday"
  program?: string;
}

const DAY_MAP: Record<string, number> = {
  Sunday: 1,
  Monday: 2,
  Tuesday: 3,
  Wednesday: 4,
  Thursday: 5,
  Friday: 6,
  Saturday: 7,
};

export const ALL_SHS_SUBJECTS = Array.from(
  new Set(Object.values(SHS_PROGRAMS).flatMap((p) => p.subjects))
);

export function getShsProgramForSubject(subject: string): string | null {
  if (!subject) return null;
  const subLower = subject.trim().toLowerCase();
  for (const prog of Object.values(SHS_PROGRAMS)) {
    if (prog.subjects.some((s) => s.toLowerCase() === subLower)) {
      return prog.name;
    }
  }
  return null;
}

export async function scheduleTimetableReminders(lessons: Lesson[]) {
  if (Platform.OS === "web") return;

  try {
    // 1. Cancel existing timetable notifications
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (notification.content.data?.type === "timetable_reminder") {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    // 2. Schedule new ones
    for (const lesson of lessons) {
      if (!lesson || !lesson.subject || !lesson.startTime || !lesson.day) continue;
      const dayNum = DAY_MAP[lesson.day];
      if (!dayNum) continue;

      const parts = lesson.startTime.trim().split(" ");
      if (parts.length < 2) continue;
      const [time, period] = parts;
      if (!time || !time.includes(":")) continue;

      let [hours, minutes] = time.split(":").map(Number);
      if (isNaN(hours) || isNaN(minutes)) continue;

      if (period === "PM" && hours !== 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;

      // Schedule 5 minutes before
      let schedMinutes = minutes - 5;
      let schedHours = hours;
      if (schedMinutes < 0) {
        schedMinutes += 60;
        schedHours -= 1;
      }
      if (schedHours < 0) continue; // Skip if it ends up on the previous day

      const shsProgram = lesson.program || getShsProgramForSubject(lesson.subject);
      const title = shsProgram ? `Upcoming Lesson (${shsProgram}) 🍎` : "Upcoming Lesson 🍎";

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body: `Your ${lesson.subject} class starts in 5 minutes (${lesson.startTime}).`,
            data: { type: "timetable_reminder", subject: lesson.subject, program: shsProgram },
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: dayNum,
            hour: schedHours,
            minute: schedMinutes,
            repeats: true,
          } as Notifications.WeeklyTriggerInput,
        });
      } catch (error) {
        console.error("Error scheduling notification:", error);
      }
    }
  } catch (err) {
    console.warn("scheduleTimetableReminders error:", err);
  }
}
