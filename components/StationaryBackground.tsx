import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import SVGIcon from './SVGIcon';

const ACADEMIC_ICONS = [
  'school',
  'book',
  'pencil',
  'calculator',
  'flask',
  'microscope',
  'atom',
  'globe',
  'ruler',
  'trophy',
  'certificate',
  'compass-math',
  'bulb-outline',
  'color-palette',
  'library',
  'sqrt',
  'code-slash',
  'blackboard',
  'brain',
  'dna',
  'backpack',
  'telescope',
  'journal',
  'time-outline',
  'attach',
  'document-text',
  'sparkles',
  'bus',
  'glasses',
  'abacus',
  'ribbon',
  'hardware-chip',
];

const ROTATIONS = [-25, 12, -15, 28, -8, 20, -30, 15, -18, 24, -5, 22];
const SIZES = [22, 26, 24, 28, 23, 27];

interface StationaryBackgroundProps {
  color?: string;
  cellSpacing?: number;
}

const StationaryBackground: React.FC<StationaryBackgroundProps> = ({
  color = 'rgba(15, 23, 42, 0.055)',
  cellSpacing = 68,
}) => {
  const { width, height } = useWindowDimensions();

  const gridItems = useMemo(() => {
    const cols = Math.ceil(width / cellSpacing) + 1;
    const rows = Math.ceil(height / cellSpacing) + 2;
    const items = [];

    for (let r = 0; r < rows; r++) {
      const isOddRow = r % 2 === 1;
      const xOffset = isOddRow ? cellSpacing / 2 : 0;

      for (let c = 0; c < cols; c++) {
        const index = r * cols + c;
        const iconName = ACADEMIC_ICONS[index % ACADEMIC_ICONS.length];
        const rotation = ROTATIONS[(r * 3 + c * 7) % ROTATIONS.length];
        const size = SIZES[(r * 5 + c * 3) % SIZES.length];

        const left = c * cellSpacing + xOffset - 15;
        const top = r * cellSpacing - 10;

        items.push({
          key: `academic-bg-${r}-${c}`,
          name: iconName,
          top,
          left,
          size,
          rotation,
        });
      }
    }

    return items;
  }, [width, height, cellSpacing]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {gridItems.map((item) => (
        <View
          key={item.key}
          style={[
            styles.iconWrapper,
            {
              top: item.top,
              left: item.left,
              transform: [{ rotate: `${item.rotation}deg` }],
            },
          ]}
        >
          <SVGIcon name={item.name} size={item.size} color={color} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  iconWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(StationaryBackground);
