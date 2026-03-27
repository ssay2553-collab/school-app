import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

// Simple mapping from SF Symbols (iOS) to Material Icons (Android/Web)
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
} as const;

type IconSymbolName = keyof typeof MAPPING;

/**
 * A simplified icon component that uses MaterialIcons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: 'thin' | 'light' | 'regular' | 'semibold' | 'bold' | 'heavy';
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
