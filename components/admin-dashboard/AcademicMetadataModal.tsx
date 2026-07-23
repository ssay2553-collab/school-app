import moment from "moment";
import React from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import SVGIcon from "../SVGIcon";
import { COLORS, SHADOWS } from "../../constants/theme";

// Guarded import for native-only library
const DateTimePicker =
    Platform.OS !== "web"
        ? require("@react-native-community/datetimepicker").default
        : null;

interface AcademicMetadataModalProps {
    visible: boolean;
    onClose: () => void;
    editingStudent: any;
    mConduct: string;
    setConduct: (val: string) => void;
    mAttitude: string;
    setAttitude: (val: string) => void;
    mInterest: string;
    setInterest: (val: string) => void;
    mPromotedTo: string;
    setPromotedTo: (val: string) => void;
    mAdminRemarks: string;
    setAdminRemarks: (val: string) => void;
    mTeacherRemarks: string;
    setTeacherRemarks: (val: string) => void;
    saveMetadata: () => void;
    savingMetadata: boolean;
    primary: string;
}

export const AcademicMetadataModal: React.FC<AcademicMetadataModalProps> = ({
    visible,
    onClose,
    editingStudent,
    mConduct,
    setConduct,
    mAttitude,
    setAttitude,
    mInterest,
    setInterest,
    mPromotedTo,
    setPromotedTo,
    mAdminRemarks,
    setAdminRemarks,
    mTeacherRemarks,
    setTeacherRemarks,
    saveMetadata,
    savingMetadata,
    primary,
}) => {
    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.modalOverlay}
            >
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <View>
                            <Text style={styles.modalTitle}>Terminal Metadata</Text>
                            <Text style={styles.modalSubtitle}>{editingStudent?.fullName}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <SVGIcon name="close" size={24} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>CONDUCT</Text>
                            <TextInput
                                style={styles.textInput}
                                value={mConduct}
                                onChangeText={setConduct}
                                placeholder="e.g. Excellent"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>ATTITUDE</Text>
                            <TextInput
                                style={styles.textInput}
                                value={mAttitude}
                                onChangeText={setAttitude}
                                placeholder="e.g. Very Positive"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>INTEREST</Text>
                            <TextInput
                                style={styles.textInput}
                                value={mInterest}
                                onChangeText={setInterest}
                                placeholder="e.g. High"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>PROMOTED / REPEATED TO</Text>
                            <TextInput
                                style={styles.textInput}
                                value={mPromotedTo}
                                onChangeText={setPromotedTo}
                                placeholder="e.g. Promoted to Basic 5"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>TEACHER'S REMARKS</Text>
                            <TextInput
                                style={[styles.textInput, styles.textArea]}
                                multiline
                                numberOfLines={3}
                                value={mTeacherRemarks}
                                onChangeText={setTeacherRemarks}
                                placeholder="Enter class teacher assessment..."
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>ADMINISTRATIVE REMARKS</Text>
                            <TextInput
                                style={[styles.textInput, styles.textArea]}
                                multiline
                                numberOfLines={3}
                                value={mAdminRemarks}
                                onChangeText={setAdminRemarks}
                                placeholder="Enter official school remarks..."
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.saveMetadataBtn, { backgroundColor: primary }]}
                            onPress={saveMetadata}
                            disabled={savingMetadata}
                        >
                            {savingMetadata ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveMetadataBtnText}>Save Final Metadata</Text>
                            )}
                        </TouchableOpacity>
                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 25,
        paddingTop: 25,
        maxHeight: "90%",
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 15,
    },
    modalTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
    modalSubtitle: {
        fontSize: 14,
        fontWeight: "700",
        color: COLORS.primary || "#2e86de",
        marginTop: 2,
    },
    modalScroll: { paddingTop: 10 },
    closeBtn: { width: 40, height: 40, alignItems: "flex-end" },
    inputGroup: { marginBottom: 15 },
    inputLabel: {
        fontSize: 10,
        fontWeight: "900",
        color: "#94A3B8",
        marginBottom: 8,
        letterSpacing: 1,
    },
    textInput: {
        backgroundColor: "#F8FAFC",
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        fontSize: 14,
        color: "#1E293B",
        fontWeight: "600",
    },
    textArea: { textAlignVertical: "top", minHeight: 80 },
    saveMetadataBtn: {
        padding: 18,
        borderRadius: 16,
        alignItems: "center",
        marginTop: 15,
        ...SHADOWS.small,
    },
    saveMetadataBtnText: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 16,
        letterSpacing: 0.5,
    },
});
