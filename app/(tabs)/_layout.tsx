import { Tabs } from "expo-router";
import React from "react";

import { Image, StyleSheet } from "react-native";
import { HapticTab } from "../../components/haptic-tab";
import { Colors } from "../../constants/theme";
import { useColorScheme } from "../../hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Image
              source={require("../../assets/images/partial-react-logo.png")}
              style={styles.icon}
              tintColor={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color }) => (
            <Image
              source={require("../../assets/images/react-logo.png")}
              style={styles.icon}
              tintColor={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 28,
    height: 28,
    resizeMode: "contain",
  },
});
