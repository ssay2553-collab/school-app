import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import SVGIcon from '../SVGIcon';
import { SHADOWS } from '../../constants/theme';
import { CHALLENGES } from '../../data/robotics/challenges';
import { LESSONS } from '../../data/robotics/lessons';

interface TeacherControlsProps {
  onExportProgress: () => void;
  onResetProgress: () => void;
  primaryColor: string;
}

export function TeacherControls({ onExportProgress, onResetProgress, primaryColor }: TeacherControlsProps) {
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader} accessibilityRole="header">👩‍🏫 Teacher & Instructor Controls</Text>
      <Text style={styles.sectionSub}>Manage student tracking, curriculum guides, and reset class lab states.</Text>

      <View style={styles.card}>
        <TouchableOpacity
          style={[styles.controlBtn, { backgroundColor: primaryColor }]}
          onPress={() => setShowAnalyticsModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Open class analytics report"
        >
          <SVGIcon name="stats-chart" size={18} color="#fff" />
          <Text style={styles.controlBtnText}>View Class Analytics Report</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, { backgroundColor: '#10B981' }]}
          onPress={onExportProgress}
          accessibilityRole="button"
          accessibilityLabel="Export student progress summary"
        >
          <SVGIcon name="download" size={18} color="#fff" />
          <Text style={styles.controlBtnText}>Export Student Progress Summary</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resetBtn}
          onPress={onResetProgress}
          accessibilityRole="button"
          accessibilityLabel="Reset local progress"
        >
          <SVGIcon name="refresh" size={18} color="#EF4444" />
          <Text style={styles.resetBtnText}>Reset Local Progress</Text>
        </TouchableOpacity>
      </View>

      {/* ANALYTICS MODAL */}
      <Modal visible={showAnalyticsModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📊 Robotics Class Analytics</Text>
              <TouchableOpacity onPress={() => setShowAnalyticsModal(false)} accessibilityRole="button">
                <SVGIcon name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.metricCard}>
                <Text style={styles.metricTitle}>Total Curriculum Lessons</Text>
                <Text style={styles.metricValue}>{LESSONS.length} Lessons Available (Offline)</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricTitle}>Progressive Challenge Levels</Text>
                <Text style={styles.metricValue}>{CHALLENGES.length} Levels (Up to 500 Pts)</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricTitle}>Offline Sync Status</Text>
                <Text style={[styles.metricValue, { color: '#10B981' }]}>100% Offline Capable with Auto-Retry Queue</Text>
              </View>

              <Text style={styles.subHeader}>Curriculum Overview:</Text>
              {LESSONS.map((l) => (
                <View key={l.id} style={styles.curriculumItem}>
                  <Text style={styles.currTitle}>{l.title}</Text>
                  <Text style={styles.currCat}>{l.category}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10 },
  sectionHeader: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    ...SHADOWS.small,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    ...SHADOWS.small,
  },
  controlBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    gap: 8,
  },
  resetBtnText: { color: '#EF4444', fontWeight: '800', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  modalScroll: { maxHeight: 450 },
  metricCard: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  metricTitle: { fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 4 },
  metricValue: { fontSize: 15, fontWeight: '900', color: '#0F172A' },
  subHeader: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginTop: 10, marginBottom: 10 },
  curriculumItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  currTitle: { fontSize: 13, fontWeight: '800', color: '#334155' },
  currCat: { fontSize: 11, fontWeight: '700', color: '#6366F1' },
});
