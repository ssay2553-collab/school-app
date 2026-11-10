// Firebase Messaging Service Worker for EduEaz PWA Background Notifications
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

self.addEventListener("push", function (event) {
  if (event.data) {
    try {
      const payload = event.data.json();
      const notification = payload.notification || payload.data || {};
      const title = notification.title || "EduEaz Alert 🔔";
      const options = {
        body: notification.body || notification.message || "You have a new update from EduEaz.",
        icon: notification.icon || "/icon-192.png",
        badge: "/icon-192.png",
        data: notification.data || payload.data || {},
        vibrate: [200, 100, 200],
      };

      event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
      const text = event.data.text();
      event.waitUntil(
        self.registration.showNotification("EduEaz Notification 🔔", {
          body: text,
          icon: "/icon-192.png",
        }),
      );
    }
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow("/");
        }
      }),
  );
});
