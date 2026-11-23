import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, SafeAreaView } from 'react-native';
import * as Animatable from 'react-native-animatable';
import SVGIcon from '../SVGIcon';
import { ChallengeLevel } from '../../data/robotics/challenges';
import { SHADOWS } from '../../constants/theme';

interface LevelClearedModalProps {
  visible: boolean;
  challenge: ChallengeLevel | null;
  starCount: number;
  timeSeconds: number;
  blocksUsed: number;
  bonusPoints: number;
  onNextLevel: () => void;
  onReplayLevel: () => void;
  primaryColor: string;
}

export function LevelClearedModal({
  visible,
  challenge,
  starCount,
  timeSeconds,
  blocksUsed,
  bonusPoints,
  onNextLevel,
  onReplayLevel,
  primaryColor
}: LevelClearedModalProps) {
  if (!challenge) return null;

  const stars = starCount === 3 ? '⭐⭐⭐' : starCount === 2 ? '⭐⭐☆' : '⭐☆☆';

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onReplayLevel}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <Animatable.View animation="zoomIn" duration={400} style={styles.card}>
            <View style={styles.starsRow}>
              <Text style={styles.starsText}>{stars}</Text>
            </View>

            <View style={[styles.trophyCircle, { backgroundColor: primaryColor + '20', borderColor: primaryColor }]}>
              <SVGIcon name="trophy" size={48} color={primaryColor} />
            </View>

            <Text style={styles.congratsTitle}>🎉 LEVEL CLEARED! 🏆</Text>
            <Text style={styles.levelName}>{challenge.title}</Text>

            <View style={styles.rewardCard}>
              <View style={styles.rewardRow}>
                <SVGIcon name="star" size={18} color="#FFD93D" />
                <Text style={styles.rewardText}>Base XP: +{challenge.points} Pts</Text>
              </View>
              {bonusPoints > 0 && (
                <View style={styles.rewardRow}>
                  <SVGIcon name="flash" size={18} color="#10B981" />
                  <Text style={[styles.rewardText, { color: '#10B981' }]}>Perfect Navigation Bonus: +{bonusPoints} Pts</Text>
                </View>
              )}
              <View style={styles.rewardRow}>
                <SVGIcon name="time" size={18} color="#6366F1" />
                <Text style={styles.rewardText}>Time: {timeSeconds}s | Blocks: {blocksUsed}/{challenge.maxBlocks || 10}</Text>
              </View>
              <View style={styles.rewardRow}>
                <SVGIcon name="ribbon" size={18} color="#4ECDC4" />
                <Text style={styles.rewardText}>Badge: {challenge.badge}</Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.replayBtn} onPress={onReplayLevel} activeOpacity={0.8}>
                <Text style={styles.replayText}>🔄 Replay</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.nextBtn, { backgroundColor: primaryColor }]} onPress={onNextLevel} activeOpacity={0.8}>
                <Text style={styles.nextText}>Next Level ➔</Text>
              </TouchableOpacity>
            </View>
          </Animatable.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  container: { width: '100%', maxWidth: 400, alignItems: 'center' },
  card: { backgroundColor: '#fff', width: '100%', borderRadius: 30, padding: 26, alignItems: 'center', ...SHADOWS.large },
  starsRow: { marginBottom: 8 },
  starsText: { fontSize: 32, letterSpacing: 4 },
  trophyCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 14, borderWidth: 2 },
  congratsTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 4, textAlign: 'center' },
  levelName: { fontSize: 14, fontWeight: '800', color: '#6366F1', marginBottom: 16, textAlign: 'center' },
  rewardCard: { backgroundColor: '#F8FAFC', width: '100%', borderRadius: 16, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rewardText: { fontSize: 13, fontWeight: '800', color: '#334155' },
  buttonRow: { flexDirection: 'row', gap: 12, width: '100%' },
  replayBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  replayText: { fontSize: 14, fontWeight: '800', color: '#64748B' },
  nextBtn: { flex: 1.5, paddingVertical: 14, borderRadius: 16, justifyContent: 'center', alignItems: 'center', ...SHADOWS.small },
  nextText: { fontSize: 14, fontWeight: '900', color: '#fff' },
});
