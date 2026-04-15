import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

/**
 * DIRECT MESSAGES TRIGGER
 * Path: directMessages/{chatId}/messages/{messageId}
 */
export const onNewChatMessage = onDocumentCreated(
  "directMessages/{chatId}/messages/{messageId}",
  async (event) => {
    const messageData = event.data?.data();
    if (!messageData) return;

    const { senderId, text } = messageData;
    const { chatId } = event.params;

    const uids = chatId.split("_");
    const recipientId = uids.find((id: string) => id !== senderId);

    if (!recipientId) return;

    try {
      const recipientDoc = await admin
        .firestore()
        .doc(`users/${recipientId}`)
        .get();
      const recipientData = recipientDoc.data();

      if (!recipientData || !recipientData.fcmToken) return;

      const senderDoc = await admin.firestore().doc(`users/${senderId}`).get();
      const senderData = senderDoc.data();
      const senderName = senderData?.profile?.firstName || "Someone";

      const message = {
        notification: {
          title: `Message from ${senderName}`,
          body: text
            ? text.length > 100
              ? text.substring(0, 97) + "..."
              : text
            : (messageData.type === "audio" ? "Sent a voice message 🎤" : "Sent an attachment"),
        },
        data: { chatId, type: "chat_message" },
        token: recipientData.fcmToken,
      };

      await admin.messaging().send(message);
      console.log(`Direct chat notification sent to ${recipientId}`);
      // Update unread counters for recipient (server-side unread sync)
      try {
        const userRef = admin.firestore().doc(`users/${recipientId}`);
        await userRef.update({
          [`unreads.direct.${chatId}`]: admin.firestore.FieldValue.increment(1),
          [`unreads.total`]: admin.firestore.FieldValue.increment(1),
        } as any);
      } catch (e) {
        // If update fails (e.g., field missing), try set with merge
        try {
          await admin
            .firestore()
            .doc(`users/${recipientId}`)
            .set(
              {
                unreads: { direct: { [chatId]: 1 }, total: 1 },
              },
              { merge: true },
            );
        } catch (err) {
          console.error("Failed to update unread counters for recipient:", err);
        }
      }
    } catch (error) {
      console.error("Error sending chat notification:", error);
    }
  },
);

/**
 * GROUP MESSAGES TRIGGER
 * Path: studentGroups/{groupId}/messages/{messageId}
 */
export const onNewGroupMessage = onDocumentCreated(
  "studentGroups/{groupId}/messages/{messageId}",
  async (event) => {
    const messageData = event.data?.data();
    if (!messageData) return;

    const { from: senderId, text, senderName, type } = messageData;
    const { groupId } = event.params;

    try {
      // 1. Get group info to find participants
      const groupDoc = await admin
        .firestore()
        .doc(`studentGroups/${groupId}`)
        .get();
      const groupData = groupDoc.data();
      if (!groupData) return;

      const groupName = groupData.name || "Group Chat";
      const participants: string[] = [
        groupData.teacherId,
        ...(groupData.studentIds || []),
      ];

      // 2. Filter out the sender
      const recipientIds = participants.filter((id) => id && id !== senderId);

      // 3. Get tokens for all recipients
      const tokens: string[] = [];
      for (const uid of recipientIds) {
        const userDoc = await admin.firestore().doc(`users/${uid}`).get();
        const userData = userDoc.data();
        if (userData?.fcmToken) {
          tokens.push(userData.fcmToken);
        }
      }

      if (tokens.length === 0) return;

      // 4. Send multicast notification
      const notificationBody =
        type === "text"
          ? text.length > 100
            ? text.substring(0, 97) + "..."
            : text
          : `Sent a ${type}`;

      const message = {
        notification: {
          title: `${senderName} in ${groupName}`,
          body: notificationBody,
        },
        data: { groupId, type: "group_message" },
        tokens: tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(
        `Sent ${response.successCount} group notifications for ${groupId}`,
      );

      // Update unread counters for each recipient
      try {
        const batch = admin.firestore().batch();
        for (const uid of recipientIds) {
          const userRef = admin.firestore().doc(`users/${uid}`);
          batch.update(userRef, {
            [`unreads.groups.${groupId}`]:
              admin.firestore.FieldValue.increment(1),
            [`unreads.total`]: admin.firestore.FieldValue.increment(1),
          } as any);
        }
        await batch.commit();
      } catch (e) {
        // Fallback: update individually
        for (const uid of recipientIds) {
          try {
            await admin
              .firestore()
              .doc(`users/${uid}`)
              .update({
                [`unreads.groups.${groupId}`]:
                  admin.firestore.FieldValue.increment(1),
                [`unreads.total`]: admin.firestore.FieldValue.increment(1),
              } as any);
          } catch (err) {
            try {
              await admin
                .firestore()
                .doc(`users/${uid}`)
                .set(
                  {
                    unreads: { groups: { [groupId]: 1 }, total: 1 },
                  },
                  { merge: true },
                );
            } catch (err2) {
              console.error("Failed to update unread for user", uid, err2);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending group notification:", error);
    }
  },
);

/**
 * GUEST TICKETS TRIGGER
 * Path: guestTickets/{ticketId}/messages/{messageId}
 */
export const onNewGuestMessage = onDocumentCreated(
  "guestTickets/{ticketId}/messages/{messageId}",
  async (event) => {
    const messageData = event.data?.data();
    if (!messageData) return;

    const { sender, text } = messageData;
    const { ticketId } = event.params;

    try {
      const ticketDoc = await admin
        .firestore()
        .doc(`guestTickets/${ticketId}`)
        .get();
      const ticketData = ticketDoc.data();
      if (!ticketData) return;

      let recipientId = "";
      let title = "";

      if (sender === "guest") {
        // Notify the assigned admin, or all admins if not assigned
        recipientId = ticketData.claimedByUid;
        title = "New Guest Message";
      } else {
        // Notify the guest
        recipientId = ticketData.guestUid;
        title = "Support Response";
      }

      if (!recipientId) {
        // If no admin claimed it, notify all relevant admins
        if (sender === "guest") {
          const adminsSnap = await admin
            .firestore()
            .collection("users")
            .where("role", "==", "admin")
            .get();

          const tokens: string[] = [];
          adminsSnap.forEach((doc) => {
            const data = doc.data();
            if (data.fcmToken) tokens.push(data.fcmToken);
          });

          if (tokens.length > 0) {
            await admin.messaging().sendEachForMulticast({
              notification: { title, body: text },
              data: { ticketId, type: "guest_chat" },
              tokens: tokens,
            });
          }
        }
        return;
      }

      const recipientDoc = await admin
        .firestore()
        .doc(`users/${recipientId}`)
        .get();
      const recipientData = recipientDoc.data();

      if (recipientData?.fcmToken) {
        await admin.messaging().send({
          notification: { title, body: text },
          data: { ticketId, type: "guest_chat" },
          token: recipientData.fcmToken,
        });
      }
    } catch (error) {
      console.error("Error sending guest chat notification:", error);
    }
  },
);

/**
 * Scheduled function to delete chat messages older than 7 days.
 * Also cleans up inactive FCM tokens (not updated in last 1 hour).
 * Runs every hour.
 */
export const cleanupTask = onSchedule("0 * * * *", async () => {
  const db = admin.firestore();

  // 1. Delete old messages (7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoffMessages = admin.firestore.Timestamp.fromDate(sevenDaysAgo);

  try {
    const directChatsSnap = await db.collection("directMessages").get();
    for (const chatDoc of directChatsSnap.docs) {
      const messagesRef = chatDoc.ref.collection("messages");
      const oldMessagesSnap = await messagesRef
        .where("createdAt", "<", cutoffMessages)
        .get();
      if (!oldMessagesSnap.empty) {
        const batch = db.batch();
        oldMessagesSnap.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    }

    const studentGroupsSnap = await db.collection("studentGroups").get();
    for (const groupDoc of studentGroupsSnap.docs) {
      const messagesRef = groupDoc.ref.collection("messages");
      const oldMessagesSnap = await messagesRef
        .where("createdAt", "<", cutoffMessages)
        .get();
      if (!oldMessagesSnap.empty) {
        const batch = db.batch();
        oldMessagesSnap.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    }
  } catch (e) {
    console.error("Old message cleanup error:", e);
  }

  // 2. Token auto-delete after 1 hour of inactivity
  // We need a 'tokenLastActive' field to track this reliably.
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);
  const cutoffTokens = admin.firestore.Timestamp.fromDate(oneHourAgo);

  try {
    const usersWithTokens = await db
      .collection("users")
      .where("fcmToken", "!=", null)
      .where("tokenLastActive", "<", cutoffTokens)
      .get();

    if (!usersWithTokens.empty) {
      const batch = db.batch();
      usersWithTokens.forEach((doc) => {
        batch.update(doc.ref, {
          fcmToken: admin.firestore.FieldValue.delete(),
          tokenLastActive: admin.firestore.FieldValue.delete(),
        });
      });
      await batch.commit();
      console.log(`Cleared ${usersWithTokens.size} inactive FCM tokens.`);
    }
  } catch (e) {
    console.error("Token cleanup error:", e);
  }
});
