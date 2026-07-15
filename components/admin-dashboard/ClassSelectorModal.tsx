import React from 'react';
import { Modal, TouchableOpacity, View, Text, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import SVGIcon from '../SVGIcon';
import { styles, VIBE } from '../../constants/admin-dashboard/ManageFeesStyles';

interface ClassSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  classes: any[];
  selectedClassId: string;
  onSelect: (classId: string) => void;
  title?: string;
  showAllOption?: boolean;
}

export const ClassSelectorModal: React.FC<ClassSelectorModalProps> = ({
  visible,
  onClose,
  classes,
  selectedClassId,
  onSelect,
  title = "Select Target Class",
  showAllOption = true,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View style={styles.sheetBody}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeRound}>
              <SVGIcon name="close" size={20} color={VIBE.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ width: '100%' }}
            contentContainerStyle={[styles.sheetList, { flexGrow: 1, paddingBottom: 40 }]}
            showsVerticalScrollIndicator={true}
            persistentScrollbar={Platform.OS === 'web'}
            bounces={false}
            nestedScrollEnabled={true}
          >
            {showAllOption && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.sheetItem,
                  selectedClassId === "all" && styles.activeSheetItem
                ]}
                onPress={() => {
                  onSelect("all");
                  onClose();
                }}
              >
                <Text style={[
                  styles.sheetItemText,
                  selectedClassId === "all" && styles.activeSheetItemText
                ]}>
                  All Classes
                </Text>
                {selectedClassId === "all" && (
                  <SVGIcon name="checkmark-circle" size={20} color={VIBE.primary} />
                )}
              </TouchableOpacity>
            )}

            {classes && classes.length > 0 ? (
              classes.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  activeOpacity={0.7}
                  style={[
                    styles.sheetItem,
                    selectedClassId === c.id && styles.activeSheetItem
                  ]}
                  onPress={() => {
                    onSelect(c.id);
                    onClose();
                  }}
                >
                  <Text style={[
                    styles.sheetItemText,
                    selectedClassId === c.id && styles.activeSheetItemText
                  ]}>
                    {c.name}
                  </Text>
                  {selectedClassId === c.id && (
                    <SVGIcon name="checkmark-circle" size={20} color={VIBE.primary} />
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: VIBE.muted }}>No classes available</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
