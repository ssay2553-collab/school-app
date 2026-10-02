import React, { useState, memo } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { COLORS } from "../../../../constants/theme";

interface SpecialCharToolbarProps {
  onInsertChar: (char: string) => void;
  targetName?: string;
}

type TabType = "brackets" | "ghanaian" | "french" | "format";

const BRACKETS = [
  "( )", "[ ]", "{ }", "“ ”", "« »", "(", ")", "[", "]", "{", "}", "“", "”", "< >", "—"
];

const GHANAIAN_CHARS = [
  "ɛ", "ɔ", "ŋ", "ƒ", "ʋ", "Ɛ", "Ɔ", "Ŋ", "Ƒ", "Ʋ",
  "ɛ́", "ɛ̀", "ɔ́", "ɔ̀", "ã", "ẽ", "ĩ", "õ", "ũ",
  "á", "à", "é", "è", "í", "ì", "ó", "ò", "ú", "ù",
  "\u0301", "\u0300", "\u0303"
];

const FRENCH_CHARS = [
  "é", "è", "ê", "ë", "à", "â", "ç", "î", "ï", "ô", "ù", "û", "ü", "œ", "æ",
  "É", "È", "Ê", "À", "Â", "Ç", "Î", "Ô", "Ù", "Œ", "Æ"
];

const FORMAT_ITEMS = [
  { label: "<b>Bold</b>", value: "<b>bold</b>" },
  { label: "<u>Underline</u>", value: "<u>underlined</u>" },
];

export const SpecialCharToolbar = memo(({ onInsertChar, targetName }: SpecialCharToolbarProps) => {
  const [activeTab, setActiveTab] = useState<TabType>("ghanaian");

  const renderCharButtons = () => {
    let items: { label: string; value: string }[] = [];

    if (activeTab === "brackets") {
      items = BRACKETS.map((b) => ({ label: b, value: b }));
    } else if (activeTab === "ghanaian") {
      items = GHANAIAN_CHARS.map((c) => {
        if (c === "\u0301") return { label: "◌́ High", value: c };
        if (c === "\u0300") return { label: "◌̀ Low", value: c };
        if (c === "\u0303") return { label: "◌̃ Nasal", value: c };
        return { label: c, value: c };
      });
    } else if (activeTab === "french") {
      items = FRENCH_CHARS.map((c) => ({ label: c, value: c }));
    } else if (activeTab === "format") {
      items = FORMAT_ITEMS;
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {items.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.charChip,
              activeTab === "format" && styles.formatChip,
            ]}
            onPress={() => onInsertChar(item.value)}
          >
            <Text
              style={[
                styles.charChipText,
                item.label.includes("Bold") && { fontWeight: "bold" as const },
                item.label.includes("Underline") && { textDecorationLine: "underline" as const },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.hintText}>
          Insert into {targetName || "active field"}:
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "ghanaian" && styles.tabBtnActive]}
            onPress={() => setActiveTab("ghanaian")}
          >
            <Text style={[styles.tabText, activeTab === "ghanaian" && styles.tabTextActive]}>🇬🇭 Ghanaian (ɛ/ɔ/ŋ)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "french" && styles.tabBtnActive]}
            onPress={() => setActiveTab("french")}
          >
            <Text style={[styles.tabText, activeTab === "french" && styles.tabTextActive]}>🇫🇷 French Accents</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "brackets" && styles.tabBtnActive]}
            onPress={() => setActiveTab("brackets")}
          >
            <Text style={[styles.tabText, activeTab === "brackets" && styles.tabTextActive]}>( ) Brackets</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "format" && styles.tabBtnActive]}
            onPress={() => setActiveTab("format")}
          >
            <Text style={[styles.tabText, activeTab === "format" && styles.tabTextActive]}>Formatting</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {renderCharButtons()}
    </View>
  );
});

export default SpecialCharToolbar;

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 8,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  topRow: {
    flexDirection: "column",
    gap: 4,
    marginBottom: 6,
  },
  hintText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  tabRow: {
    flexDirection: "row",
    gap: 6,
  },
  tabBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#E2E8F0",
  },
  tabBtnActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  chipRow: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 2,
  },
  charChip: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  formatChip: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
  },
  charChipText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
  },
});
