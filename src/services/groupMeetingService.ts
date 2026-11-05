import {
  addDoc,
  collection,
  doc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  increment,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";

// ------------------ TYPES ------------------
export interface GroupMeeting {
  id: string;
  groupId: string;
  groupType: "student" | "staff";
  title: string;
  hostUid: string;
  hostName: string;
  status: "active" | "ended";
  startedAt: any;
  endedAt?: any;
  channelName: string;
  activeParticipantsCount: number;
  maxDurationMinutes: number;
}

export interface MeetingParticipant {
  uid: string;
  fullName: string;
  role: "host" | "member";
  userType: "teacher" | "student" | "admin" | string;
  isMuted: boolean;
  raisedHand: boolean;
  joinedAt: any;
}

// ------------------ SERVICE FUNCTIONS ------------------

/**
  Start a new live group voice meeting
 */
export async function startGroupMeeting(
  groupId: string,
  groupType: "student" | "staff",
  title: string,
  hostUser: { uid: string; fullName: string; userType: string }
): Promise<string> {
  try {
    const channelName = `meeting_${groupId}_${Date.now()}`;
    const meetingsRef = collection(db, "groupMeetings");

    // Staff meetings: max 20 minutes; Student lessons: max 35 minutes
    const maxDurationMinutes = groupType === "staff" ? 20 : 35;

    const meetingData = {
      groupId,
      groupType,
      title: title.trim() || `${groupType === "staff" ? "Staff" : "Student"} Live Meeting`,
      hostUid: hostUser.uid,
      hostName: hostUser.fullName || "Host",
      status: "active",
      startedAt: serverTimestamp(),
      channelName,
      activeParticipantsCount: 1,
      maxDurationMinutes,
    };

    const docRef = await addDoc(meetingsRef, meetingData);
    const meetingId = docRef.id;

    // Add host as first participant
    const hostParticipantRef = doc(db, "groupMeetings", meetingId, "participants", hostUser.uid);
    await setDoc(hostParticipantRef, {
      uid: hostUser.uid,
      fullName: hostUser.fullName || "Host",
      role: "host",
      userType: hostUser.userType || "teacher",
      isMuted: false,
      raisedHand: false,
      joinedAt: serverTimestamp(),
    });

    return meetingId;
  } catch (error) {
    console.error("[GroupMeetingService] Error starting meeting:", error);
    throw error;
  }
}

/**
  Join an active group voice meeting
 */
export async function joinGroupMeeting(
  meetingId: string,
  user: { uid: string; fullName: string; userType: string; isHost?: boolean }
): Promise<void> {
  try {
    const participantRef = doc(db, "groupMeetings", meetingId, "participants", user.uid);
    const meetingRef = doc(db, "groupMeetings", meetingId);

    // Default student users to muted upon entry in student groups
    const defaultMuted = user.userType === "student" && !user.isHost;

    await setDoc(
      participantRef,
      {
        uid: user.uid,
        fullName: user.fullName || "Participant",
        role: user.isHost ? "host" : "member",
        userType: user.userType || "student",
        isMuted: defaultMuted,
        raisedHand: false,
        joinedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Increment active count
    await updateDoc(meetingRef, {
      activeParticipantsCount: increment(1),
    });
  } catch (error) {
    console.error("[GroupMeetingService] Error joining meeting:", error);
    throw error;
  }
}

/**
  Leave an active meeting
 */
export async function leaveGroupMeeting(meetingId: string, uid: string): Promise<void> {
  try {
    const participantRef = doc(db, "groupMeetings", meetingId, "participants", uid);
    const meetingRef = doc(db, "groupMeetings", meetingId);

    await deleteDoc(participantRef);

    await updateDoc(meetingRef, {
      activeParticipantsCount: increment(-1),
    });
  } catch (error) {
    console.error("[GroupMeetingService] Error leaving meeting:", error);
  }
}

/**
  Toggle participant mute status
 */
export async function toggleMuteParticipant(
  meetingId: string,
  uid: string,
  isMuted: boolean
): Promise<void> {
  try {
    const participantRef = doc(db, "groupMeetings", meetingId, "participants", uid);
    await updateDoc(participantRef, { isMuted });
  } catch (error) {
    console.error("[GroupMeetingService] Error toggling mute:", error);
  }
}

/**
  Toggle participant raise hand status
 */
export async function toggleRaiseHandParticipant(
  meetingId: string,
  uid: string,
  raisedHand: boolean
): Promise<void> {
  try {
    const participantRef = doc(db, "groupMeetings", meetingId, "participants", uid);
    await updateDoc(participantRef, { raisedHand });
  } catch (error) {
    console.error("[GroupMeetingService] Error toggling raise hand:", error);
  }
}

/**
  Host action: Mute all participants except host
 */
export async function muteAllMeetingParticipants(meetingId: string, hostUid: string): Promise<void> {
  try {
    const participantsRef = collection(db, "groupMeetings", meetingId, "participants");
    const snapshot = await getDocs(participantsRef);

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      if (docSnap.id !== hostUid) {
        batch.update(docSnap.ref, { isMuted: true });
      }
    });

    await batch.commit();
  } catch (error) {
    console.error("[GroupMeetingService] Error muting all participants:", error);
  }
}

/**
  End a group meeting (Host action)
 */
export async function endGroupMeeting(meetingId: string): Promise<void> {
  try {
    const meetingRef = doc(db, "groupMeetings", meetingId);
    await updateDoc(meetingRef, {
      status: "ended",
      endedAt: serverTimestamp(),
      activeParticipantsCount: 0,
    });
  } catch (error) {
    console.error("[GroupMeetingService] Error ending meeting:", error);
  }
}

/**
  Subscribe to real-time active meeting for a group
 */
export function subscribeToActiveMeeting(
  groupId: string,
  callback: (meeting: GroupMeeting | null) => void
) {
  const meetingsRef = collection(db, "groupMeetings");
  const q = query(meetingsRef, where("groupId", "==", groupId), where("status", "==", "active"));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        callback(null);
      } else {
        const firstDoc = snapshot.docs[0];
        callback({
          id: firstDoc.id,
          ...firstDoc.data(),
        } as GroupMeeting);
      }
    },
    (error) => {
      console.error("[GroupMeetingService] Error in active meeting listener:", error);
      callback(null);
    }
  );
}

/**
  Subscribe to real-time participants list for a meeting
 */
export function subscribeToMeetingParticipants(
  meetingId: string,
  callback: (participants: MeetingParticipant[]) => void
) {
  const participantsRef = collection(db, "groupMeetings", meetingId, "participants");

  return onSnapshot(
    participantsRef,
    (snapshot) => {
      const participants: MeetingParticipant[] = [];
      snapshot.docs.forEach((doc) => {
        participants.push(doc.data() as MeetingParticipant);
      });
      callback(participants);
    },
    (error) => {
      console.error("[GroupMeetingService] Error in participants listener:", error);
      callback([]);
    }
  );
}
