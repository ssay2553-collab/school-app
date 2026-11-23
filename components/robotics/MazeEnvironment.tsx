import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RobotCharacter } from './RobotCharacter';

interface MazeEnvironmentProps {
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
}

export function MazeEnvironment({
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
  gridSize = 5
}: MazeEnvironmentProps) {
  const rows = Array.from({ length: gridSize }, (_, i) => i + 1);
  const cols = Array.from({ length: gridSize }, (_, i) => i + 1);

  return (
    <View style={[styles.gridBoard, gridSize > 5 && styles.largeGridBoard]}>
      {rows.map((row) => (
        <View key={row} style={styles.gridRow}>
          {cols.map((col) => {
            const isRobotA = robotX === col && robotY === row;
            const isRobotB = isCooperative && robotBX === col && robotBY === row;
            const isSwitch = isCooperative && switchX === col && switchY === row;
            const isGate = isCooperative && gateX === col && gateY === row;
            const isCheckpoint = checkpointX === col && checkpointY === row && !checkpointCollected;
            const isTarget = targetX === col && targetY === row && (checkpointCollected || !checkpointX);
            const isObstacle = obstacles.some(o => o.x === col && o.y === row);
            const isHazard = movingHazards.some(h => h.x === col && h.y === row);

            return (
              <View
                key={col}
                style={[
                  styles.gridCell,
                  gridSize > 5 && styles.smallGridCell,
                  isRobotA && styles.robotCell,
                  isRobotB && styles.robotCellB,
                  isSwitch && styles.switchCell,
                  isGate && (switchPressed ? styles.gateOpenCell : styles.gateClosedCell),
                  isCheckpoint && styles.checkpointCell,
                  isTarget && styles.targetCell,
                  isObstacle && styles.obstacleCell,
                  isHazard && styles.hazardCell,
                ]}
              >
                {isRobotA && <RobotCharacter direction={robotDir} size={gridSize > 5 ? 14 : 18} />}
                {isRobotB && !isRobotA && <RobotCharacter direction={robotBDirection} size={gridSize > 5 ? 14 : 18} />}
                {isSwitch && !isRobotA && !isRobotB && <Text style={styles.emoji}>{switchPressed ? '🟢' : '🎛️'}</Text>}
                {isGate && !isRobotA && !isRobotB && <Text style={styles.emoji}>{switchPressed ? '🔓' : '🔒'}</Text>}
                {isCheckpoint && !isRobotA && !isRobotB && <Text style={styles.emoji}>💎</Text>}
                {isTarget && !isRobotA && !isRobotB && <Text style={styles.emoji}>🏫</Text>}
                {isHazard && !isRobotA && !isRobotB && !isTarget && !isCheckpoint && !isSwitch && !isGate && <Text style={styles.emoji}>⚡</Text>}
                {isObstacle && !isRobotA && !isRobotB && !isTarget && !isCheckpoint && !isSwitch && !isGate && !isHazard && <Text style={styles.emoji}>🧱</Text>}
                {!isRobotA && !isRobotB && !isTarget && !isObstacle && !isCheckpoint && !isSwitch && !isGate && !isHazard && <Text style={styles.cellCoord}>{col},{row}</Text>}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gridBoard: {
    width: 280,
    height: 280,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 8,
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  largeGridBoard: {
    width: 320,
    height: 320,
  },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', flex: 1 },
  gridCell: {
    width: 48,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  smallGridCell: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  robotCell: { backgroundColor: '#EEF2FF', borderColor: '#6366F1', borderWidth: 2 },
  robotCellB: { backgroundColor: '#F0FDF4', borderColor: '#10B981', borderWidth: 2 },
  switchCell: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 2 },
  gateClosedCell: { backgroundColor: '#FEE2E2', borderColor: '#EF4444', borderWidth: 2 },
  gateOpenCell: { backgroundColor: '#DCFCE7', borderColor: '#10B981', borderWidth: 2 },
  checkpointCell: { backgroundColor: '#FEF9C3', borderColor: '#EAB308', borderWidth: 2 },
  targetCell: { backgroundColor: '#ECFDF5', borderColor: '#10B981', borderWidth: 2 },
  obstacleCell: { backgroundColor: '#FEF2F2', borderColor: '#EF4444', borderWidth: 2 },
  hazardCell: { backgroundColor: '#FAF5FF', borderColor: '#A855F7', borderWidth: 2 },
  emoji: { fontSize: 18 },
  cellCoord: { fontSize: 8, color: '#94A3B8' },
});
