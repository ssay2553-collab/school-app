import React from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import SVGIcon from '../../SVGIcon';
import { SHADOWS } from '../../../constants/theme';

interface LedgerFiltersProps {
    availableYears: string[];
    selectedYear: string;
    setSelectedYear: (year: string) => void;
    selectedTerm: string;
    setSelectedTerm: (term: string) => void;
    classes: any[];
    selectedClassId: string;
    setSelectedClassId: (id: string) => void;
    students: any[];
    selectedStudentUid: string;
    setSelectedStudentUid: (uid: string) => void;
    fetchingStudents: boolean;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    primary: string;
    secondary: string;
    acadConfig: any;
}

const LedgerFilters: React.FC<LedgerFiltersProps> = ({
    availableYears,
    selectedYear,
    setSelectedYear,
    selectedTerm,
    setSelectedTerm,
    classes,
    selectedClassId,
    setSelectedClassId,
    students,
    selectedStudentUid,
    setSelectedStudentUid,
    fetchingStudents,
    searchQuery,
    setSearchQuery,
    primary,
    secondary,
    acadConfig
}) => {
    return (
        <LinearGradient colors={[primary, secondary]} style={styles.filterCard}>
            <View style={styles.pickerRow}>
                <View style={styles.pickerBox}>
                    <Text style={styles.pickerLabel}>
                        YEAR {selectedYear === acadConfig.academicYear ? "(CUR)" : ""}
                    </Text>
                    <Picker
                        selectedValue={selectedYear}
                        onValueChange={setSelectedYear}
                        style={StyleSheet.flatten([
                            styles.picker,
                            Platform.OS === "web" &&
                            ({
                                color: "#000",
                                backgroundColor: "#fff",
                                height: 40,
                                borderRadius: 10,
                                marginTop: 15,
                            } as any),
                        ])}
                        dropdownIconColor={Platform.OS === "web" ? "#000" : "#fff"}
                    >
                        {availableYears.map((y) => (
                            <Picker.Item key={y} label={y} value={y} color="#000" />
                        ))}
                    </Picker>
                </View>
                <View style={StyleSheet.flatten([styles.pickerBox, { marginLeft: 10 }])}>
                    <Text style={styles.pickerLabel}>
                        TERM {selectedTerm === acadConfig.currentTerm ? "(CUR)" : ""}
                    </Text>
                    <Picker
                        selectedValue={selectedTerm}
                        onValueChange={setSelectedTerm}
                        style={StyleSheet.flatten([
                            styles.picker,
                            Platform.OS === "web" &&
                            ({
                                color: "#000",
                                backgroundColor: "#fff",
                                height: 40,
                                borderRadius: 10,
                                marginTop: 15,
                            } as any),
                        ])}
                        dropdownIconColor={Platform.OS === "web" ? "#000" : "#fff"}
                    >
                        <Picker.Item label="Term 1" value="Term 1" color="#000" />
                        <Picker.Item label="Term 2" value="Term 2" color="#000" />
                        <Picker.Item label="Term 3" value="Term 3" color="#000" />
                    </Picker>
                </View>
            </View>

            <View style={[styles.pickerRow, { marginTop: 10 }]}>
                <View style={styles.pickerBox}>
                    <Text style={styles.pickerLabel}>CLASS</Text>
                    <Picker
                        selectedValue={selectedClassId}
                        onValueChange={setSelectedClassId}
                        style={StyleSheet.flatten([
                            styles.picker,
                            Platform.OS === "web" &&
                            ({
                                color: "#000",
                                backgroundColor: "#fff",
                                height: 40,
                                borderRadius: 10,
                                marginTop: 15,
                            } as any),
                        ])}
                        dropdownIconColor={Platform.OS === "web" ? "#000" : "#fff"}
                    >
                        {classes.map((c) => (
                            <Picker.Item key={c.id} label={c.name} value={c.id} color="#000" />
                        ))}
                    </Picker>
                </View>
                <View style={StyleSheet.flatten([styles.pickerBox, { marginLeft: 10 }])}>
                    <Text style={styles.pickerLabel}>STUDENT</Text>
                    <Picker
                        selectedValue={selectedStudentUid}
                        onValueChange={setSelectedStudentUid}
                        style={StyleSheet.flatten([
                            styles.picker,
                            Platform.OS === "web" &&
                            ({
                                color: "#000",
                                backgroundColor: "#fff",
                                height: 40,
                                borderRadius: 10,
                                marginTop: 15,
                            } as any),
                        ])}
                        dropdownIconColor={Platform.OS === "web" ? "#000" : "#fff"}
                    >
                        {fetchingStudents ? (
                            <Picker.Item label="Loading..." value="" color="#000" />
                        ) : (
                            students.map((s) => (
                                <Picker.Item key={s.uid} label={s.name} value={s.uid} color="#000" />
                            ))
                        )}
                    </Picker>
                </View>
            </View>

            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search serial or payee..."
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                <SVGIcon name="search" size={20} color="#fff" />
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    filterCard: {
        padding: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        ...SHADOWS.medium,
    },
    pickerRow: { flexDirection: "row" },
    pickerBox: {
        flex: 1,
        backgroundColor: "rgba(255,255,255,0.15)",
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
    },
    pickerLabel: {
        fontSize: 8,
        fontWeight: "900",
        color: "rgba(255,255,255,0.8)",
        marginLeft: 5,
    },
    picker: { color: "#fff", height: 40 },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.2)",
        borderRadius: 12,
        paddingHorizontal: 15,
        marginTop: 15,
        height: 45,
    },
    searchInput: {
        flex: 1,
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },
});

export default LedgerFilters;
