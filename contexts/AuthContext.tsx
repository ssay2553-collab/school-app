import { User as FirebaseUser, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
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
    if (firebaseUser && firebaseUser.uid !== lastSyncedUid.current) {
      const syncToken = async () => {
        try {
          const token = await registerForPushNotificationsAsync();
          if (token) {
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
  }, [firebaseUser]);

  useEffect(() => {
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

      const userRef = doc(db, "users", user.uid);

      unsubscribeProfile = onSnapshot(
        userRef,
        (snap) => {
          if (!snap.exists()) {
            setLoading(false);
            return;
          }

          const data = snap.data() || {};
          const mapped: AppUser = {
            uid: user.uid,
            role: data.role || data.profile?.role,
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
            classes: data.classes ?? data.profile?.classes ?? [],
            subjects: data.subjects ?? data.profile?.subjects ?? [],
            classId: data.classId || data.profile?.classId,
            childrenIds: data.childrenIds || data.profile?.childrenIds,
            childrenClassIds: data.childrenClassIds || data.profile?.childrenClassIds,
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
        },
        (error) => {
          console.error("Profile Listener Error:", error);
          setLoading(false);
        },
      );
    });

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => useContext(AuthContext);
