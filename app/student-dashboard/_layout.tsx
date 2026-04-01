import { Tabs } from "expo-router";
import React from "react";
import { Platform, View, StyleSheet } from "react-native";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";

export default function StudentLayout() {
  const primary = SCHOOL_CONFIG.primaryColor || "#6366F1";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: primary,
        tabBarInactiveTintColor: "#94A3B8",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0,
          elevation: 10,
          height: Platform.OS === 'ios' ? 88 : 65,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: 10,
          ...SHADOWS.medium,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: primary + '10' }]}>
               <SVGIcon name={focused ? "home" : "home-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="personal-timetable"
        options={{
          title: "My Plan",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: primary + '10' }]}>
               <SVGIcon name={focused ? "calendar" : "calendar-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="daily-attendance"
        options={{
          title: "Attendance",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: primary + '10' }]}>
               <SVGIcon name={focused ? "checkmark-circle" : "checkmark-circle-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="assignment-scores"
        options={{
          title: "Stars",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: primary + '10' }]}>
               <SVGIcon name={focused ? "star" : "star-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: primary + '10' }]}>
               <SVGIcon name={focused ? "settings" : "settings-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      
      {/* Utility screens that should not appear in the tab bar */}
      <Tabs.Screen name="note" options={{ href: null }} />
      <Tabs.Screen name="games" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="upgrade" options={{ href: null }} />
      <Tabs.Screen name="NewsScreen" options={{ href: null }} />
      <Tabs.Screen name="assignments" options={{ href: null }} />
      <Tabs.Screen name="create-note" options={{ href: null }} />
      <Tabs.Screen name="StudentGroups" options={{ href: null }} />
      <Tabs.Screen name="StudentTimetable" options={{ href: null }} />
      <Tabs.Screen name="submit-assignment" options={{ href: null }} />
      <Tabs.Screen name="logout" options={{ href: null }} />
      <Tabs.Screen name="GroupChat" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    padding: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 34
  }
});
