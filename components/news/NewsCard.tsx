import { ResizeMode, Video } from "expo-av";
import React from "react";
import { Image, StyleSheet, Text, View, Platform } from "react-native";
import { COLORS, SHADOWS } from "../../constants/theme";
import { NewsItem } from "../../types/news";
import SVGIcon from "../SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { LinearGradient } from "expo-linear-gradient";
import moment from "moment";

interface NewsCardProps {
  item: NewsItem;
}

const AUDIENCE_THEMES = {
  all: { color: "#6366F1", label: "PUBLIC ANNOUNCEMENT", icon: "globe" },
  teacher: { color: "#10B981", label: "STAFF ONLY", icon: "people" },
  student: { color: "#F59E0B", label: "STUDENT NOTICE", icon: "school" },
  parent: { color: "#EC4899", label: "PARENT INFO", icon: "home" },
};

const NewsCard: React.FC<NewsCardProps> = ({ item }) => {
  const getJSDate = (date: any) => {
    if (!date) return new Date();
    if (typeof date.toDate === 'function') return date.toDate();
    if (date.seconds !== undefined) return new Date(date.seconds * 1000);
    return new Date(date);
  };

  const isBirthday = (item as any).isBirthday;
  const brandPrimary = SCHOOL_CONFIG.primaryColor || COLORS.primary;
  const brandSecondary = SCHOOL_CONFIG.secondaryColor || COLORS.secondary;
  
  const theme = AUDIENCE_THEMES[item.audience as keyof typeof AUDIENCE_THEMES] || AUDIENCE_THEMES.all;
  const expiryDate = getJSDate(item.expiryDate);
  const createdAtDate = getJSDate(item.createdAt);
  const isExpired = expiryDate && expiryDate < new Date();
  const timeAgo = moment(createdAtDate).fromNow();

  if (isBirthday) {
    return (
      <View style={[styles.container, styles.birthdayContainer, { borderColor: brandPrimary + '40' }]}>
        <LinearGradient
          colors={[brandPrimary, brandSecondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.birthdayHeader}
        >
          <View style={styles.birthdayHeaderContent}>
             <Text style={styles.birthdayBadgeText}>🎂 SPECIAL CELEBRATION</Text>
             <SVGIcon name="star" size={16} color="#FFD700" />
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.birthdayProfileRow}>
             {item.mediaUrl && (
               <View style={[styles.birthdayAvatarWrapper, { borderColor: brandPrimary }]}>
                 <Image source={{ uri: item.mediaUrl }} style={styles.birthdayAvatar} />
               </View>
             )}
             <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: brandPrimary }]}>{item.title}</Text>
                <Text style={styles.birthdaySubtitle}>Best wishes from {SCHOOL_CONFIG.name}</Text>
             </View>
          </View>
          
          <View style={[styles.birthdayQuoteBox, { backgroundColor: brandPrimary + '08' }]}>
            <Text style={styles.birthdayContent}>{item.content}</Text>
          </View>

          <View style={styles.footer}>
            <View style={styles.authorBox}>
               <SVGIcon name="heart" size={12} color={brandPrimary} />
               <Text style={[styles.authorText, { color: brandPrimary }]}>With love, {item.author || "The School"}</Text>
            </View>
            <Text style={styles.expiryText}>{timeAgo}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isExpired && styles.expiredContainer]}>
      {/* Header Strip */}
      <View style={[styles.headerStrip, { backgroundColor: theme.color }]}>
        <View style={styles.audienceBadge}>
          <SVGIcon name={theme.icon} size={12} color="#fff" />
          <Text style={styles.audienceText}>{theme.label}</Text>
        </View>
        <Text style={styles.dateText}>{timeAgo}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.content}>{item.content}</Text>

        {/* Media */}
        {item.mediaUrl && (
          <View style={styles.mediaContainer}>
            {item.mediaType === "image" ? (
              <Image source={{ uri: item.mediaUrl }} style={styles.media} resizeMode="cover" />
            ) : (
              <Video
                source={{ uri: item.mediaUrl }}
                style={styles.media}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
              />
            )}
          </View>
        )}

        <View style={styles.footer}>
          <View style={styles.authorBox}>
             <View style={[styles.authorDot, { backgroundColor: theme.color }]} />
             <Text style={styles.authorText}>Broadcast by {item.author || "Admin"}</Text>
          </View>
          
          {expiryDate && (
             <View style={[styles.expiryBox, isExpired && styles.expiredBox]}>
                <SVGIcon name="time" size={12} color={isExpired ? COLORS.danger : COLORS.gray} />
                <Text style={[styles.expiryText, isExpired && { color: COLORS.danger }]}>
                   {isExpired ? "EXPIRED" : `Valid until: ${expiryDate.toLocaleDateString()}`}
                </Text>
             </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    overflow: 'hidden',
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 15,
  },
  expiredContainer: { opacity: 0.75 },
  headerStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  audienceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  audienceText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  dateText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  body: {
    padding: 15,
  },
  title: { 
    fontSize: 18, 
    fontWeight: "900", 
    color: '#1E293B',
    marginBottom: 8,
  },
  content: { 
    fontSize: 14, 
    color: '#475569', 
    lineHeight: 22,
    marginBottom: 15,
  },
  mediaContainer: {
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 15,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  media: { 
    width: "100%", 
    height: 250, 
  },
  footer: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center",
    marginTop: 5,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  authorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  authorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  expiryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  expiredBox: {
    backgroundColor: '#FFF1F2',
  },
  expiryText: { 
    fontSize: 10, 
    fontWeight: '800',
    color: '#64748B',
  },
  // Birthday Styles
  birthdayContainer: {
    borderWidth: 2,
    ...SHADOWS.medium,
  },
  birthdayHeader: {
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  birthdayHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  birthdayBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  birthdayProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 15,
  },
  birthdayAvatarWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    padding: 2,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  birthdayAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  birthdaySubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  birthdayQuoteBox: {
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  birthdayContent: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
    fontStyle: 'italic',
    fontWeight: '600',
  },
});

export default NewsCard;
