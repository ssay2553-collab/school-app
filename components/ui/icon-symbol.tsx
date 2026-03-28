import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

// Simple mapping from SF Symbols (iOS) to Material Icons (Android/Web)
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
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
  // `weight` (SF Symbols weight) is not used by MaterialIcons mapping — omit to avoid
  // type mismatches with other icon sets. If you need different visual weights,
  // adjust `size` or swap to a different icon component.
}) {
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={MAPPING[name]}
      style={style}
    />
  );
}
