import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Circle, Path } from 'react-native-svg';

interface RobotCharacterProps {
  direction: 'N' | 'E' | 'S' | 'W';
  size?: number;
}

export function RobotCharacter({ direction, size = 32 }: RobotCharacterProps) {
  const getRotation = () => {
    switch (direction) {
      case 'N': return '0deg';
      case 'E': return '90deg';
      case 'S': return '180deg';
      case 'W': return '270deg';
      default: return '0deg';
    }
  };

  return (
    <View style={[styles.container, { width: size + 8, height: size + 8 }]}>
      <View style={[styles.robotWrapper, { transform: [{ rotate: getRotation() }] }]}>
        <Svg width={size} height={size} viewBox="0 0 36 36">
          {/* Antenna */}
          <Path d="M18 4V8" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" />
          <Circle cx="18" cy="3" r="2.5" fill="#10B981" />

          {/* Robot Head */}
          <Rect x="8" y="8" width="20" height="14" rx="4" fill="#4F46E5" stroke="#312E81" strokeWidth="1.5" />

          {/* Glowing Visor / Eyes */}
          <Rect x="11" y="11" width="14" height="6" rx="2" fill="#38BDF8" />
          <Circle cx="15" cy="14" r="1.5" fill="#FFF" />
          <Circle cx="21" cy="14" r="1.5" fill="#FFF" />

          {/* Body Chassis */}
          <Rect x="10" y="22" width="16" height="10" rx="3" fill="#1E1B4B" stroke="#4338CA" strokeWidth="1.5" />

          {/* Chest LED core */}
          <Circle cx="18" cy="27" r="2.5" fill="#F59E0B" />

          {/* Treads / Wheels */}
          <Rect x="6" y="24" width="3" height="7" rx="1.5" fill="#64748B" />
          <Rect x="27" y="24" width="3" height="7" rx="1.5" fill="#64748B" />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  robotWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
