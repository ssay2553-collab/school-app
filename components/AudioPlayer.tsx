import { Audio } from "expo-av";
import React, { useRef } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { COLORS } from "../constants/theme";
import SVGIcon from "./SVGIcon";

export function AudioPlayer({ url }: { url: string }) {
  const sound = useRef<Audio.Sound | null>(null);

  const play = async () => {
    try {
      if (!sound.current) {
        const { sound: s } = await Audio.Sound.createAsync({ uri: url });
        sound.current = s;
      }
      await sound.current.replayAsync();
    } catch (e) {
      console.error("Failed to play audio", e);
    }
  };

  return (
    <TouchableOpacity onPress={play} style={styles.container}>
      <SVGIcon name="play" size={24} color={COLORS.primary} />
      <Text style={styles.text}>Play voice message</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    marginLeft: 8,
    color: COLORS.dark,
  },
});
