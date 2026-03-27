// /screens/student/NewsScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View, Text, SafeAreaView, StatusBar, TouchableOpacity } from "react-native";
import CategoryTabs from "../../components/news/CategoryTabs";
import NewsCard from "../../components/news/NewsCard";
import SearchBar from "../../components/news/SearchBar";
import { COLORS, SHADOWS } from "../../constants/theme";
import { fetchCategories, fetchNewsForAudience } from "../../lib/newsFetcher";
import { NewsItem } from "../../types/news";
import SVGIcon from "../../components/SVGIcon";
import { useRouter } from "expo-router";

export default function StudentNewsScreen({ className }: { className?: string }) {
  const router = useRouter();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  // Fetch news and categories
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [items, cats] = await Promise.all([
          fetchNewsForAudience("student"),
          fetchCategories().catch(() => []),
        ]);

        const filteredByClass = className
          ? items.filter((n) => n.category === className || n.category === "All")
          : items;

        setNews(filteredByClass);
        
        const categoryNames = cats?.map((c: any) => c.name).filter(Boolean) || [];
        const uniqueCategories = Array.from(new Set(["All", ...categoryNames]));
        setCategories(uniqueCategories);
      } catch (err) {
        console.error("Error fetching student news:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [className]);

  const filtered = useMemo(() => {
    let result = category === "All" ? news : news.filter((n) => n.category === category);
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(lower) ||
          n.content.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [news, category, search]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Global News 📢</Text>
          <Text style={styles.headerSubtitle}>Latest updates from your school</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.filterSection}>
           <CategoryTabs active={category} onChange={setCategory} categories={categories} />
        </View>
        
        <View style={styles.searchSection}>
           <SearchBar value={search} onChange={setSearch} />
        </View>

        <View style={styles.listHeader}>
           <Text style={styles.listTitle}>Top Stories ✨</Text>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <NewsCard item={item} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFDFD" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 15, ...SHADOWS.small },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#0F172A" },
  headerSubtitle: { fontSize: 14, color: "#64748B", fontWeight: '600', marginTop: 2 },
  content: { flex: 1, paddingHorizontal: 20 },
  filterSection: { marginTop: 15, marginBottom: 15 },
  searchSection: { marginBottom: 20 },
  listHeader: { marginBottom: 15 },
  listTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
});
