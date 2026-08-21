import { useState, useCallback, useEffect, useMemo } from 'react';
import { Platform, Alert } from 'react-native';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
    addDoc,
    deleteDoc,
} from 'firebase/firestore';
import moment from 'moment';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { SCHOOL_CONFIG } from '../constants/Config';
import { COLORS } from '../constants/theme';

export type CalendarEvent = {
    id: string;
    title: string;
    description: string;
    date: any;
    type: "Holiday" | "Special Event" | "Academic";
    visibility: "all" | "teachers" | "parents";
    color: string;
    createdBy: string;
    createdAt: any;
    updatedAt: any;
};

export type TermConfig = {
    academicYear: string;
    currentTerm: string;
    termStart: Date;
    termEnd: Date;
    nextTermBegins: string;
};

const ADMIN_PRIVILEGED_ROLES = [
    "Proprietor",
    "Proprietress",
    "Headmaster",
    "Headmistress",
    "Assistant Headmaster",
    "Secretary",
    "Admin",
    "Director",
    "Manager",
];

export const useAcademicCalendar = () => {
    const { showToast } = useToast();
    const { appUser } = useAuth();
    const [allRawEvents, setAllRawEvents] = useState<CalendarEvent[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [modalVisible, setModalVisible] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Partial<CalendarEvent> | null>(null);

    const [settingsModalVisible, setSettingsModalVisible] = useState(false);
    const [termConfig, setTermConfig] = useState<TermConfig>({
        academicYear: "",
        currentTerm: "Term 1",
        termStart: new Date(),
        termEnd: new Date(),
        nextTermBegins: "",
    });
    const [savingSettings, setSavingSettings] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));

    const [showPicker, setShowPicker] = useState<{
        field: "termStart" | "termEnd" | "eventDate" | null;
        currentDate: Date;
    } | null>(null);

    const parseFirestoreDate = useCallback((date: any): Date | null => {
        if (!date) return null;
        if (date instanceof Date) return date;
        if (date instanceof Timestamp) return date.toDate();
        if (typeof date.toDate === "function") return date.toDate();
        if (date && typeof date.seconds === "number")
            return new Date(date.seconds * 1000);
        const d = new Date(date);
        return isNaN(d.getTime()) ? null : d;
    }, []);

    const openAddEventModal = useCallback(() => {
        setEditingEvent({
            date: new Date(),
            visibility: "all",
            type: "Academic",
            color: "#10B981",
        });
        setModalVisible(true);
    }, []);

    const openEditEventModal = useCallback((event: CalendarEvent) => {
        setEditingEvent({
            ...event,
            date: parseFirestoreDate(event.date),
        });
        setModalVisible(true);
    }, [parseFirestoreDate]);

    const closeEventModal = useCallback(() => {
        setModalVisible(false);
        setEditingEvent(null);
    }, []);

    const updateEditingEvent = useCallback((updates: Partial<CalendarEvent>) => {
        setEditingEvent(prev => (prev ? { ...prev, ...updates } : updates));
    }, []);

    const openSettingsModal = useCallback(() => {
        setSettingsModalVisible(true);
    }, []);

    const closeSettingsModal = useCallback(() => {
        setSettingsModalVisible(false);
    }, []);

    const updateTermConfig = useCallback((updates: Partial<TermConfig>) => {
        setTermConfig(prev => ({ ...prev, ...updates }));
    }, []);

    const openDatePicker = useCallback((field: "termStart" | "termEnd" | "eventDate", currentDate: Date) => {
        setShowPicker({ field, currentDate });
    }, []);

    const primaryColor = SCHOOL_CONFIG.primaryColor || COLORS.primary;

    const canEdit = useMemo(() => {
        if (!appUser) return false;
        const isAdmin = appUser.role === "admin";
        const isPrivilegedAdmin =
            appUser.adminRole && ADMIN_PRIVILEGED_ROLES.includes(appUser.adminRole);
        const isTeacherEventOrganiser =
            appUser.role === "teacher" &&
            appUser.assignedRoles?.includes("Event Organiser");
        return isAdmin || isPrivilegedAdmin || isTeacherEventOrganiser;
    }, [appUser]);


    const fetchTermConfig = useCallback(async () => {
        try {
            const docSnap = await getDoc(doc(db, "school_settings", "academic_config"));
            if (docSnap.exists()) {
                const data = docSnap.data();
                setTermConfig({
                    academicYear: data.academicYear || "",
                    currentTerm: data.currentTerm || "",
                    termStart: parseFirestoreDate(data.termStart) || new Date(),
                    termEnd: parseFirestoreDate(data.termEnd) || new Date(),
                    nextTermBegins: data.nextTermBegins || "",
                });
            }
        } catch (error) {
            console.error("[useAcademicCalendar] Error fetching term config:", error);
        }
    }, [parseFirestoreDate]);

    const applyFilters = useCallback(
        (rawList: CalendarEvent[]) => {
            const filtered = rawList.filter((event) => {
                if (appUser?.role === "admin") return true;
                if (
                    appUser?.adminRole &&
                    ADMIN_PRIVILEGED_ROLES.includes(appUser.adminRole)
                )
                    return true;
                const visibility = event.visibility || "all";
                if (visibility === "all") return true;
                if (!appUser) return false;
                if (appUser.role === "teacher" && visibility === "teachers")
                    return true;
                if (
                    (appUser.role === "parent" || appUser.role === "student") &&
                    visibility === "parents"
                )
                    return true;
                return false;
            });
            setEvents(filtered);
        },
        [appUser],
    );

    const manualFetch = async () => {
        setRefreshing(true);
        try {
            const q = query(
                collection(db, "academic_calendar"),
                orderBy("date", "asc"),
                limit(1000),
            );
            const snapshot = await getDocs(q);
            const list = snapshot.docs.map(
                (d) => ({ id: d.id, ...(d.data() as any) }) as CalendarEvent,
            );
            setAllRawEvents(list);
            applyFilters(list);
            await fetchTermConfig();
        } catch (error) {
            console.error("[useAcademicCalendar] Manual fetch error:", error);
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        const q = query(
            collection(db, "academic_calendar"),
            orderBy("date", "asc"),
            limit(1000),
        );
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const list = snapshot.docs.map(
                    (d) => ({ id: d.id, ...(d.data() as any) }) as CalendarEvent,
                );
                setAllRawEvents(list);
                applyFilters(list);
                setLoading(false);
            },
            (error) => {
                manualFetch();
            },
        );

        fetchTermConfig();
        return () => unsubscribe();
    }, [applyFilters, fetchTermConfig]);

    const markedDates = useMemo(() => {
        const marks: any = {};
        events.forEach((event) => {
            const d = parseFirestoreDate(event.date);
            if (!d) return;
            const dateStr = moment(d).format("YYYY-MM-DD");
            if (!marks[dateStr]) {
                marks[dateStr] = {
                    customStyles: {
                        container: {
                            backgroundColor: event.color || primaryColor,
                            borderRadius: 25,
                            justifyContent: "center",
                            alignItems: "center",
                            ...Platform.select({
                                ios: {
                                    shadowColor: "#000",
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 1,
                                },
                                android: { elevation: 2 },
                                web: { boxShadow: "0 1px 2px rgba(0,0,0,0.2)" },
                            }),
                        },
                        text: { color: "#fff", fontWeight: "900" },
                    },
                };
            }
        });

        if (marks[selectedDate]) {
            marks[selectedDate].customStyles.container.borderWidth = 3;
            marks[selectedDate].customStyles.container.borderColor = "#1E293B";
        } else {
            marks[selectedDate] = {
                customStyles: {
                    container: {
                        borderWidth: 2,
                        borderColor: primaryColor,
                        borderRadius: 25,
                        justifyContent: "center",
                        alignItems: "center",
                    },
                    text: { color: primaryColor, fontWeight: "900" },
                },
            };
        }
        return marks;
    }, [events, selectedDate, primaryColor, parseFirestoreDate]);

    const handleSaveSettings = async () => {
        if (!termConfig.academicYear) {
            showToast({ message: "Please enter the academic year (e.g., 2023/2024)", type: "info" });
            return;
        }
        setSavingSettings(true);
        try {
            const cleanConfig = {
                ...termConfig,
                academicYear: termConfig.academicYear.trim(),
                currentTerm: termConfig.currentTerm.trim(),
                termStart: Timestamp.fromDate(termConfig.termStart),
                termEnd: Timestamp.fromDate(termConfig.termEnd),
                updatedAt: serverTimestamp(),
                updatedBy: appUser?.uid,
            };
            await setDoc(doc(db, "school_settings", "academic_config"), cleanConfig);
            setSettingsModalVisible(false);
            showToast({ message: "Academic configuration updated!", type: "success" });
        } catch (error) {
            console.error("Save settings error:", error);
            showToast({ message: "Failed to save configuration.", type: "error" });
        } finally {
            setSavingSettings(false);
        }
    };

    const handleSaveEvent = async () => {
        if (!editingEvent?.title || !editingEvent?.date) {
            showToast({ message: "Please fill in all required fields.", type: "info" });
            return;
        }
        setIsSubmitting(true);
        try {
            const { id, ...cleanData } = editingEvent as any;
            const eventDate =
                cleanData.date instanceof Date
                    ? cleanData.date
                    : new Date(cleanData.date);
            if (isNaN(eventDate.getTime())) {
                throw new Error("Invalid date selected");
            }
            eventDate.setHours(12, 0, 0, 0);
            const eventData = {
                ...cleanData,
                date: Timestamp.fromDate(eventDate),
                updatedAt: serverTimestamp(),
                visibility: cleanData.visibility || "all",
            };
            if (id) {
                await updateDoc(doc(db, "academic_calendar", id), eventData);
                showToast({ message: "Event updated", type: "success" });
            } else {
                await addDoc(collection(db, "academic_calendar"), {
                    ...eventData,
                    createdBy: appUser?.uid,
                    createdAt: serverTimestamp(),
                });
                showToast({ message: "Event created", type: "success" });
            }
            setModalVisible(false);
            setEditingEvent(null);
        } catch (error) {
            showToast({ message: "Failed to save event.", type: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteEvent = (id: string) => {
        const proceed = async () => {
            try {
                await deleteDoc(doc(db, "academic_calendar", id));
                showToast({ message: "Event deleted", type: "success" });
            } catch (error) {
                showToast({ message: "Failed to delete.", type: "error" });
            }
        };

        if (Platform.OS === "web") {
            if (window.confirm("Are you sure you want to delete this event?")) {
                proceed();
            }
        } else {
            Alert.alert("Delete Event", "Are you sure?", [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: proceed,
                },
            ]);
        }
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === "android") setShowPicker(null);
        if (selectedDate && showPicker) {
            if (showPicker.field === "termStart") {
                setTermConfig({ ...termConfig, termStart: selectedDate });
            } else if (showPicker.field === "termEnd") {
                setTermConfig({ ...termConfig, termEnd: selectedDate });
            } else if (showPicker.field === "eventDate") {
                setEditingEvent({ ...editingEvent, date: selectedDate });
            }
        }
        if (Platform.OS === "ios" && event.type === "dismissed")
            setShowPicker(null);
    };

    return {
        events,
        loading,
        refreshing,
        modalVisible,
        editingEvent,
        settingsModalVisible,
        termConfig,
        savingSettings,
        isSubmitting,
        selectedDate,
        setSelectedDate,
        showPicker,
        markedDates,
        canEdit,
        primaryColor,
        manualFetch,
        handleSaveSettings,
        handleSaveEvent,
        handleDeleteEvent,
        onDateChange,
        parseFirestoreDate,
        openAddEventModal,
        openEditEventModal,
        closeEventModal,
        updateEditingEvent,
        openSettingsModal,
        closeSettingsModal,
        updateTermConfig,
        openDatePicker,
    };
};
