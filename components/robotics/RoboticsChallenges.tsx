import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Animatable from 'react-native-animatable';
import { CHALLENGES, ChallengeLevel } from '../../data/robotics/challenges';
import { RobotMascot } from './RobotMascot';
import { SHADOWS } from '../../constants/theme';

interface RoboticsChallengesProps {
  completedChallenges: number[];
  onCompleteLevel: (challenge: ChallengeLevel) => void;
  primaryColor: string;
}

const isColorLight = (color: string) => {
  if (!color) return false;
  const hex = color.replace('#', '');
  if (hex.length !== 6) return false;
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 160;
};

export function RoboticsChallenges({ completedChallenges, onCompleteLevel, primaryColor }: RoboticsChallengesProps) {
  const activeBtnBg = isColorLight(primaryColor) ? '#4F46E5' : (primaryColor || '#4F46E5');

  return (
    <View>
      <RobotMascot message="Take on progressive robotics challenges, earn points, and collect legendary badges!" expression="success" />

      <Text style={styles.sectionHeader}>🏆 Progressive Robotics Challenges</Text>
      <Text style={styles.sectionSub}>Complete levels, solve routing tasks, earn points & collect badges!</Text>

      {CHALLENGES.map((lvl, index) => {
        const isCleared = completedChallenges.includes(lvl.id);
        const btnBg = isCleared ? '#E2E8F0' : activeBtnBg;
        const btnTextColor = isCleared ? '#0F172A' : '#FFFFFF';
        const btnBorderColor = isCleared ? '#CBD5E1' : activeBtnBg;

        return (
          <Animatable.View key={lvl.id} animation="fadeInUp" duration={600} delay={index * 60}>
            <View style={[styles.challengeCard, isCleared && styles.clearedChallengeCard]}>
              <View style={styles.challengeHeader}>
                <Text style={styles.challengeTitle}>{lvl.title}</Text>
                <View style={[styles.badgeTag, { backgroundColor: isCleared ? '#10B98120' : '#FFD93D25' }]}>
                  <Text style={[styles.badgeTagText, { color: isCleared ? '#059669' : '#D97706' }]}>
                    {isCleared ? '⭐ CLEARED' : `+${lvl.points} PTS`}
                  </Text>
                </View>
              </View>
              <Text style={styles.challengeDesc}>{lvl.description}</Text>
              <View style={styles.challengeFooter}>
                <Text style={styles.badgeReward}>Reward Badge: {lvl.badge}</Text>
                <TouchableOpacity
                  style={[
                    styles.challengeBtn,
                    { backgroundColor: btnBg, borderColor: btnBorderColor },
                  ]}
                  onPress={() => onCompleteLevel(lvl)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.challengeBtnText, { color: btnTextColor }]}>
                    {isCleared ? 'Replay Level' : 'Start Level'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animatable.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  challengeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.small,
  },
  clearedChallengeCard: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  challengeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  challengeTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  badgeTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeTagText: { fontSize: 11, fontWeight: '900' },
  challengeDesc: { fontSize: 13, color: '#64748B', marginBottom: 12, lineHeight: 18 },
  challengeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  badgeReward: { fontSize: 11, fontWeight: '700', color: '#475569' },
  challengeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    elevation: 1,
  },
  challengeBtnText: { fontWeight: '900', fontSize: 12 },
});
