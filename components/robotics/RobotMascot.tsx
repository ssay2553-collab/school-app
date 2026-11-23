import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Animatable from 'react-native-animatable';
import { SHADOWS } from '../../constants/theme';

interface RobotMascotProps {
  message?: string;
  expression?: 'happy' | 'thinking' | 'excited' | 'success';
}

export function RobotMascot({ message = "Hi! I'm EduBot, your robotics co-pilot! Let's build & code together!", expression = 'happy' }: RobotMascotProps) {
  const getAvatar = () => {
    switch (expression) {
      case 'thinking': return '🤖💭';
      case 'excited': return '🤖🚀';
      case 'success': return '🤖🎉';
      default: return '🤖✨';
    }
  };

  return (
    <Animatable.View animation="bounceIn" duration={800} style={styles.container}>
      <View style={styles.avatarBox}>
        <Text style={styles.avatarEmoji}>{getAvatar()}</Text>
      </View>
      <View style={styles.speechBubble}>
        <Text style={styles.mascotName}>EduBot 💡</Text>
        <Text style={styles.messageText}>{message}</Text>
      </View>
    </Animatable.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    ...SHADOWS.small,
  },
  avatarBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    ...SHADOWS.small,
  },
  avatarEmoji: { fontSize: 26 },
  speechBubble: { flex: 1 },
  mascotName: { fontSize: 11, fontWeight: '900', color: '#4338CA', textTransform: 'uppercase', marginBottom: 2 },
  messageText: { fontSize: 13, fontWeight: '700', color: '#1E1B4B', lineHeight: 18 },
});
