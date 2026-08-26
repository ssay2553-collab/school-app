import { User as FirebaseUser, onAuthStateChanged } from "firebase/auth";
import {
    collection,
    doc,
    getDocs,
    limit,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    where,
} from "firebase/firestore";
import React, {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { auth, db } from "../firebaseConfig";
import { AppUser } from "../types/users";
import { registerForPushNotificationsAsync } from "../utils/notifications";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  appUser: null,
  loading: true,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const lastSyncedUid = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (firebaseUser && firebaseUser.uid !== lastSyncedUid.current) {
      const syncToken = async () => {
        try {
          const token = await registerForPushNotificationsAsync();
          if (token && isMounted) {
            const userRef = doc(db, "users", firebaseUser.uid);
            await setDoc(
              userRef,
              {
                fcmToken: token,
                tokenLastActive: serverTimestamp(),
              },
              { merge: true },
            );
          }
          lastSyncedUid.current = firebaseUser.uid;
        } catch (err) {
          lastSyncedUid.current = firebaseUser.uid;
        }
      };
      syncToken();
    }
    return () => { isMounted = false; };
  }, [firebaseUser]);

  useEffect(() => {
    let isMounted = true;
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        lastSyncedUid.current = null;
        setAppUser(null);
        setLoading(false);
        if (unsubscribeProfile) unsubscribeProfile();
        return;
      }

      // Reset loading state when a user is detected but profile isn't loaded yet
      setLoading(true);

      const processSnap = (snap: any) => {
        if (!isMounted || !snap.exists()) return false;

        const data = snap.data() || {};
        // Normalize role and infer 'staff' for upgraded accounts with adminRole
        const rawRole =
          data.role ||
          data.profile?.role ||
          (data.adminRole ? "staff" : undefined);
        const role =
          typeof rawRole === "string" ? rawRole.toLowerCase() : rawRole;

        const isAdmin =
          (role && (role.includes("admin") || role.includes("super") || role === "manager" || role === "staff")) ||
          !!data.adminRole ||
          !!data.profile?.adminRole;

        const mapped: AppUser = {
          uid: snap.id, // Use document ID
          role: role as any,
          status: data.status || data.profile?.status,
          adminRole: data.adminRole || data.profile?.adminRole,
          permissions: data.permissions || data.profile?.permissions,
          dateOfBirth: data.dateOfBirth || data.profile?.dateOfBirth,
          profile: {
            firstName: data.profile?.firstName ?? "",
            lastName: data.profile?.lastName ?? "",
            email: data.profile?.email,
            phone: data.profile?.phone,
            profileImage: data.profile?.profileImage,
            signatureUrl: data.profile?.signatureUrl,
            bio: data.profile?.bio,
            experience: data.profile?.experience,
            education: data.profile?.education,
            gender: data.profile?.gender,
            dob: data.profile?.dob || data.dateOfBirth,
          },
          displayName:
            data.displayName ||
            (data.profile?.firstName
              ? `${data.profile.firstName} ${data.profile.lastName || ""}`.trim()
              : data.username) ||
            undefined,
          fullName:
            data.fullName ||
            data.profile?.fullName ||
            data.displayName ||
            (data.profile?.firstName
              ? `${data.profile.firstName} ${data.profile.lastName || ""}`.trim()
              : data.username),
          classes: data.classes ?? data.profile?.classes ?? [],
          subjects: data.subjects ?? data.profile?.subjects ?? [],
          classId: data.classId || data.profile?.classId,
          childrenIds: data.childrenIds || data.profile?.childrenIds,
          childrenClassIds:
            data.childrenClassIds || data.profile?.childrenClassIds,
          createdAt: data.createdAt,
          parentUids: data.parentUids || data.profile?.parentUids,
          parentLinkCode: data.parentLinkCode || data.profile?.parentLinkCode,
          schoolId: data.schoolId || data.profile?.schoolId,
          curriculum: data.curriculum || data.profile?.curriculum,
          departments: data.departments || data.profile?.departments,
          classTeacherOf: data.classTeacherOf || data.profile?.classTeacherOf,
          assignedRoles: data.assignedRoles || data.profile?.assignedRoles,
        };

        setAppUser(mapped);
        setLoading(false);
        return true;
      };

      const userRef = doc(db, "users", user.uid);

      // Listener for direct UID match
      unsubscribeProfile = onSnapshot(
        userRef,
        async (snap) => {
          if (snap.exists()) {
            processSnap(snap);
          } else {
            // Fallback: Check for staff with legacy IDs mapped via authUid
            try {
              const q = query(
                collection(db, "users"),
                where("authUid", "==", user.uid),
                limit(1),
              );
              const querySnap = await getDocs(q);
              if (!querySnap.empty && isMounted) {
                // Document found by authUid field
                const staffDoc = querySnap.docs[0];
                if (unsubscribeProfile) {
                  unsubscribeProfile();
                  unsubscribeProfile = null;
                }
                // Create a mapping from auth UID to the actual user document ID
                try {
                  await setDoc(
                    doc(db, "userAuthMappings", user.uid),
                    {
                      userDocId: staffDoc.id,
                    },
                    { merge: true },
                  );
                } catch (mapErr) {
                  console.warn("Failed to create auth mapping doc:", mapErr);
                }
                // Setup persistent listener on the actual document
                unsubscribeProfile = onSnapshot(staffDoc.ref, (innerSnap) => {
                  processSnap(innerSnap);
                });
              } else {
                setLoading(false);
              }
            } catch (err) {
              console.error("Auth fallback error:", err);
              setLoading(false);
            }
          }
        },
        (error) => {
          console.error("Profile Listener Error:", error);
          setLoading(false);
        },
      );
    });

    return () => {
      isMounted = false;
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => useContext(AuthContext);
