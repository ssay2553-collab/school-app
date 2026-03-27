import React from 'react';
import { StyleSheet, Text, TouchableOpacity, TouchableOpacityProps, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

type ButtonProps = TouchableOpacityProps & {
  title: string;
  type?: 'default' | 'outline';
  style?: ViewStyle | ViewStyle[];
};

export default function Button({ title, type = 'default', style, ...rest }: ButtonProps) {
  const { theme } = useTheme();
  const backgroundColor = type === 'outline' ? 'transparent' : theme.tint;
  const textColor = type === 'outline' ? theme.tint : theme.background;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.btn, { backgroundColor, borderColor: theme.tint, borderWidth: type === 'outline' ? 1 : 0 }, style]}
      {...rest}
    >
      <Text style={[styles.text, { color: textColor }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  text: {
    fontWeight: '600',
    fontSize: 16,
  },
});
