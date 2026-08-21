import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Platform,
  useWindowDimensions,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';

import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';

import SVGIcon from '../components/SVGIcon';
import { COLORS, SHADOWS } from '../constants/theme';
import { useSchoolConfig } from '../constants/Config';
import { useToast } from '../contexts/ToastContext';

interface ResourceItem {
  id: string;
  title: string;
  description: string;
  url: string;
  icon: string;
  color: string;
  tag: string;
  image?: string;
}

const RESOURCES: ResourceItem[] = [
  {
    id: '1',
    title: 'Scratch Coding',
    description:
      'Create games, stories, animations, and interactive projects with beginner-friendly coding.',
    url: 'https://scratch.mit.edu/ideas',
    icon: 'code-slash',
    color: '#4D96FF',
    tag: 'CODING',
    image:
      'https://scratch.mit.edu/images/scratch-logo-sm-white-retina.png',
  },
  {
    id: '2',
    title: 'Robotics for Beginners',
    description:
      'Learn circuits, electronics, robotics, and engineering through practical simulations.',
    url: 'https://www.tinkercad.com/learn/circuits',
    icon: 'construct',
    color: '#FF6B6B',
    tag: 'ROBOTICS',
    image:
      'https://static.tinkercad.com/img/tinkercad-logo.png',
  },
  {
    id: '3',
    title: 'VEX Robotics',
    description:
      'Explore robotics, STEM, coding challenges, and virtual engineering labs.',
    url: 'https://education.vex.com/',
    icon: 'hardware-chip',
    color: '#6BCB77',
    tag: 'STEM',
  },
  {
    id: '4',
    title: 'Code.org Studio',
    description:
      'Master the basics of computer science with Minecraft, Star Wars, and Hour of Code.',
    url: 'https://code.org/learn',
    icon: 'apps',
    color: '#00B4D8',
    tag: 'CODING',
  },
  {
    id: '5',
    title: 'Micro:bit Projects',
    description:
      'Write code for a tiny pocket-sized computer with sensors and LED displays.',
    url: 'https://microbit.org/projects/make-it-code-it/',
    icon: 'flash',
    color: '#F97316',
    tag: 'ROBOTICS',
  },
  {
    id: '6',
    title: 'CodeCombat',
    description:
      'Learn Python and JavaScript by playing a real RPG game with heroes and levels.',
    url: 'https://codecombat.com/play',
    icon: 'game-controller',
    color: '#A855F7',
    tag: 'GAME-DEV',
  },
  {
    id: '7',
    title: 'Blockly Games',
    description:
      'A series of educational games that teach programming through a puzzle-like interface.',
    url: 'https://blockly.games/',
    icon: 'extension-puzzle',
    color: '#34A853',
    tag: 'LOGIC',
  },
  {
    id: '8',
    title: 'Khan Academy Coding',
    description:
      'Learn how to program drawings, animations, and games using JavaScript and ProcessingJS.',
    url: 'https://www.khanacademy.org/computing/computer-programming',
    icon: 'school',
    color: '#14BF96',
    tag: 'JS-CODING',
  },
];

export default function CodingRobotics() {
  const router = useRouter();
  const { showToast } = useToast();
  const config = useSchoolConfig();
  const primary = config.brandPrimary || COLORS.primary;

  const { width } = useWindowDimensions();

  const isTablet = width >= 768;

  const openResource = useCallback(
    async (url: string) => {
      try {
        const supported = await Linking.canOpenURL(url);

        if (!supported) {
          showToast({
            message: 'Cannot open this resource.',
            type: 'error',
          });
          return;
        }

        if (Platform.OS === 'web') {
          window.open(url, '_blank', 'noopener,noreferrer');
          return;
        }

        await WebBrowser.openBrowserAsync(url, {
          toolbarColor: primary,
          controlsColor: primary,
          enableBarCollapsing: true,
          showTitle: true,
        });
      } catch (error) {
        console.log(error);

        showToast({
          message: 'Failed to open resource.',
          type: 'error',
        });
      }
    },
    [primary]
  );

  const renderItem = ({ item }: { item: ResourceItem }) => (
    <ResourceCard
      item={item}
      onPress={() => openResource(item.url)}
      isTablet={isTablet}
      primary={primary}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={[primary, '#4338ca']}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <SVGIcon
              name="arrow-back"
              size={22}
              color="#fff"
            />
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text style={styles.title}>
              Coding & Robotics
            </Text>

            <Text style={styles.subtitle}>
              Build future-ready digital skills
            </Text>
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={RESOURCES}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Animatable.View
            animation="fadeInUp"
            duration={700}
          >
            <View style={styles.heroSection}>
              <Text style={styles.heroTitle}>
                Future Skills Hub 🚀
              </Text>

              <Text style={styles.heroDesc}>
                Learn coding, robotics, engineering,
                STEM, and problem-solving skills through
                fun and interactive platforms.
              </Text>
            </View>
          </Animatable.View>
        }
        renderItem={renderItem}
        ItemSeparatorComponent={() => (
          <View style={{ height: 14 }} />
        )}
        ListFooterComponent={
          <View style={styles.footerInfo}>
            <SVGIcon
              name="bulb-outline"
              size={22}
              color="#94A3B8"
            />

            <Text style={styles.footerText}>
              For the best learning experience, use a
              tablet or computer for Scratch and
              robotics simulations.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const ResourceCard = memo(
  ({
    item,
    onPress,
    isTablet,
    primary,
  }: {
    item: ResourceItem;
    onPress: () => void;
    isTablet: boolean;
    primary: string;
  }) => {
    return (
      <TouchableOpacity
        style={[
          styles.card,
          isTablet && styles.cardTablet,
        ]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: item.color + '15',
            },
          ]}
        >
          {item.image ? (
            <Image
              source={{ uri: item.image }}
              style={styles.cardImage}
              resizeMode="contain"
            />
          ) : (
            <SVGIcon
              name={item.icon}
              size={30}
              color={item.color}
            />
          )}
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text
              style={styles.cardTitle}
              numberOfLines={2}
            >
              {item.title}
            </Text>

            <View
              style={[
                styles.tag,
                {
                  backgroundColor:
                    item.color + '20',
                },
              ]}
            >
              <Text
                style={[
                  styles.tagText,
                  { color: item.color },
                ]}
              >
                {item.tag}
              </Text>
            </View>
          </View>

          <Text
            style={styles.cardDesc}
            numberOfLines={3}
          >
            {item.description}
          </Text>

          <View style={styles.visitLink}>
            <Text
              style={[
                styles.visitText,
                { color: primary },
              ]}
            >
              Start Learning
            </Text>

            <SVGIcon
              name="chevron-forward"
              size={16}
              color={primary}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  header: {
    paddingTop: Platform.OS === 'android' ? 45 : 20,
    paddingBottom: 36,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    ...SHADOWS.medium,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
  },

  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 3,
  },

  listContent: {
    padding: 18,
    paddingBottom: 50,
  },

  heroSection: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.small,
  },

  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 10,
  },

  heroDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: '#64748B',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.small,
  },

  cardTablet: {
    padding: 20,
  },

  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },

  cardImage: {
    width: 42,
    height: 42,
  },

  cardContent: {
    flex: 1,
    minWidth: 0,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },

  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },

  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  tagText: {
    fontSize: 10,
    fontWeight: '900',
  },

  cardDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 14,
  },

  visitLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  visitText: {
    fontSize: 14,
    fontWeight: '800',
    marginRight: 4,
  },

  footerInfo: {
    marginTop: 28,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },

  footerText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 12,
    lineHeight: 18,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});