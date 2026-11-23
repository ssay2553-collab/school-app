import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import SVGIcon from '../SVGIcon';
import { SHADOWS } from '../../constants/theme';

interface RoboticsHeaderProps {
  primaryColor: string;
  onBack: () => void;
  onOpenTutorial: () => void;
  totalPoints: number;
  earnedBadgesCount: number;
  completedLessonsCount: number;
  totalLessonsCount: number;
  syncStatus: 'synced' | 'offline_saved' | 'syncing';
}

export function RoboticsHeader({
  primaryColor,
  onBack,
  onOpenTutorial,
  totalPoints,
  earnedBadgesCount,
  completedLessonsCount,
  totalLessonsCount,
  syncStatus,
}: RoboticsHeaderProps) {
  return (
    <LinearGradient colors={[primaryColor, '#4338ca']} style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <SVGIcon name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>EduEaz Robotics Lab 🤖</Text>
          <Text style={styles.subtitle}>Learn, Build, Code & Create (100% Offline)</Text>
        </View>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity style={styles.tutorialBtn} onPress={onOpenTutorial} activeOpacity={0.7}>
            <SVGIcon name="help-circle" size={18} color="#fff" />
            <Text style={styles.tutorialText}>Guide</Text>
          </TouchableOpacity>
          <View style={styles.syncBadge}>
            <SVGIcon
              name={syncStatus === 'synced' ? 'cloud-done' : 'cloud-offline'}
              size={16}
              color="#fff"
            />
            <Text style={styles.syncText}>{syncStatus === 'synced' ? 'Synced' : 'Saved'}</Text>
          </View>
        </div>
      </View>

      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <SVGIcon name="trophy" size={16} color="#FFD93D" />
          <Text style={styles.statText}>{totalPoints} Pts</Text>
        </View>
        <View style={styles.statItem}>
          <SVGIcon name="ribbon" size={16} color="#4ECDC4" />
          <Text style={styles.statText}>{earnedBadgesCount} Badges</Text>
        </View>
        <View style={styles.statItem}>
          <SVGIcon name="checkbox" size={16} color="#6BCB77" />
          <Text style={styles.statText}>{completedLessonsCount}/{totalLessonsCount} Lessons</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === 'android' ? 35 : 15,
    paddingBottom: 20,
    paddingHorizontal: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...SHADOWS.medium,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '900', color: '#fff' },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  syncText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  tutorialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  tutorialText: { fontSize: 11, color: '#fff', fontWeight: '800' },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingVertical: 8,
    marginTop: 6,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 12, fontWeight: '800', color: '#fff' },
});
