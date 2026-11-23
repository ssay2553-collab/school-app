import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import SVGIcon from '../SVGIcon';
import { SHADOWS } from '../../constants/theme';

interface RoboticsTutorialModalProps {
  visible: boolean;
  onClose: () => void;
  primaryColor: string;
}

export function RoboticsTutorialModal({ visible, onClose, primaryColor }: RoboticsTutorialModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: '📚 Step 1: Master the Theory',
      icon: 'book',
      color: '#4D96FF',
      desc: 'Start by exploring the Robotics Laboratory Lessons. Read deep-dive engineering principles, study code examples, and pass the Mini Knowledge Check quizzes to earn XP points and badges.'
    },
    {
      title: '🧩 Step 2: Build with Code Blocks',
      icon: 'code-slash',
      color: '#A855F7',
      desc: 'Navigate to the Coding Blocks tab. Tap action blocks like "Move Forward", "Turn Right", "Turn Left", and "Stop" to build your sequential algorithm step-by-step in the Active Program Queue.'
    },
    {
      title: '🔬 Step 3: Run the Virtual Simulator',
      icon: 'play-circle-outline',
      color: '#6BCB77',
      desc: 'Switch to the Simulator tab to test your code. Hit "▶️ RUN PROGRAM" and watch the robot execute your instructions on the virtual grid lab floor to reach the target tile.'
    },
    {
      title: '🏆 Step 4: Solve Challenges & Earn Badges',
      icon: 'trophy',
      color: '#FFD93D',
      desc: 'Progress through 8 exciting challenge levels—from basic movement to obstacle dodging and master loops—to unlock grandmaster achievements!'
    }
  ];

  const step = steps[currentStep];

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <SVGIcon name="bulb" size={24} color={primaryColor} />
              <Text style={styles.headerTitle}>Robotics Lab Quick Guide 💡</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <SVGIcon name="close" size={22} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={[styles.stepIconBox, { backgroundColor: step.color + '20', borderColor: step.color }]}>
              <SVGIcon name={step.icon} size={48} color={step.color} />
            </View>

            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepDesc}>{step.desc}</Text>

            <View style={styles.paginationRow}>
              {steps.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    idx === currentStep && { backgroundColor: primaryColor, width: 24 }
                  ]}
                />
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {currentStep > 0 ? (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setCurrentStep(currentStep - 1)}
              >
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
            ) : <View style={{ flex: 1 }} />}

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: primaryColor }]}
              onPress={() => {
                if (currentStep < steps.length - 1) {
                  setCurrentStep(currentStep + 1);
                } else {
                  onClose();
                  setCurrentStep(0);
                }
              }}
            >
              <Text style={styles.primaryBtnText}>
                {currentStep === steps.length - 1 ? 'Got it! Let’s Code 🚀' : 'Next Step ➔'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  container: { backgroundColor: '#fff', width: '100%', maxWidth: 420, borderRadius: 28, overflow: 'hidden', ...SHADOWS.large },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  body: { padding: 24, alignItems: 'center' },
  stepIconBox: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 2 },
  stepTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', textAlign: 'center', marginBottom: 12 },
  stepDesc: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  paginationRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#CBD5E1' },
  footer: { flexDirection: 'row', padding: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 12 },
  secondaryBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { fontSize: 14, fontWeight: '800', color: '#64748B' },
  primaryBtn: { flex: 2, paddingVertical: 14, borderRadius: 14, justifyContent: 'center', alignItems: 'center', ...SHADOWS.small },
  primaryBtnText: { fontSize: 14, fontWeight: '900', color: '#fff' },
});
