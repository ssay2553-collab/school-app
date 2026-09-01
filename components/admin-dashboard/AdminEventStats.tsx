import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import moment from "moment";
import SVGIcon from "../SVGIcon";

interface Event {
  id: string;
  date: any;
  title: string;
  color?: string;
}

interface AdminEventStatsProps {
  upcomingEvents: Event[];
  loading: boolean;
  onViewAll: () => void;
  onEventPress: (event: Event) => void;
  brandPrimary: string;
}

export const AdminEventStats: React.FC<AdminEventStatsProps> = ({
  upcomingEvents,
  loading,
  onViewAll,
  onEventPress,
  brandPrimary,
}) => {
  return (
    <View style={styles.statsGrid}>
      <View style={styles.headerRow}>
        <Text style={styles.statLabel}>UPCOMING EVENTS 📅</Text>
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.7}>
          <Text style={[styles.statLabel, { color: "#FFD93D" }]}>VIEW ALL</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        {loading ? (
          <View style={[styles.statCard, styles.loadingCard]}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        ) : upcomingEvents.length > 0 ? (
          upcomingEvents.map((event) => (
            <TouchableOpacity
              key={event.id}
              activeOpacity={0.7}
              onPress={() => onEventPress(event)}
              style={[styles.statCard, styles.eventCard]}
            >
              <View
                style={[
                  styles.statIconBox,
                  { backgroundColor: event.color || brandPrimary },
                ]}
              >
                <SVGIcon name="calendar" size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statLabel, { fontSize: 8 }]} numberOfLines={1}>
                  {moment(
                    event.date?.toDate ? event.date.toDate() : event.date
                  ).format("MMM D")}
                </Text>
                <Text
                  style={[styles.statValue, { fontSize: 13 }]}
                  numberOfLines={1}
                >
                  {event.title}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={[styles.statCard, styles.loadingCard]}>
            <Text style={[styles.statLabel, { textAlign: "center" }]}>
              No upcoming events
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  statsGrid: {
    marginTop: 25,
    paddingHorizontal: 5,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  statCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: 20,
  },
  loadingCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
  },
  eventCard: {
    backgroundColor: "rgba(255,255,255,0.15)",
    ...Platform.select({
      web: { cursor: 'pointer' } as any,
      default: {}
    }),
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
  },
});
