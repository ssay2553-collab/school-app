import * as Notifications from 'expo-notifications';

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
