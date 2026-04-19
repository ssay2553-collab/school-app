import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import SVGIcon from '../SVGIcon';
import { COLORS, SIZES } from '../../constants/theme';

interface SearchBarProps {
  value: string;
  onChange: (text: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => {
  return (
    <View style={styles.container}>
      <SVGIcon name="search" size={20} color={COLORS.gray} style={styles.icon} />
      <TextInput
        style={styles.input}
        placeholder="Search news..."
        placeholderTextColor={COLORS.gray}
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    color: COLORS.black,
  },
});

export default SearchBar;
