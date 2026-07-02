import { useLocalSearchParams, useRouter } from "expo-router";
import moment from "moment";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAcademicConfig } from "../../hooks/useAcademicConfig";
import { useFeeLedger } from "../../hooks/admin-dashboard/useFeeLedger";
import LedgerFilters from "../../components/admin-dashboard/fee-history/LedgerFilters";
import LedgerReceipt from "../../components/admin-dashboard/fee-history/LedgerReceipt";

export default function StudentFeeHistoryScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const acadConfig = useAcademicConfig();

    const {
        classes, students, selectedYear, setSelectedYear, selectedTerm, setSelectedTerm,
        selectedClassId, setSelectedClassId, selectedStudentUid, setSelectedStudentUid,
        record, allTransactions, loading, fetchingStudents,
        fetchingRecord, saving, deleting, handleLogPayment, handleRevertPayment,
        categorySummary, totals, canManageFees, availableYears
    } = useFeeLedger(
        (params.studentId as string) || "",
        (params.academicYear as string) || "",
        (params.term as string) || ""
    );

    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [receivedFrom, setReceivedFrom] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Cheque" | "E-cash" | "Momo">("Cash");
    const [searchQuery, setSearchQuery] = useState("");

    const primary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
    const secondary = SCHOOL_CONFIG.secondaryColor || COLORS.secondary;

    const filteredPayments = useMemo(() => {
        const lowerQuery = searchQuery.toLowerCase();
        return allTransactions.filter(
            (p: any) =>
                p.receiptNo?.toLowerCase().includes(lowerQuery) ||
                p.receivedFrom?.toLowerCase().includes(lowerQuery) ||
                p.amount.toString().includes(lowerQuery) ||
                p.type?.toLowerCase().includes(lowerQuery),
        );
    }, [allTransactions, searchQuery]);

    const onLogPayment = async () => {
        const success = await handleLogPayment(paymentAmount, receivedFrom, paymentMethod);
        if (success) {
            setPaymentAmount("");
            setReceivedFrom("");
            setPaymentModalVisible(false);
        }
    };

    const onRevertPayment = (payment: any) => {
        if (Platform.OS === "web") {
            const confirmed = window.confirm(
                "Are you sure you want to delete this transaction? The student's balance will be adjusted automatically.",
            );
            if (confirmed) {
                handleRevertPayment(payment);
            }
        } else {
            Alert.alert(
                "Revert Payment",
                "Are you sure you want to delete this transaction? The student's balance will be adjusted automatically.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => handleRevertPayment(payment),
                    },
                ],
            );
        }
    };

    if (loading)
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={primary} />
            </View>
        );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <View
                style={StyleSheet.flatten([
                    styles.navBar,
                    { backgroundColor: primary },
                ])}
            >
                <TouchableOpacity onPress={() => router.push("/admin-dashboard/ManageFees")} style={styles.backIcon}>
                    <SVGIcon name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.navTitle}>Fee Ledger</Text>
                <TouchableOpacity
                    onPress={() => setPaymentModalVisible(true)}
                    disabled={!selectedStudentUid}
                    style={styles.paymentIcon}
                >
                    <SVGIcon
                        name="cash"
                        size={24}
                        color={selectedStudentUid ? "#fff" : "rgba(255,255,255,0.3)"}
                    />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <LedgerFilters
                    availableYears={availableYears}
                    selectedYear={selectedYear}
                    setSelectedYear={setSelectedYear}
                    selectedTerm={selectedTerm}
                    setSelectedTerm={setSelectedTerm}
                    classes={classes}
                    selectedClassId={selectedClassId}
                    setSelectedClassId={setSelectedClassId}
                    students={students}
                    selectedStudentUid={selectedStudentUid}
                    setSelectedStudentUid={setSelectedStudentUid}
                    fetchingStudents={fetchingStudents}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    primary={primary}
                    secondary={secondary}
                    acadConfig={acadConfig}
                />

                <View style={styles.mainContent}>
                    {fetchingRecord || deleting ? (
                        <ActivityIndicator
                            size="large"
                            color={primary}
                            style={{ marginTop: 50 }}
                        />
                    ) : record ? (
                        <LedgerReceipt
                            record={record}
                            categorySummary={categorySummary}
                            totalBilled={totals.totalBilled}
                            totalPaid={totals.totalPaid}
                            totalBalance={totals.totalBalance}
                            selectedStudentUid={selectedStudentUid}
                            selectedYear={selectedYear}
                            selectedTerm={selectedTerm}
                            primary={primary}
                            router={router}
                        />
                    ) : (
                        selectedStudentUid && (
                            <View style={styles.emptyState}>
                                <SVGIcon name="alert-circle" size={64} color="#CBD5E1" />
                                <Text style={styles.emptyTitle}>No record found</Text>
                                <Text style={styles.emptySub}>
                                    No financial data for the selected period.
                                </Text>
                            </View>
                        )
                    )}

                    {/* Recent Transactions List */}
                    {selectedStudentUid && allTransactions.length > 0 && (
                        <View style={styles.transactionsContainer}>
                            <Text style={styles.sectionTitle}>RECENT TRANSACTIONS</Text>
                            {filteredPayments.map((payment: any, idx: number) => (
                                <TouchableOpacity
                                    key={payment.id || idx}
                                    style={styles.paymentRow}
                                    onLongPress={() => onRevertPayment(payment)}
                                    onPress={() => {
                                        router.push({
                                            pathname: "/shared/receipt-view",
                                            params: {
                                                type: "payment",
                                                studentId: selectedStudentUid,
                                                paymentId: payment.receiptNo,
                                                year: selectedYear,
                                                term: selectedTerm,
                                            },
                                        });
                                    }}
                                >
                                    <View style={styles.paymentInfo}>
                                        <Text style={styles.paymentMain}>
                                            {payment.otherCategory?.toUpperCase() ||
                                                payment.type?.replace('_payment', '').replace('_', ' ').toUpperCase() ||
                                                "PAYMENT"}
                                        </Text>
                                        <Text style={styles.paymentSub}>
                                            {payment.receiptNo} • {moment(payment.timestamp?.toDate()).format("MMM DD, YYYY")}
                                        </Text>
                                    </View>
                                    <View style={styles.paymentAction}>
                                        <Text style={styles.paymentAmt}>
                                            ₵{payment.amount.toFixed(2)}
                                        </Text>
                                        <SVGIcon name="chevron-forward" size={16} color="#94A3B8" />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Payment Modal */}
            <Modal visible={paymentModalVisible} transparent animationType="slide">
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.overlay}
                >
                    <View style={styles.paymentModal}>
                        <View style={styles.modalTopRow}>
                            <Text style={styles.modalStudentName}>
                                Record Payment
                            </Text>
                            <TouchableOpacity
                                onPress={() => setPaymentModalVisible(false)}
                                style={styles.closeRound}
                            >
                                <SVGIcon name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 40 }}
                        >
                            <View style={styles.modalInputs}>
                                <TextInput
                                    style={styles.pillInput}
                                    placeholder="Amount (₵)"
                                    keyboardType="numeric"
                                    value={paymentAmount}
                                    onChangeText={setPaymentAmount}
                                    placeholderTextColor="#64748B"
                                />
                                <TextInput
                                    style={styles.pillInput}
                                    placeholder="Received From"
                                    value={receivedFrom}
                                    onChangeText={setReceivedFrom}
                                    placeholderTextColor="#64748B"
                                />
                            </View>
                            <View style={styles.methodGrid}>
                                {["Cash", "Cheque", "Momo", "E-cash"].map((m) => (
                                    <TouchableOpacity
                                        key={m}
                                        style={[
                                            styles.methodBtn,
                                            paymentMethod === m && { backgroundColor: primary },
                                        ]}
                                        onPress={() => setPaymentMethod(m as any)}
                                    >
                                        <Text
                                            style={[
                                                styles.methodText,
                                                paymentMethod === m && { color: "#fff" },
                                            ]}
                                        >
                                            {m}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <TouchableOpacity
                                style={[styles.saveBtn, { backgroundColor: primary }]}
                                onPress={onLogPayment}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.saveBtnText}>CONFIRM PAYMENT</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#E2E8F0" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    navBar: {
        height: 60,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
    },
    navTitle: { fontSize: 18, fontWeight: "900", color: "#fff" },
    backIcon: { width: 40 },
    paymentIcon: { width: 40, alignItems: "flex-end", marginRight: 10 },
    scrollContent: { paddingBottom: 40 },
    mainContent: { padding: 15 },
    transactionsContainer: {
        marginTop: 30,
        paddingHorizontal: 5,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: "900",
        color: "#64748B",
        marginBottom: 15,
        letterSpacing: 1,
    },
    paymentRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#fff",
        padding: 15,
        borderRadius: 16,
        marginBottom: 10,
        ...SHADOWS.small,
    },
    paymentInfo: { flex: 1 },
    paymentMain: {
        fontSize: 14,
        fontWeight: "800",
        color: "#1E293B",
    },
    paymentSub: {
        fontSize: 11,
        color: "#64748B",
        marginTop: 2,
    },
    paymentAction: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    paymentAmt: {
        fontSize: 15,
        fontWeight: "900",
        color: "#10B981",
    },
    emptyState: { alignItems: "center", marginTop: 60 },
    emptyTitle: {
        fontSize: 18,
        fontWeight: "900",
        color: "#475569",
        marginTop: 15,
    },
    emptySub: { fontSize: 13, color: "#94A3B8", marginTop: 5 },
    overlay: {
        flex: 1,
        backgroundColor: "rgba(15,23,42,0.6)",
        justifyContent: "flex-end",
    },
    paymentModal: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 45,
        borderTopRightRadius: 45,
        padding: 30,
        maxHeight: "90%",
    },
    modalTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 35,
    },
    modalStudentName: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
    closeRound: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#F8FAFC",
        justifyContent: "center",
        alignItems: "center",
    },
    modalInputs: { gap: 15, marginBottom: 30 },
    pillInput: {
        backgroundColor: "#F8FAFC",
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        fontSize: 20,
        fontWeight: "900",
        color: "#1E293B",
    },
    methodGrid: { flexDirection: "row", gap: 10, marginBottom: 30 },
    methodBtn: {
        flex: 1,
        height: 48,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F8FAFC",
    },
    methodText: { fontSize: 12, fontWeight: "800", color: "#64748B" },
    saveBtn: {
        height: 64,
        borderRadius: 24,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
    },
    saveBtnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "900",
        letterSpacing: 1,
    },
});
