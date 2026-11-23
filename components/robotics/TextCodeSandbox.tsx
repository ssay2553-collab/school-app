import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform } from 'react-native';
import { RobotMascot } from './RobotMascot';
import { SHADOWS } from '../../constants/theme';

interface TextCodeSandboxProps {
  codeScript: string;
  onChangeCode: (code: string) => void;
  onRunScript: () => void;
  primaryColor: string;
}

export function TextCodeSandbox({ codeScript, onChangeCode, onRunScript, primaryColor }: TextCodeSandboxProps) {
  return (
    <View>
      <RobotMascot message="Write real text-based control scripts (e.g. move_forward(); turn_right(); stop();) to program your robot like a professional developer!" expression="excited" />

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>💻 Text-Based Code Sandbox (JHS / SHS Mode)</Text>
          <Text style={styles.hint}>Supported commands: move_forward(), turn_left(), turn_right(), wait(), stop()</Text>
        </View>

        <TextInput
          style={styles.editorInput}
          multiline
          placeholder={`// Write your robot control script here:\nmove_forward();\nmove_forward();\nturn_right();\nmove_forward();\nstop();`}
          placeholderTextColor="#94A3B8"
          value={codeScript}
          onChangeText={onChangeCode}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity style={[styles.runScriptBtn, { backgroundColor: primaryColor }]} onPress={onRunScript} activeOpacity={0.8}>
          <Text style={styles.runScriptText}>▶️ Compile & Test Script in Simulator</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    ...SHADOWS.medium,
  },
  cardHeader: { marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: '#F8FAFC', marginBottom: 4 },
  hint: { fontSize: 11, color: '#38BDF8', fontWeight: '700' },
  editorInput: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    color: '#38BDF8',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    height: 180,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  runScriptBtn: { padding: 14, borderRadius: 14, alignItems: 'center', ...SHADOWS.small },
  runScriptText: { color: '#fff', fontWeight: '900', fontSize: 14 },
});
