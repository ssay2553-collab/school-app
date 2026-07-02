import React from 'react';
import { Modal, TouchableOpacity, View, Text, ScrollView } from 'react-native';
import * as Animatable from 'react-native-animatable';
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
    <Modal visible={visible} transparent animationType="none">
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animatable.View
          animation="slideInUp"
          duration={300}
          style={styles.sheetBody}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeRound}>
              <SVGIcon name="close" size={20} color={VIBE.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.sheetList} showsVerticalScrollIndicator={false}>
            {showAllOption && (
              <TouchableOpacity
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

            {classes.map((c) => (
              <TouchableOpacity
                key={c.id}
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
            ))}
          </ScrollView>
        </Animatable.View>
      </TouchableOpacity>
    </Modal>
  );
};
