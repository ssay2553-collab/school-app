import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SVGIcon from '../SVGIcon';
import { SHADOWS } from '../../constants/theme';

interface RoboticsAchievementsProps {
  earnedBadges: string[];
  totalPoints: number;
}

export function RoboticsAchievements({ earnedBadges, totalPoints }: RoboticsAchievementsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>🎖️ Achievements & Badges</Text>
      <Text style={styles.sectionSub}>Your earned badges and robotics milestone awards.</Text>

      <View style={styles.badgeGrid}>
        {earnedBadges.length === 0 ? (
          <Text style={styles.emptyText}>No badges earned yet. Complete lessons and challenges to unlock badges!</Text>
        ) : (
          earnedBadges.map((badge, index) => (
            <View key={index} style={styles.badgeCard}>
              <SVGIcon name="ribbon" size={28} color="#4ECDC4" />
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10 },
  sectionHeader: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badgeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    width: '47%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.small,
  },
  badgeText: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 8, textAlign: 'center' },
  emptyText: { fontSize: 13, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', marginTop: 20 },
});
