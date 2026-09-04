import { useState, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import {
    createUserWithEmailAndPassword,
} from 'firebase/auth';
import {
    collection,
    doc,
    getDocs,
    getDocsFromServer,
    limit,
    query,
    serverTimestamp,
    Timestamp,
    where,
    writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { auth, db, storage, functions } from '../../firebaseConfig';
import { SCHOOL_CONFIG } from '../../constants/Config';
import { useToast } from '../../contexts/ToastContext';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getStudentFinalEmail } from '../../utils/authUnify';

interface ClassItem {
    id: string;
    name: string;
}

let cachedClasses: ClassItem[] | null = null;

export const useStudentSignup = () => {
    const router = useRouter();
    const { showToast } = useToast();
    const [step, setStep] = useState(1);
    const [classes, setClasses] = useState<ClassItem[]>(cachedClasses || []);
    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        gender: "",
        selectedClassId: "",
        signupCode: "",
        dateOfBirth: null as Date | null,
        profileImage: null as string | null,
    });

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isCodeVerified, setIsCodeVerified] = useState(false);

    useEffect(() => {
        const fetchClasses = async () => {
            if (cachedClasses && cachedClasses.length > 0) return;
            try {
                const q = query(collection(db, "classes"));
                const snap = await getDocsFromServer(q as any);
                const list = snap.docs
                    .map((d) => ({ id: d.id, ...(d.data() as any) } as any))
                    .map((d) => ({ id: d.id, name: d.name || d.id }));

                const sorted = list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                setClasses(sorted);
                cachedClasses = sorted;
            } catch (err) {
                console.error("Failed to fetch classes:", err);
            }
        };
        fetchClasses();
    }, []);

    const generateLinkCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    };

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission Denied", "We need access to your gallery to upload a profile picture.");
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 1,
            });

            if (!result.canceled) {
                const manipResult = await ImageManipulator.manipulateAsync(
                    result.assets[0].uri,
                    [{ resize: { width: 300, height: 300 } }],
                    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
                );
                setForm(prev => ({ ...prev, profileImage: manipResult.uri }));
            }
        } catch (e) {
            console.error("Image pick error:", e);
            Alert.alert("Error", "Failed to open image gallery.");
        }
    };

    const verifyCode = async () => {
        if (!form.signupCode.trim()) {
            showToast({ message: "Please enter your signup code.", type: "error" });
            return;
        }
        setLoading(true);
        try {
            const cleanCode = form.signupCode.trim().toUpperCase();

            const pendingQuery = query(
                collection(db, "users"),
                where("signupCode", "==", cleanCode),
                where("role", "==", "student"),
                where("status", "==", "pending_activation"),
                limit(1)
            );
            const pendingSnapshot = await getDocs(pendingQuery);
            const pendingDoc = pendingSnapshot.docs.find(d => d.data().status === "pending_activation");

            if (pendingDoc) {
                const data = pendingDoc.data();
                setForm(prev => ({
                    ...prev,
                    firstName: data.profile?.firstName || prev.firstName,
                    lastName: data.profile?.lastName || prev.lastName,
                    email: data.email || data.profile?.email || prev.email,
                    gender: data.profile?.gender || data.gender || "",
                    selectedClassId: data.classId || prev.selectedClassId,
                    dateOfBirth: data.dateOfBirth?.toDate ? data.dateOfBirth.toDate() : (data.dateOfBirth ? new Date(data.dateOfBirth) : null),
                }));
                showToast({ message: `Welcome ${data.profile?.firstName}! Profile found.`, type: "success" });
                setIsCodeVerified(true);
                setStep(2);
                return;
            }

            const q = query(collection(db, "signupCodes"), where("code", "==", cleanCode), limit(1));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                throw new Error("Invalid signup code. Please check with your teacher.");
            }

            const codeData = querySnapshot.docs[0].data();
            if (codeData.classId) {
                setForm(prev => ({ ...prev, selectedClassId: codeData.classId }));
            }

            showToast({ message: "Code verified! Please complete your account details.", type: "success" });
            setIsCodeVerified(true);
            setStep(2);
        } catch (err: any) {
            showToast({ message: err.message || "Verification failed.", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const validateStep = () => {
        if (step === 1) {
            if (!form.signupCode.trim()) {
                showToast({ message: "Please enter your signup code.", type: "error" });
                return false;
            }
            if (!isCodeVerified) {
                verifyCode();
                return false;
            }
        } else if (step === 2) {
            if (!form.firstName.trim() || !form.lastName.trim()) {
                showToast({ message: "Please enter your full name.", type: "error" });
                return false;
            }
            if (!form.email.trim()) {
                showToast({ message: "Please enter an email address.", type: "error" });
                return false;
            }
            if (form.email.trim().includes(" ")) {
                showToast({ message: "Email or username cannot contain spaces.", type: "error" });
                return false;
            }
            if (form.password.length < 6) {
                showToast({ message: "Password must be at least 6 characters.", type: "error" });
                return false;
            }
            if (form.password !== form.confirmPassword) {
                showToast({ message: "Passwords do not match", type: "error" });
                return false;
            }
        } else if (step === 3) {
            if (!form.gender) {
                showToast({ message: "Please select your gender.", type: "error" });
                return false;
            }
            if (!form.selectedClassId) {
                showToast({ message: "Please select your class.", type: "error" });
                return false;
            }
        }
        return true;
    };

    const nextStep = () => {
        if (validateStep()) setStep(s => s + 1);
    };

    const prevStep = () => setStep(s => s - 1);

    const uriToBlob = (uri: string): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = function () {
                resolve(xhr.response);
            };
            xhr.onerror = function (e) {
                reject(new Error("Image upload failed at source. Please try another image."));
            };
            xhr.responseType = "blob";
            xhr.open("GET", uri, true);
            xhr.send(null);
        });
    };

    const performClientSideSignup = async (
        userId: string,
        finalEmail: string,
        profileImageUrl: string | null,
        cleanCode: string,
        pendingDocId: string | null,
        codeDocId: string | null,
        preRegisteredData: any | null
    ) => {
        const batch = writeBatch(db);
        const userRef = doc(db, "users", userId);

        const userData: any = {
            uid: userId,
            authUid: userId,
            email: finalEmail,
            role: "student",
            status: "active",
            classId: preRegisteredData?.classId || form.selectedClassId,
            profile: {
                firstName: form.firstName || preRegisteredData?.profile?.firstName,
                lastName: form.lastName || preRegisteredData?.profile?.lastName,
                fullName: `${form.firstName || preRegisteredData?.profile?.firstName} ${form.lastName || preRegisteredData?.profile?.lastName}`,
                email: finalEmail,
                gender: form.gender || preRegisteredData?.profile?.gender || "",
                profileImage: profileImageUrl || preRegisteredData?.profile?.profileImage || null,
                dateOfBirth: form.dateOfBirth ? Timestamp.fromDate(form.dateOfBirth) : (preRegisteredData?.dateOfBirth || null),
            },
            signupCode: cleanCode,
            parentLinkCode: preRegisteredData?.parentLinkCode || generateLinkCode(),
            parentUids: preRegisteredData?.parentUids || [],
            createdAt: preRegisteredData?.createdAt || serverTimestamp(),
            claimedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        if (preRegisteredData) {
            userData.previousClassId = preRegisteredData.classId;
        }

        batch.set(userRef, userData);

        if (pendingDocId) {
            batch.update(doc(db, "users", pendingDocId), {
                status: 'claimed',
                claimedBy: userId,
                claimedAt: serverTimestamp()
            });
        }

        if (codeDocId) {
            batch.update(doc(db, "signupCodes", codeDocId), {
                used: true,
                usedBy: userId,
                usedAt: serverTimestamp()
            });
        }

        if (!pendingDocId) {
            const statsRef = doc(db, "stats", "global");
            batch.set(statsRef, { totalStudents: increment(1) }, { merge: true });
        }

        await batch.commit();
    };

    const handleSignup = async () => {
        if (!form.signupCode.trim()) {
            return showToast({ message: "Please enter your signup code.", type: "error" });
        }

        setLoading(true);

        try {
            const cleanCode = form.signupCode.trim().toUpperCase();

            const pendingQuery = query(
                collection(db, "users"),
                where("signupCode", "==", cleanCode),
                where("role", "==", "student"),
                where("status", "==", "pending_activation"),
                limit(1)
            );
            const pendingSnapshot = await getDocs(pendingQuery);
            const pendingDoc = pendingSnapshot.docs.find(d => d.data().status === "pending_activation");

            let preRegisteredData: any = null;
            let pendingDocId: string | null = null;

            if (pendingDoc) {
                pendingDocId = pendingDoc.id;
                preRegisteredData = pendingDoc.data();
            }

            let codeDocId: string | null = null;

            if (!preRegisteredData) {
                const q = query(collection(db, "signupCodes"), where("code", "==", cleanCode), limit(1));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    throw new Error("That signup code doesn't seem to fit. Check it again!");
                }

                const codeDoc = querySnapshot.docs[0];
                const codeData = codeDoc.data();

                if (codeData.expiresAt && Timestamp.now().toMillis() > codeData.expiresAt.toMillis()) {
                    throw new Error("This code has expired. Ask your teacher for a new one!");
                }

                if (codeData.intendedForRole !== "student" || codeData.used || codeData.classId !== form.selectedClassId) {
                    throw new Error("This code isn't for you or it's already been used! Check your class and code again.");
                }

                codeDocId = codeDoc.id;
            }

            const finalEmail = getStudentFinalEmail(form.email);

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(finalEmail)) {
                throw new Error("The email or username format is invalid. Please avoid special characters.");
            }

            const cred = await createUserWithEmailAndPassword(auth, finalEmail, form.password);
            const userId = cred.user.uid;
            await cred.user.getIdToken(true);

            let profileImageUrl = null;
            if (form.profileImage) {
                try {
                    const blob = await uriToBlob(form.profileImage);
                    const storageRef = ref(storage, `profiles/${userId}.jpg`);
                    await uploadBytes(storageRef, blob);
                    profileImageUrl = await getDownloadURL(storageRef);
                } catch (imgErr) {
                    console.error("Profile image upload failed:", imgErr);
                }
            }

            if (pendingDocId) {
                try {
                    const completeSignupFn = httpsCallable(functions, 'completeStudentSignup');
                    await completeSignupFn({
                        form: {
                            ...form,
                            email: finalEmail,
                            dateOfBirth: form.dateOfBirth?.toISOString()
                        },
                        pendingDocId,
                        codeDocId,
                        profileImageUrl,
                        cleanCode,
                    });
                } catch (fnErr: any) {
                    await performClientSideSignup(userId, finalEmail, profileImageUrl, cleanCode, pendingDocId, codeDocId, preRegisteredData);
                }
            } else {
                await performClientSideSignup(userId, finalEmail, profileImageUrl, cleanCode, null, codeDocId, null);
            }

            showToast({ message: "Account created successfully! Welcome to your school portal.", type: "success" });
            router.replace("/(auth)/login/student");
        } catch (err: any) {
            console.error("Student Signup Error:", err);
            let msg = err.message || "An unexpected error occurred.";
            if (err.code === 'auth/email-already-in-use') msg = "This email or username is already taken.";
            if (err.code === 'auth/invalid-email') msg = "Invalid email format.";
            if (err.code === 'auth/weak-password') msg = "Password is too short.";
            if (err.code === 'auth/network-request-failed') msg = "Network error. Please check your connection.";

            showToast({ message: msg, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return {
        step,
        classes,
        form,
        setForm,
        showDatePicker,
        setShowDatePicker,
        showPassword,
        setShowPassword,
        loading,
        verifyCode,
        pickImage,
        nextStep,
        prevStep,
        handleSignup,
    };
};
