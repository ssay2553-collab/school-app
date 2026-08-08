import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Animatable from "react-native-animatable";
import moment from "moment";
import SVGIcon from "../../SVGIcon";
import { SHADOWS, COLORS } from '../../../constants/theme';
import { SCHOOL_CONFIG } from '../../../constants/Config';

interface LedgerReceiptProps {
    record: any;
    categorySummary: Record<string, { billed: number; paid: number }>;
    totalBilled: number;
    totalPaid: number;
    totalBalance: number;
    selectedStudentUid: string;
    selectedYear: string;
    selectedTerm: string;
    primary: string;
    router: any;
}

const LedgerReceipt: React.FC<LedgerReceiptProps> = ({
    record,
    categorySummary,
    totalBilled,
    totalPaid,
    totalBalance,
    selectedStudentUid,
    selectedYear,
    selectedTerm,
    primary,
    router
}) => {
    return (
        <Animatable.View
            animation="fadeInUp"
            duration={600}
            style={styles.receiptPaper}
        >
            <View style={styles.divider} />
            <View style={styles.receiptHeaderRow}>
                <Text style={styles.receiptTitle}>TERM PAYMENT LEDGER</Text>
                <TouchableOpacity
                    onPress={() => {
                        router.push({
                            pathname: "/shared/receipt-view",
                            params: {
                                type: "bill",
                                studentId: selectedStudentUid,
                                year: selectedYear,
                                term: selectedTerm,
                            },
                        });
                    }}
                    style={styles.viewOfficialBtn}
                >
                    <SVGIcon name="document-text" size={18} color={primary} />
                    <Text style={[styles.viewOfficialText, { color: primary }]}>OFFICIAL BILL</Text>
                </TouchableOpacity>
            </View>

            {/* Student Info */}
            <View style={styles.paperInfoGrid}>
                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>STUDENT:</Text>
                    <Text style={styles.infoValue}>{record.studentName}</Text>
                </View>
                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>CLASS:</Text>
                    <Text style={styles.infoValue}>
                        {record.className || "N/A"}
                    </Text>
                </View>
                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>PERIOD:</Text>
                    <Text style={styles.infoValue}>
                        {record.term} • {record.academicYear}
                    </Text>
                </View>
                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>DATE:</Text>
                    <Text style={styles.infoValue}>
                        {moment().format("DD/MM/YYYY")}
                    </Text>
                </View>
            </View>

            {/* Category Summary as Financial Statement Table */}
            <View style={styles.invoiceTable}>
                <View style={styles.invoiceHeader}>
                    <Text style={[styles.invoiceTh, { flex: 2 }]}>DESCRIPTION</Text>
                    <Text style={[styles.invoiceTh, { flex: 1.2, textAlign: 'right' }]}>BILLED</Text>
                    <Text style={[styles.invoiceTh, { flex: 1.2, textAlign: 'right' }]}>PAID</Text>
                    <Text style={[styles.invoiceTh, { flex: 1.2, textAlign: 'right' }]}>BALANCE</Text>
                </View>
                {Object.entries(categorySummary)
                    .map(([cat, vals]: any) => {
                        const balance = (vals.billed || 0) - (vals.paid || 0);
                        return (
                            <View key={cat} style={styles.invoiceRow}>
                                <Text style={[styles.invoiceTd, { flex: 2, fontWeight: '700', fontSize: 10 }]}>{cat.toUpperCase()}</Text>
                                <Text style={[styles.invoiceTd, { flex: 1.2, textAlign: 'right' }]}>{SCHOOL_CONFIG.currencySymbol}{vals.billed.toFixed(2)}</Text>
                                <Text style={[styles.invoiceTd, { flex: 1.2, textAlign: 'right', color: "#10B981" }]}>{SCHOOL_CONFIG.currencySymbol}{vals.paid.toFixed(2)}</Text>
                                <Text style={[styles.invoiceTd, { flex: 1.2, textAlign: 'right', color: balance > 0 ? "#EF4444" : "#10B981", fontWeight: '700' }]}>
                                    {SCHOOL_CONFIG.currencySymbol}{balance.toFixed(2)}
                                </Text>
                            </View>
                        );
                    })}

                {/* Added Discount Row */}
                {record.discount > 0 && (
                    <View style={[styles.invoiceRow, { backgroundColor: '#F0FDFA' }]}>
                        <Text style={[styles.invoiceTd, { flex: 2, fontWeight: '700', fontSize: 10, color: '#0D9488' }]}>TERM DISCOUNT</Text>
                        <Text style={[styles.invoiceTd, { flex: 1.2, textAlign: 'right', color: '#0D9488' }]}>({SCHOOL_CONFIG.currencySymbol}{record.discount.toFixed(2)})</Text>
                        <Text style={[styles.invoiceTd, { flex: 1.2, textAlign: 'right' }]}>-</Text>
                        <Text style={[styles.invoiceTd, { flex: 1.2, textAlign: 'right', color: '#0D9488', fontWeight: '700' }]}>CREDIT</Text>
                    </View>
                )}
            </View>

            {/* Totals Section */}
            <View style={styles.totalsSection}>
                <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>TOTAL BILLED:</Text>
                    <Text style={styles.totalsValue}>{SCHOOL_CONFIG.currencySymbol}{totalBilled.toFixed(2)}</Text>
                </View>
                <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>TOTAL PAID:</Text>
                    <Text style={[styles.totalsValue, { color: "#10B981" }]}>{SCHOOL_CONFIG.currencySymbol}{totalPaid.toFixed(2)}</Text>
                </View>
                <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>NET BALANCE:</Text>
                    <Text style={[styles.grandTotalValue, { color: totalBalance > 0 ? "#EF4444" : "#10B981" }]}>
                        {SCHOOL_CONFIG.currencySymbol}{totalBalance.toFixed(2)}
                    </Text>
                </View>
            </View>

            {/* Paper Footer content */}
            <View style={styles.paperFooter}>
                <Text style={styles.footerText}>
                    Computer generated. Reverting transactions updates balances
                    instantly.
                </Text>
                <Text style={styles.copyrightText}>
                    © {moment().year()} {SCHOOL_CONFIG.fullName}
                </Text>
            </View>
        </Animatable.View>
    );
};

const styles = StyleSheet.create({
    receiptPaper: {
        backgroundColor: "#fff",
        borderRadius: 4,
        padding: 25,
        ...SHADOWS.medium,
        minHeight: 600,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        overflow: "hidden",
    },
    divider: { height: 2, backgroundColor: "#1E293B", marginVertical: 10 },
    receiptHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    receiptTitle: {
        fontSize: 14,
        fontWeight: "900",
        color: "#1E293B",
        letterSpacing: 2,
    },
    viewOfficialBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#CBD5E1",
    },
    viewOfficialText: {
        fontSize: 10,
        fontWeight: "900",
        letterSpacing: 1,
    },
    paperInfoGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginBottom: 25,
    },
    infoItem: { width: "48%" },
    infoLabel: { fontSize: 8, fontWeight: "900", color: "#94A3B8" },
    infoValue: { fontSize: 11, fontWeight: "700", color: "#1E293B" },
    invoiceTable: { marginBottom: 30, marginTop: 10 },
    invoiceHeader: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#1E293B',
    },
    invoiceTh: { fontSize: 10, fontWeight: '900', color: '#1E293B' },
    invoiceRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        alignItems: 'center',
    },
    invoiceTd: { fontSize: 11, color: '#1E293B' },
    totalsSection: { borderTopWidth: 1, borderTopColor: "#000", paddingTop: 15 },
    totalsRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 20,
        marginBottom: 6,
    },
    totalsLabel: { fontSize: 10, fontWeight: "800", color: "#64748B" },
    totalsValue: {
        fontSize: 11,
        fontWeight: "700",
        color: "#1E293B",
        width: 100,
        textAlign: "right",
    },
    grandTotalRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 20,
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderStyle: "dashed",
    },
    grandTotalLabel: { fontSize: 12, fontWeight: "900", color: "#1E293B" },
    grandTotalValue: {
        fontSize: 14,
        fontWeight: "900",
        color: COLORS.primary,
        width: 100,
        textAlign: "right",
    },
    paperFooter: { marginTop: 50, alignItems: "center" },
    footerText: {
        fontSize: 9,
        color: "#94A3B8",
        fontStyle: "italic",
        textAlign: "center",
    },
    copyrightText: {
        fontSize: 9,
        fontWeight: "800",
        color: "#CBD5E1",
        marginTop: 4,
    },
});

export default LedgerReceipt;
