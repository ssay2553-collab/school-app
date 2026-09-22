import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
} from 'react-native';
import SVGIcon from '../SVGIcon';
import { COLORS, SHADOWS } from '../../constants/theme';
import { GES_CURRICULUM_DATA, GESIndicator } from '../../constants/GES_Curriculum';
import * as Animatable from 'react-native-animatable';

interface CurriculumBrowserModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (indicator: GESIndicator) => void;
  initialSubject?: string;
  initialClass?: string;
}

export const CurriculumBrowserModal = ({
  visible,
  onClose,
  onSelect,
  initialSubject,
  initialClass
}: CurriculumBrowserModalProps) => {
  const [selectedSubject, setSelectedSubject] = useState(initialSubject || "");
  const [selectedClass, setSelectedClass] = useState(initialClass || "");
  const [searchQuery, setSearchQuery] = useState("");

  const subjects = Object.keys(GES_CURRICULUM_DATA);

  const classes = useMemo(() => {
    if (!selectedSubject) return [];
    return Object.keys(GES_CURRICULUM_DATA[selectedSubject] || {});
  }, [selectedSubject]);

  const indicators = useMemo(() => {
    if (!selectedSubject || !selectedClass) return [];
    let list = GES_CURRICULUM_DATA[selectedSubject]?.[selectedClass] || [];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i =>
        i.code.toLowerCase().includes(q) ||
        i.indicator.toLowerCase().includes(q) ||
        i.strand.toLowerCase().includes(q)
      );
    }
    return list;
  }, [selectedSubject, selectedClass, searchQuery]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Curriculum Browser</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <SVGIcon name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <SVGIcon name="search" size={20} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by code or keyword..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView style={styles.content}>
            <Text style={styles.sectionTitle}>1. Subject</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {subjects.map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => {
                    setSelectedSubject(s);
                    setSelectedClass("");
                  }}
                  style={[styles.chip, selectedSubject === s && styles.chipActive]}
                >
                  <Text style={[styles.chipText, selectedSubject === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {selectedSubject ? (
              <Animatable.View animation="fadeIn" duration={300}>
                <Text style={styles.sectionTitle}>2. Class Level</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {classes.map(c => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setSelectedClass(c)}
                      style={[styles.chip, selectedClass === c && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, selectedClass === c && styles.chipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Animatable.View>
            ) : null}

            <Text style={styles.sectionTitle}>3. Indicators</Text>
            {!selectedSubject || !selectedClass ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Select a Subject and Class to view indicators</Text>
              </View>
            ) : indicators.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No indicators found matching your search</Text>
              </View>
            ) : (
              indicators.map((item, index) => (
                <Animatable.View
                  key={item.code}
                  animation="fadeInUp"
                  delay={index * 50}
                  duration={400}
                >
                  <TouchableOpacity
                    style={styles.indicatorCard}
                    onPress={() => {
                      onSelect(item);
                      onClose();
                    }}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeText}>{item.code}</Text>
                      </View>
                      <Text style={styles.strandText}>{item.strand}</Text>
                    </View>
                    <Text style={styles.indicatorTitle}>{item.indicator}</Text>
                    <Text style={styles.objectivesText} numberOfLines={2}>{item.objectives}</Text>
                  </TouchableOpacity>
                </Animatable.View>
              ))
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: {
    height: '90%',
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  title: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  closeBtn: { padding: 5 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 20,
    paddingHorizontal: 15,
    borderRadius: 15,
    height: 50,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#1E293B' },
  content: { flex: 1, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#64748B', marginBottom: 12, marginTop: 10, textTransform: 'uppercase' },
  chipScroll: { marginBottom: 20 },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.small
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '800', color: '#64748B' },
  chipTextActive: { color: '#fff' },
  indicatorCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...SHADOWS.medium
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  codeBadge: { backgroundColor: COLORS.primary + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  codeText: { fontSize: 10, fontWeight: '900', color: COLORS.primary },
  strandText: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase' },
  indicatorTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  objectivesText: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 14, fontWeight: '600' }
});
