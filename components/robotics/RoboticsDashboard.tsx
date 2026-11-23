import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import SVGIcon from '../SVGIcon';
import { SHADOWS } from '../../constants/theme';

interface RoboticsDashboardProps {
  activeTab: string;
  onChangeTab: (tab: string) => void;
  primaryColor: string;
  children: React.ReactNode;
}

const TABS = [
  { id: 'learn', label: 'Lessons', icon: 'book' },
  { id: 'simulator', label: 'Simulator', icon: 'game-controller' },
  { id: 'blocks', label: 'Blocks', icon: 'code-slash' },
  { id: 'challenges', label: 'Challenges', icon: 'trophy' },
  { id: 'achievements', label: 'Badges', icon: 'ribbon' },
  { id: 'teacher', label: 'Teacher', icon: 'people' },
];

const isColorLight = (color: string) => {
  if (!color) return false;
  const hex = color.replace('#', '');
  if (hex.length !== 6) return false;
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 160;
};

export function RoboticsDashboard({ activeTab, onChangeTab, primaryColor, children }: RoboticsDashboardProps) {
  // Use vibrant indigo if primaryColor is light or undefined to ensure high contrast
  const effectiveActiveColor = isColorLight(primaryColor) ? '#4F46E5' : (primaryColor || '#4F46E5');

  return (
    <View style={styles.container}>
      {/* SOLID HIGH-VISIBILITY TAB BAR */}
      <View style={styles.tabBarOuterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScrollView}
          contentContainerStyle={styles.tabContainer}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const bg = isActive ? effectiveActiveColor : '#F1F5F9';
            const textCol = isActive ? '#FFFFFF' : '#1E293B';
            const iconCol = isActive ? '#FFFFFF' : '#475569';
            const borderCol = isActive ? effectiveActiveColor : '#CBD5E1';

            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tabBtn,
                  { backgroundColor: bg, borderColor: borderCol },
                  isActive && styles.activeTabShadow,
                ]}
                onPress={() => onChangeTab(tab.id)}
                activeOpacity={0.8}
              >
                <SVGIcon name={tab.icon} size={15} color={iconCol} />
                <Text style={[styles.tabText, { color: textCol, fontWeight: isActive ? '900' : '700' }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* CONTENT */}
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  tabBarOuterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1.5,
    borderBottomColor: '#CBD5E1',
    width: '100%',
    zIndex: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabScrollView: {
    width: '100%',
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 6,
    height: 40,
    justifyContent: 'center',
  },
  activeTabShadow: {
    ...SHADOWS.small,
  },
  tabText: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  contentContainer: { padding: 16, paddingBottom: 60 },
});
