import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Animatable from 'react-native-animatable';
import SVGIcon from '../SVGIcon';
import { LESSONS, Lesson } from '../../data/robotics/lessons';
import { RobotMascot } from './RobotMascot';
import { SHADOWS } from '../../constants/theme';

interface RoboticsLessonsProps {
  completedLessons: string[];
  onSelectLesson: (lesson: Lesson) => void;
  primaryColor: string;
}

export function RoboticsLessons({ completedLessons, onSelectLesson, primaryColor }: RoboticsLessonsProps) {
  const progressPercent = Math.round((completedLessons.length / LESSONS.length) * 100);

  return (
    <View style={styles.container}>
      <RobotMascot message="Tap any lesson below to explore robotics theory, illustrations, and take interactive quizzes!" expression="excited" />

      {/* PROGRESS BAR */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Curriculum Mastery</Text>
          <Text style={[styles.progressVal, { color: primaryColor }]}>{progressPercent}% Completed</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: primaryColor }]} />
        </View>
      </View>

      <Text style={styles.sectionHeader}>📚 Robotics Laboratory Lessons</Text>
      <Text style={styles.sectionSub}>Bundled 100% offline with rich illustrations and quizzes.</Text>

      {LESSONS.map((lesson, index) => {
        const isCompleted = completedLessons.includes(lesson.id);
        return (
          <Animatable.View key={lesson.id} animation="fadeInUp" duration={600} delay={index * 80}>
            <TouchableOpacity
              style={styles.lessonCard}
              onPress={() => onSelectLesson(lesson)}
              activeOpacity={0.85}
            >
              <View style={[styles.lessonIconBox, { backgroundColor: isCompleted ? '#6BCB7720' : primaryColor + '20' }]}>
                <SVGIcon name={isCompleted ? 'checkmark-circle' : 'book'} size={24} color={isCompleted ? '#6BCB77' : primaryColor} />
              </View>
              <View style={styles.lessonInfo}>
                <Text style={[styles.lessonCategory, { color: primaryColor }]}>{lesson.category}</Text>
                <Text style={styles.lessonTitle}>{lesson.title}</Text>
                <Text style={styles.lessonSummary} numberOfLines={2}>{lesson.summary}</Text>
              </View>
              <SVGIcon name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </Animatable.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.small,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  progressVal: { fontSize: 13, fontWeight: '900' },
  progressBarBg: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  sectionHeader: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  lessonCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.small,
  },
  lessonIconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  lessonInfo: { flex: 1 },
  lessonCategory: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 2 },
  lessonTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  lessonSummary: { fontSize: 12, color: '#64748B', lineHeight: 18 },
});
