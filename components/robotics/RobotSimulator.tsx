import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MazeEnvironment } from './MazeEnvironment';
import { RobotMascot } from './RobotMascot';
import { SHADOWS } from '../../constants/theme';

interface RobotSimulatorProps {
  robotX: number;
  robotY: number;
  robotDir: 'N' | 'E' | 'S' | 'W';
  targetX: number;
  targetY: number;
  checkpointX?: number;
  checkpointY?: number;
  checkpointCollected?: boolean;
  isCooperative?: boolean;
  switchX?: number;
  switchY?: number;
  switchPressed?: boolean;
  gateX?: number;
  gateY?: number;
  robotBX?: number;
  robotBY?: number;
  robotBDirection?: 'N' | 'E' | 'S' | 'W';
  obstacles?: Array<{ x: number; y: number }>;
  movingHazards?: Array<{ x: number; y: number }>;
  gridSize?: number;
  challengeTitle?: string;
  challengeDescription?: string;
  maxBlocks?: number;
  simRunning: boolean;
  simLog: string;
  primaryColor: string;
  onRun: () => void;
  onReset: () => void;
  onOpenBlocks?: () => void;
}

export function RobotSimulator({
  robotX,
  robotY,
  robotDir,
  targetX,
  targetY,
  checkpointX,
  checkpointY,
  checkpointCollected = false,
  isCooperative = false,
  switchX,
  switchY,
  switchPressed = false,
  gateX,
  gateY,
  robotBX,
  robotBY,
  robotBDirection = 'E',
  obstacles = [],
  movingHazards = [],
  gridSize = 5,
  challengeTitle,
  challengeDescription,
  maxBlocks,
  simRunning,
  simLog,
  primaryColor,
  onRun,
  onReset,
  onOpenBlocks,
}: RobotSimulatorProps) {
  return (
    <View style={styles.outerWrapper}>
      <RobotMascot message={isCooperative ? "🤖 Swarm Cooperative Mission: Robot A must hit the switch (🎛️) to open the gate (🚪) for Robot B!" : "Welcome to the Virtual Lab! Arrange your command blocks and hit Run."} expression="excited" />

      {challengeTitle && (
        <View style={styles.missionCard}>
          <Text style={styles.missionTitle}>🎯 Mission Objective: {challengeTitle}</Text>
          <Text style={styles.missionDesc}>{challengeDescription}</Text>
          {maxBlocks && <Text style={styles.missionLimit}>⚠️ Recommended Max Blocks: {maxBlocks}</Text>}
        </View>
      )}

      <View style={styles.simContainer}>
        <View style={styles.labHeaderRow}>
          <Text style={styles.labBanner}>🔬 EduEaz Robotics Lab ({gridSize}x{gridSize} Arena)</Text>
          {onOpenBlocks && (
            <TouchableOpacity
              style={[styles.topBlocksNavBtn, { backgroundColor: primaryColor + '15', borderColor: primaryColor + '40' }]}
              onPress={onOpenBlocks}
              activeOpacity={0.8}
            >
              <Text style={[styles.topBlocksNavText, { color: primaryColor }]}>🧱 Edit Code Blocks ➔</Text>
            </TouchableOpacity>
          )}
        </View>

        <MazeEnvironment
          robotX={robotX}
          robotY={robotY}
          robotDir={robotDir}
          targetX={targetX}
          targetY={targetY}
          checkpointX={checkpointX}
          checkpointY={checkpointY}
          checkpointCollected={checkpointCollected}
          isCooperative={isCooperative}
          switchX={switchX}
          switchY={switchY}
          switchPressed={switchPressed}
          gateX={gateX}
          gateY={gateY}
          robotBX={robotBX}
          robotBY={robotBY}
          robotBDirection={robotBDirection}
          obstacles={obstacles}
          movingHazards={movingHazards}
          gridSize={gridSize}
        />
        <View style={styles.simControls}>
          <Text style={styles.simLogText}>{simLog}</Text>
          <View style={styles.simBtnRow}>
            <TouchableOpacity
              style={[styles.simActionBtn, { backgroundColor: primaryColor }]}
              onPress={onRun}
              disabled={simRunning}
            >
              {simRunning ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.simBtnText}>▶️ RUN PROGRAM</Text>}
            </TouchableOpacity>
            {onOpenBlocks && (
              <TouchableOpacity
                style={[styles.simBlocksBtn, { backgroundColor: primaryColor + '15', borderColor: primaryColor }]}
                onPress={onOpenBlocks}
                activeOpacity={0.8}
              >
                <Text style={[styles.simBlocksText, { color: primaryColor }]}>🧱 Open Blocks</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.simResetBtn} onPress={onReset}>
              <Text style={styles.simResetText}>🔄 Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  missionCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    ...SHADOWS.small,
  },
  missionTitle: { fontSize: 14, fontWeight: '900', color: '#1E40AF', marginBottom: 4 },
  missionDesc: { fontSize: 13, color: '#1E3A8A', lineHeight: 18, marginBottom: 6 },
  missionLimit: { fontSize: 11, fontWeight: '800', color: '#D97706' },
  simContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  labHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  labBanner: { fontSize: 13, fontWeight: '900', color: '#4338CA', textTransform: 'uppercase', letterSpacing: 0.5 },
  topBlocksNavBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  topBlocksNavText: { fontSize: 12, fontWeight: '800' },
  simControls: { width: '100%', alignItems: 'center' },
  simLogText: {
    fontSize: 12,
    color: '#334155',
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  simBtnRow: { flexDirection: 'row', gap: 8, width: '100%', flexWrap: 'wrap' },
  simActionBtn: { flex: 2, minWidth: 120, paddingVertical: 12, borderRadius: 12, alignItems: 'center', ...SHADOWS.small },
  simBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  simBlocksBtn: { flex: 1.5, minWidth: 110, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, ...SHADOWS.small },
  simBlocksText: { fontWeight: '800', fontSize: 13 },
  simResetBtn: { flex: 1, minWidth: 80, backgroundColor: '#E2E8F0', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  simResetText: { color: '#334155', fontWeight: '800', fontSize: 13 },
});
