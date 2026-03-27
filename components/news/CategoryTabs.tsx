import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants/theme';

interface CategoryTabsProps {
  categories: string[];
  active: string;
  onChange: (category: string) => void;
}

const CategoryTabs: React.FC<CategoryTabsProps> = ({ categories, active, onChange }) => {
  // categories already includes "All" from NewsScreen.tsx
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {categories.map(category => (
          <TouchableOpacity
            key={category}
            style={[styles.tab, active === category && styles.activeTab]}
            onPress={() => onChange(category)}
          >
            <Text style={[styles.tabText, active === category && styles.activeTabText]}>
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.gray,
    marginRight: 10,
  },
  activeTab: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.gray,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: COLORS.white,
  },
});

export default CategoryTabs;
