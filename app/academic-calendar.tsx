const DateTimePicker = Platform.OS !== 'web' ? require('@react-native-community/datetimepicker').default : null;
import { useRouter } from "expo-router";
import moment from "moment";
import React from "react";
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    Platform,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { Calendar } from "react-native-calendars";
import SVGIcon from "../components/SVGIcon";
import { COLORS, SHADOWS } from "../constants/theme";
import { useAcademicCalendar } from "../hooks/useAcademicCalendar";

const EVENT_TYPES = [
    { label: "Holiday", value: "Holiday", color: "#EF4444" },
    { label: "Special Event", value: "Special Event", color: "#3B82F6" },
    { label: "Academic", value: "Academic", color: "#10B981" },
];

const VISIBILITY_OPTS = [
    { label: "All Users", value: "all", icon: "people" },
    { label: "Teachers Only", value: "teachers", icon: "briefcase" },
    { label: "Parents/Students", value: "parents", icon: "home" },
];

const ACADEMIC_YEARS = (() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = -2; i <= 3; i++) {
        const year = currentYear + i;
        years.push(`${year}/${year + 1}`);
    }
    return years;
})();

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function AcademicCalendar() {
    const router = useRouter();
    const {
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
    } = useAcademicCalendar();

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <SVGIcon name="arrow-back" size={24} color={primaryColor} />
                </TouchableOpacity>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                    <View
                        style={[
                            styles.headerIconBg,
                            { backgroundColor: primaryColor + "15" },
                        ]}
                    >
                        <SVGIcon name="calendar-outline" size={22} color={primaryColor} />
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>Academic Calendar</Text>
                        <Text style={styles.headerSub}>
                            {moment(selectedDate).format("MMMM YYYY")}
                        </Text>
                    </View>
                </View>

                <View style={{ flexDirection: "row", gap: 10 }}>
                    {canEdit && (
                        <TouchableOpacity
                            onPress={openSettingsModal}
                            style={[styles.iconBtn, { backgroundColor: primaryColor + "10" }]}
                        >
                            <SVGIcon name="settings-outline" size={20} color={primaryColor} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={manualFetch}
                        style={styles.iconBtn}
                        disabled={refreshing}
                    >
                        {refreshing ? (
                            <ActivityIndicator size="small" color={primaryColor} />
                        ) : (
                            <SVGIcon name="refresh" size={20} color={primaryColor} />
                        )}
                    </TouchableOpacity>
                    {canEdit && (
                        <TouchableOpacity
                            onPress={openAddEventModal}
                            style={[styles.addBtn, { backgroundColor: primaryColor }]}
                        >
                            <SVGIcon name="add" size={24} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={manualFetch}
                        tintColor={primaryColor}
                    />
                }
            >
                <Animatable.View animation={Platform.OS === 'web' ? undefined : "fadeInDown"} style={styles.termBar}>
                    <View style={styles.termInfo}>
                        <Text style={styles.termYear}>
                            {termConfig.academicYear || "Set Year"}
                        </Text>
                        <View style={[styles.termBadge, { backgroundColor: primaryColor }]}>
                            <Text style={styles.termText}>{termConfig.currentTerm}</Text>
                        </View>
                    </View>
                    <View style={styles.termDates}>
                        <View style={styles.dateItem}>
                            <Text style={styles.dateLabel}>START</Text>
                            <Text style={styles.dateValue}>
                                {moment(termConfig.termStart).format("MMM D")}
                            </Text>
                        </View>
                        <View style={styles.dateDivider} />
                        <View style={styles.dateItem}>
                            <Text style={styles.dateLabel}>END</Text>
                            <Text style={styles.dateValue}>
                                {moment(termConfig.termEnd).format("MMM D")}
                            </Text>
                        </View>
                    </View>
                </Animatable.View>

                <Calendar
                    current={selectedDate}
                    onDayPress={(day) => setSelectedDate(day.dateString)}
                    markingType={"custom"}
                    markedDates={markedDates}
                    theme={{
                        todayTextColor: primaryColor,
                        arrowColor: primaryColor,
                        textDayFontWeight: "600",
                        textMonthFontWeight: "900",
                        textDayHeaderFontWeight: "700",
                        calendarBackground: "#fff",
                    }}
                    style={styles.calendar}
                />

                <View style={styles.eventListHeader}>
                    <Text style={styles.listTitle}>
                        Events for {moment(selectedDate).format("MMMM D, YYYY")}
                    </Text>
                </View>

                {loading && events.length === 0 ? (
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color={primaryColor} />
                    </View>
                ) : (
                    <View style={styles.listContent}>
                        {events
                            .filter(
                                (e) =>
                                    moment(parseFirestoreDate(e.date)).format("YYYY-MM-DD") ===
                                    selectedDate,
                            )
                            .map((item, index) => (
                                <Animatable.View
                                    key={item.id}
                                    animation="fadeInUp"
                                    duration={400}
                                    delay={index * 50}
                                    style={[
                                        styles.eventCard,
                                        { borderLeftColor: item.color || "#ccc" },
                                    ]}
                                >
                                    <View style={styles.eventInfo}>
                                        <Text style={styles.eventTitle}>{item.title}</Text>
                                        {item.description ? (
                                            <Text style={styles.eventDesc}>{item.description}</Text>
                                        ) : null}
                                        <View style={styles.badgeRow}>
                                            <View
                                                style={[
                                                    styles.typeBadge,
                                                    { backgroundColor: (item.color || "#ccc") + "20" },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.typeBadgeText,
                                                        { color: item.color || "#666" },
                                                    ]}
                                                >
                                                    {item.type}
                                                </Text>
                                            </View>
                                            <View
                                                style={[
                                                    styles.vBadge,
                                                    { backgroundColor: primaryColor + "15" },
                                                ]}
                                            >
                                                <Text
                                                    style={[styles.vBadgeText, { color: primaryColor }]}
                                                >
                                                    {(item.visibility || "all").toUpperCase()}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    {canEdit && (
                                        <View style={styles.actionButtons}>
                                            <TouchableOpacity
                                                onPress={() => openEditEventModal(item)}
                                                style={styles.iconBtn}
                                            >
                                                <SVGIcon
                                                    name="create-outline"
                                                    size={20}
                                                    color={COLORS.blue}
                                                />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleDeleteEvent(item.id)}
                                                style={styles.iconBtn}
                                            >
                                                <SVGIcon
                                                    name="trash-outline"
                                                    size={20}
                                                    color={COLORS.danger}
                                                />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </Animatable.View>
                            ))}
                        {events.filter(
                            (e) =>
                                moment(parseFirestoreDate(e.date)).format("YYYY-MM-DD") ===
                                selectedDate,
                        ).length === 0 && (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>
                                        No events scheduled for this day.
                                    </Text>
                                </View>
                            )}
                    </View>
                )}
            </ScrollView>

            <Modal visible={settingsModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <Animatable.View
                        animation="slideInUp"
                        duration={400}
                        style={styles.settingsContainer}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Term Configuration</Text>
                            <TouchableOpacity onPress={closeSettingsModal}>
                                <SVGIcon name="close" size={24} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.label}>ACADEMIC YEAR *</Text>
                            <View style={[styles.optionGrid, { flexWrap: 'wrap' }]}>
                                {ACADEMIC_YEARS.map((year) => (
                                    <TouchableOpacity
                                        key={year}
                                        style={StyleSheet.flatten([
                                            styles.optionBtn,
                                            { minWidth: '30%', marginBottom: 10 },
                                            termConfig.academicYear === year && {
                                                backgroundColor: primaryColor,
                                                borderColor: primaryColor,
                                            },
                                        ])}
                                        onPress={() =>
                                            updateTermConfig({ academicYear: year })
                                        }
                                    >
                                        <Text
                                            style={[
                                                styles.optionText,
                                                termConfig.academicYear === year && { color: "#fff" },
                                            ]}
                                        >
                                            {year}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <TextInput
                                style={[styles.input, { marginTop: 5 }]}
                                value={termConfig.academicYear}
                                onChangeText={(t) =>
                                    updateTermConfig({ academicYear: t.trim() })
                                }
                                placeholder="Or type manually: e.g. 2023/2024"
                            />

                            <Text style={styles.label}>CURRENT TERM *</Text>
                            <View style={styles.optionGrid}>
                                {["Term 1", "Term 2", "Term 3"].map((t) => (
                                    <TouchableOpacity
                                        key={t}
                                        style={StyleSheet.flatten([
                                            styles.optionBtn,
                                            termConfig.currentTerm === t && {
                                                backgroundColor: primaryColor,
                                                borderColor: primaryColor,
                                            },
                                        ])}
                                        onPress={() =>
                                            updateTermConfig({ currentTerm: t as any })
                                        }
                                    >
                                        <Text
                                            style={[
                                                styles.optionText,
                                                termConfig.currentTerm === t && { color: "#fff" },
                                            ]}
                                        >
                                            {t}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={styles.label}>TERM START DATE</Text>
                                    {Platform.OS === "web" ? (
                                        <input
                                            type="date"
                                            style={StyleSheet.flatten([styles.webDateInput as any])}
                                            value={moment(termConfig.termStart).format("YYYY-MM-DD")}
                                            onChange={(e: any) =>
                                                updateTermConfig({
                                                    termStart: moment(e.target.value).toDate(),
                                                })
                                            }
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            style={styles.input}
                                            onPress={() =>
                                                openDatePicker("termStart", termConfig.termStart)
                                            }
                                        >
                                            <Text style={{ color: "#1E293B" }}>
                                                {moment(termConfig.termStart).format("MMM DD, YYYY")}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>TERM END DATE</Text>
                                    {Platform.OS === "web" ? (
                                        <input
                                            type="date"
                                            style={StyleSheet.flatten([styles.webDateInput as any])}
                                            value={moment(termConfig.termEnd).format("YYYY-MM-DD")}
                                            onChange={(e: any) =>
                                                updateTermConfig({
                                                    termEnd: moment(e.target.value).toDate(),
                                                })
                                            }
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            style={styles.input}
                                            onPress={() =>
                                                openDatePicker("termEnd", termConfig.termEnd)
                                            }
                                        >
                                            <Text style={{ color: "#1E293B" }}>
                                                {moment(termConfig.termEnd).format("MMM DD, YYYY")}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            <Text style={styles.label}>NEXT TERM BEGINS</Text>
                            <TextInput
                                style={styles.input}
                                value={termConfig.nextTermBegins}
                                onChangeText={(t) =>
                                    updateTermConfig({ nextTermBegins: t })
                                }
                                placeholder="e.g. 15th Jan, 2024"
                            />

                            <TouchableOpacity
                                style={[styles.saveBtn, { backgroundColor: primaryColor }]}
                                onPress={handleSaveSettings}
                                disabled={savingSettings}
                            >
                                {savingSettings ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Save Configuration</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </Animatable.View>
                </View>
            </Modal>

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <Animatable.View
                        animation="zoomIn"
                        duration={300}
                        style={styles.modalContainer}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingEvent?.id ? "Edit Event" : "New Event"}
                            </Text>
                            <TouchableOpacity onPress={closeEventModal}>
                                <SVGIcon name="close" size={24} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.label}>Event Title *</Text>
                            <TextInput
                                style={styles.input}
                                value={editingEvent?.title || ""}
                                onChangeText={(t) =>
                                    updateEditingEvent({ title: t })
                                }
                                placeholder="e.g. Independence Day"
                            />
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                                value={editingEvent?.description || ""}
                                onChangeText={(t) =>
                                    updateEditingEvent({ description: t })
                                }
                                placeholder="Details..."
                                multiline
                            />
                            <Text style={styles.label}>Event Date *</Text>
                            {Platform.OS === "web" ? (
                                <input
                                    type="date"
                                    style={StyleSheet.flatten([styles.webDateInput as any])}
                                    value={
                                        editingEvent?.date
                                            ? moment(editingEvent.date).format("YYYY-MM-DD")
                                            : ""
                                    }
                                    onChange={(e: any) => {
                                        const d = moment(e.target.value).toDate();
                                        d.setHours(12, 0, 0, 0);
                                        updateEditingEvent({ date: d });
                                    }}
                                />
                            ) : (
                                <TouchableOpacity
                                    style={styles.input}
                                    onPress={() =>
                                        openDatePicker("eventDate", editingEvent?.date || new Date())
                                    }
                                >
                                    <Text style={{ color: "#1E293B" }}>
                                        {editingEvent?.date
                                            ? moment(editingEvent.date).format("MMM DD, YYYY")
                                            : "Select Date"}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <Text style={styles.label}>Event Type</Text>
                            <View style={styles.optionGrid}>
                                {EVENT_TYPES.map((type) => (
                                    <TouchableOpacity
                                        key={type.value}
                                        style={StyleSheet.flatten([
                                            styles.optionBtn,
                                            editingEvent?.type === type.value && {
                                                backgroundColor: type.color,
                                                borderColor: type.color,
                                            },
                                        ])}
                                        onPress={() =>
                                            updateEditingEvent({
                                                type: type.value as any,
                                                color: type.color,
                                            })
                                        }
                                    >
                                        <Text
                                            style={[
                                                styles.optionText,
                                                editingEvent?.type === type.value && { color: "#fff" },
                                            ]}
                                        >
                                            {type.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Visibility</Text>
                            <View style={styles.vGrid}>
                                {VISIBILITY_OPTS.map((opt) => (
                                    <TouchableOpacity
                                        key={opt.value}
                                        style={StyleSheet.flatten([
                                            styles.vItem,
                                            editingEvent?.visibility === opt.value && {
                                                borderColor: primaryColor,
                                                backgroundColor: primaryColor + "05",
                                            },
                                        ])}
                                        onPress={() =>
                                            updateEditingEvent({
                                                visibility: opt.value as any,
                                            })
                                        }
                                    >
                                        <SVGIcon
                                            name={opt.icon as any}
                                            size={18}
                                            color={
                                                editingEvent?.visibility === opt.value
                                                    ? primaryColor
                                                    : "#94A3B8"
                                            }
                                        />
                                        <Text
                                            style={[
                                                styles.vText,
                                                editingEvent?.visibility === opt.value && {
                                                    color: primaryColor,
                                                    fontWeight: "700",
                                                },
                                            ]}
                                        >
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.saveBtn, { backgroundColor: primaryColor }]}
                                onPress={handleSaveEvent}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Save Event</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </Animatable.View>
                </View>
            </Modal>

            {showPicker && (
                <DateTimePicker
                    value={showPicker.currentDate}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create<any>({
    webDatePickerContainer: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 12,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        ...SHADOWS.medium,
        alignItems: 'center',
        gap: 10,
    },
    webCloseBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 15,
        paddingVertical: 5,
        borderRadius: 8,
    },
    webCloseBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 12,
    },
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 15,
        paddingVertical: 12,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
        flexWrap: "wrap",
        gap: 8
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: "#F8FAFC",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 15,
    },
    headerIconBg: {
        width: 38,
        height: 38,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
    headerSub: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
    addBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        ...Platform.select({
            web: { boxShadow: "0 2px 3px rgba(0,0,0,0.1)" },
            default: SHADOWS.small,
        }),
    },
    calendar: {
        marginBottom: 10,
        ...Platform.select({
            web: { boxShadow: "0 2px 3px rgba(0,0,0,0.1)" },
            default: SHADOWS.small,
        }),
    },
    termBar: {
        margin: 15,
        marginBottom: 10,
        padding: 15,
        backgroundColor: "#fff",
        borderRadius: 20,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
        ...Platform.select({
            web: { boxShadow: "0 2px 3px rgba(0,0,0,0.1)" },
            default: SHADOWS.small,
        }),
    },
    termInfo: { gap: 4 },
    termYear: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
    termBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 10,
        alignSelf: "flex-start",
    },
    termText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "900",
        textTransform: "uppercase",
    },
    termDates: { flexDirection: "row", alignItems: "center", gap: 12 },
    dateItem: { alignItems: "center" },
    dateLabel: {
        fontSize: 8,
        fontWeight: "900",
        color: "#94A3B8",
        marginBottom: 2,
    },
    dateValue: { fontSize: 13, fontWeight: "800", color: "#1E293B" },
    dateDivider: { width: 1, height: 20, backgroundColor: "#E2E8F0" },
    eventListHeader: { padding: 20, paddingBottom: 10 },
    listTitle: {
        fontSize: 13,
        fontWeight: "900",
        color: "#94A3B8",
        letterSpacing: 1,
        textTransform: "uppercase",
    },
    listContent: { padding: 20, paddingBottom: 50 },
    eventCard: {
        flexDirection: "row",
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 15,
        marginBottom: 12,
        borderLeftWidth: 5,
        ...Platform.select({
            web: { boxShadow: "0 2px 3px rgba(0,0,0,0.1)" },
            default: SHADOWS.small,
        }),
    },
    eventInfo: { flex: 1 },
    eventTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
    eventDesc: { fontSize: 13, color: "#64748B", marginTop: 4 },
    badgeRow: { flexDirection: "row", marginTop: 10, gap: 8 },
    typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    typeBadgeText: { fontSize: 10, fontWeight: "800" },
    vBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    vBadgeText: { fontSize: 9, fontWeight: "900" },
    actionButtons: { flexDirection: "row", gap: 10 },
    iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: "#F8FAFC",
        justifyContent: "center",
        alignItems: "center",
    },
    emptyContainer: { alignItems: "center", marginTop: 10 },
    emptyText: { color: "#CBD5E1", fontSize: 14, fontWeight: "600" },
    centered: { padding: 40, justifyContent: "center", alignItems: "center" },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        justifyContent: "center",
        padding: 20,
    },
    modalContainer: {
        backgroundColor: "#fff",
        borderRadius: 30,
        padding: 25,
        ...Platform.select({
            web: { boxShadow: "0 10px 15px rgba(0,0,0,0.2)" },
            default: SHADOWS.large,
        }),
        maxHeight: "90%",
    },
    settingsContainer: {
        backgroundColor: "#fff",
        borderRadius: 30,
        padding: 20,
        ...Platform.select({
            web: { boxShadow: "0 10px 15px rgba(0,0,0,0.2)" },
            default: SHADOWS.large,
        }),
        width: Platform.OS === "web" ? Math.min(SCREEN_WIDTH - 30, 500) : "100%",
        alignSelf: "center",
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 25,
    },
    modalTitle: { fontSize: 22, fontWeight: "900", color: "#1E293B" },
    label: {
        fontSize: 11,
        fontWeight: "900",
        color: "#94A3B8",
        marginTop: 15,
        marginBottom: 8,
        ...(Platform.OS !== "android" && { letterSpacing: 1 }),
    },
    input: {
        backgroundColor: "#F8FAFC",
        borderRadius: 12,
        padding: 15,
        fontSize: 15,
        color: "#1E293B",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        justifyContent: "center",
    },
    webDateInput: {
        width: "100%",
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        paddingLeft: 12,
        paddingRight: 12,
        fontSize: 15,
        outlineStyle: "none",
        backgroundColor: "#F8FAFC",
    },
    optionGrid: { flexDirection: "row", gap: 10, marginTop: 5 },
    optionBtn: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        alignItems: "center",
    },
    optionText: { fontSize: 12, fontWeight: "700", color: "#64748B" },
    vGrid: { gap: 10 },
    vItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    vText: { fontSize: 14, fontWeight: "600", color: "#64748B" },
    saveBtn: {
        marginTop: 30,
        height: 56,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
        ...Platform.select({
            web: { boxShadow: "0 4px 6px rgba(0,0,0,0.1)" },
            default: SHADOWS.medium,
        }),
    },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
    row: { flexDirection: "row" },
});
