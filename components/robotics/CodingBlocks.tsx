import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, ScrollView, Platform } from 'react-native';
import SVGIcon from '../SVGIcon';
import { RobotMascot } from './RobotMascot';
import { SHADOWS } from '../../constants/theme';

export interface CommandBlock {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
}

export const AVAILABLE_BLOCKS: CommandBlock[] = [
  { id: 'move_forward', name: 'Move Forward', icon: 'arrow-up', color: '#4D96FF', desc: 'Moves robot 1 step ahead' },
  { id: 'turn_left', name: 'Turn Left', icon: 'arrow-back', color: '#FF6B6B', desc: 'Rotates robot 90° counter-clockwise' },
  { id: 'turn_right', name: 'Turn Right', icon: 'arrow-forward', color: '#6BCB77', desc: 'Rotates robot 90° clockwise' },
  { id: 'repeat_2', name: 'Repeat 2x', icon: 'repeat', color: '#FFD93D', desc: 'Repeats next action 2 times' },
  { id: 'repeat_3', name: 'Repeat 3x', icon: 'repeat', color: '#F59E0B', desc: 'Repeats next action 3 times' },
  { id: 'repeat_4', name: 'Repeat 4x', icon: 'repeat', color: '#D97706', desc: 'Repeats next action 4 times' },
  { id: 'repeat_5', name: 'Repeat 5x', icon: 'repeat', color: '#B45309', desc: 'Repeats next action 5 times' },
  { id: 'if_obstacle', name: 'If Obstacle', icon: 'shield-outline', color: '#A855F7', desc: 'Checks sensor for walls' },
  { id: 'stop', name: 'Stop Robot', icon: 'stop', color: '#EF4444', desc: 'Halts execution and finishes' },
  { id: 'wait', name: 'Wait 2s', icon: 'time', color: '#0EA5E9', desc: 'Pauses for 2 seconds' },
];

interface CodingBlocksProps {
  blockQueue: string[];
  onAddBlock: (blockId: string, insertIndex?: number) => void;
  onRemoveBlock: (index: number) => void;
  onMoveBlock: (index: number, direction: 'up' | 'down') => void;
  onUpdateQueue: (newQueue: string[]) => void;
  onClearQueue: () => void;
  onTestRun: () => void;
  primaryColor: string;
}

export function CodingBlocks({
  blockQueue,
  onAddBlock,
  onRemoveBlock,
  onMoveBlock,
  onUpdateQueue,
  onClearQueue,
  onTestRun,
  primaryColor,
}: CodingBlocksProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importText, setImportText] = useState('');

  const handlePalettePress = (blockId: string) => {
    onAddBlock(blockId, selectedIndex !== null ? selectedIndex : blockQueue.length - 1);
    if (selectedIndex !== null) {
      setSelectedIndex(selectedIndex + 1);
    } else {
      setSelectedIndex(blockQueue.length);
    }
  };

  const handleQueueItemPress = (index: number) => {
    const cmdId = blockQueue[index];
    if (cmdId.startsWith('repeat_')) {
      const currentCount = parseInt(cmdId.replace('repeat_', '')) || 2;
      const nextCount = currentCount >= 5 ? 2 : currentCount + 1;
      const q = [...blockQueue];
      q[index] = `repeat_${nextCount}`;
      onUpdateQueue(q);
    } else {
      setSelectedIndex(index);
    }
  };

  const handleImportSubmit = () => {
    try {
      const parsed = JSON.parse(importText.trim());
      if (Array.isArray(parsed)) {
        onUpdateQueue(parsed);
        setImportModalVisible(false);
        setImportText('');
        Alert.alert('Success 🚀', 'Algorithm imported successfully!');
      } else {
        Alert.alert('Error', 'Imported data must be a valid command array.');
      }
    } catch {
      Alert.alert('Invalid JSON', 'Please paste a valid algorithm JSON string.');
    }
  };

  const exportJson = JSON.stringify(blockQueue, null, 2);

  return (
    <View>
      <RobotMascot message="Export your code to share with classmates, or import shared algorithms instantly!" expression="thinking" />

      <View style={styles.blockSection}>
        <View style={styles.sectionTopRow}>
          <Text style={styles.blockSectionTitle}>🎨 Available Command Blocks:</Text>
          <View style={styles.ioRow}>
            <TouchableOpacity style={styles.ioBtn} onPress={() => setExportModalVisible(true)}>
              <Text style={styles.ioBtnText}>📤 Export</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ioBtn} onPress={() => setImportModalVisible(true)}>
              <Text style={styles.ioBtnText}>📥 Import</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.paletteGrid}>
          {AVAILABLE_BLOCKS.map((block) => (
            <TouchableOpacity
              key={block.id}
              style={[styles.blockItem, { borderColor: block.color, backgroundColor: block.color + '15' }]}
              onPress={() => handlePalettePress(block.id)}
            >
              <SVGIcon name={block.icon} size={18} color={block.color} />
              <Text style={[styles.blockName, { color: block.color }]}>{block.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.queueHeaderRow}>
          <Text style={[styles.blockSectionTitle, { marginTop: 20 }]}>
            Active Program Queue ({blockQueue.length} steps):
          </Text>
          <Text style={styles.pointerHint}>
            {selectedIndex !== null ? `📍 Inserting after Step ${selectedIndex + 1}` : '📍 Inserting at End'}
          </Text>
        </View>

        <View style={styles.queueContainer}>
          <ScrollView style={styles.queueScrollArea} nestedScrollEnabled showsVerticalScrollIndicator={true}>
            {blockQueue.length === 0 ? (
              <Text style={styles.emptyQueue}>Queue is empty. Tap blocks above to build your program!</Text>
            ) : (
              blockQueue.map((cmdId, index) => {
                const blockInfo = AVAILABLE_BLOCKS.find((b) => b.id === cmdId || (cmdId.startsWith('repeat_') && b.id.startsWith('repeat_')));
                const isSelected = selectedIndex === index;
                const displayName = cmdId.startsWith('repeat_') ? `Repeat ${cmdId.replace('repeat_', '')}x` : (blockInfo?.name || cmdId);

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.queuedBlock,
                      { borderLeftColor: blockInfo?.color || primaryColor },
                      isSelected && { backgroundColor: '#EFF6FF', borderColor: '#3B82F6', borderWidth: 2 }
                    ]}
                    onPress={() => handleQueueItemPress(index)}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.queueIndex}>{index + 1}.</Text>
                    <Text style={styles.queueText}>
                      {displayName} {cmdId.startsWith('repeat_') ? '🔄 (Tap to edit)' : ''}
                    </Text>

                    <View style={styles.queueActions}>
                      <TouchableOpacity style={styles.reorderBtn} onPress={() => onMoveBlock(index, 'up')} disabled={index === 0}>
                        <Text style={[styles.reorderText, index === 0 && { opacity: 0.3 }]}>⬆️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.reorderBtn} onPress={() => onMoveBlock(index, 'down')} disabled={index === blockQueue.length - 1}>
                        <Text style={[styles.reorderText, index === blockQueue.length - 1 && { opacity: 0.3 }]}>⬇️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => onRemoveBlock(index)} style={{ marginLeft: 6 }}>
                        <SVGIcon name="close-circle" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        <View style={styles.queueActionRow}>
          <TouchableOpacity style={styles.clearBtn} onPress={() => { onClearQueue(); setSelectedIndex(null); }}>
            <Text style={styles.clearBtnText}>Clear All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.testRunBtn, { backgroundColor: primaryColor }]} onPress={onTestRun}>
            <Text style={styles.testRunText}>Test in Simulator 🚀</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* EXPORT MODAL */}
      <Modal visible={exportModalVisible} transparent animationType="slide" onRequestClose={() => setExportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📤 Export Algorithm Code</Text>
            <Text style={styles.modalSub}>Copy this JSON string to share your robot program with classmates:</Text>
            <View style={styles.codeOutputBox}>
              <Text style={styles.codeOutputText}>{exportJson}</Text>
            </View>
            <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: primaryColor }]} onPress={() => setExportModalVisible(false)}>
              <Text style={styles.modalActionText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* IMPORT MODAL */}
      <Modal visible={importModalVisible} transparent animationType="slide" onRequestClose={() => setImportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📥 Import Algorithm Code</Text>
            <Text style={styles.modalSub}>Paste the shared algorithm JSON string below:</Text>
            <TextInput
              style={styles.importInput}
              multiline
              placeholder='["move_forward", "turn_right", "stop"]'
              placeholderTextColor="#94A3B8"
              value={importText}
              onChangeText={setImportText}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setImportModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: primaryColor, flex: 1 }]} onPress={handleImportSubmit}>
                <Text style={styles.modalActionText}>Load Code 🚀</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  blockSection: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.small,
  },
  sectionTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  blockSectionTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  ioRow: { flexDirection: 'row', gap: 6 },
  ioBtn: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  ioBtnText: { fontSize: 11, fontWeight: '800', color: '#334155' },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  blockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 6,
  },
  blockName: { fontSize: 12, fontWeight: '800' },
  queueHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  pointerHint: { fontSize: 11, fontWeight: '800', color: '#3B82F6', backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  queueContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 6,
    maxHeight: 220,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  queueScrollArea: {
    maxHeight: 200,
  },
  emptyQueue: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 35, fontStyle: 'italic' },
  queuedBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 5,
  },
  queueIndex: { fontSize: 12, fontWeight: '800', color: '#64748B', marginRight: 8 },
  queueText: { flex: 1, fontSize: 13, fontWeight: '800', color: '#0F172A' },
  queueActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reorderBtn: { padding: 4 },
  reorderText: { fontSize: 12 },
  queueActionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, gap: 10 },
  clearBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnText: { color: '#EF4444', fontWeight: '800', fontSize: 12 },
  testRunBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  testRunText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', width: '100%', maxWidth: 400, borderRadius: 24, padding: 24, ...SHADOWS.large },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 6 },
  modalSub: { fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 18 },
  codeOutputBox: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
  codeOutputText: { fontSize: 12, color: '#334155' },
  importInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', height: 100, fontSize: 12, color: '#0F172A', textAlignVertical: 'top', marginBottom: 20 },
  modalBtnRow: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '800', color: '#64748B' },
  modalActionBtn: { paddingVertical: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modalActionText: { fontSize: 14, fontWeight: '900', color: '#fff' },
});
