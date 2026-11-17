import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  StatusBar,
  Share,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SVGIcon from '../../components/SVGIcon';
import StationaryBackground from '../../components/StationaryBackground';
import { useSchoolConfig } from '../../constants/Config';
import { COLORS, SHADOWS } from '../../constants/theme';

interface DefinitionItem {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

interface MeaningItem {
  partOfSpeech: string;
  definitions: DefinitionItem[];
  synonyms?: string[];
  antonyms?: string[];
}

interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings: MeaningItem[];
  origin?: string;
}

// Robust offline fallback dictionary for common educational words
const OFFLINE_DICTIONARY: Record<string, DictionaryEntry> = {
  algorithm: {
    word: "algorithm",
    phonetic: "/ˈæl.ɡə.rɪ.ðəm/",
    meanings: [
      {
        partOfSpeech: "noun",
        definitions: [
          {
            definition: "A process or set of rules to be followed in calculations or other problem-solving operations, especially by a computer.",
            example: "The search algorithm sorts the results by relevance.",
            synonyms: ["procedure", "formula", "routine", "method"],
          }
        ]
      }
    ],
    origin: "From the name of the 9th-century Persian mathematician al-Khwarizmi."
  },
  photosynthesis: {
    word: "photosynthesis",
    phonetic: "/ˌfoʊ.toʊˈsɪn.θə.sɪs/",
    meanings: [
      {
        partOfSpeech: "noun",
        definitions: [
          {
            definition: "The process by which green plants and some other organisms use sunlight to synthesize foods from carbon dioxide and water.",
            example: "Plants use photosynthesis to convert light energy into chemical energy.",
            synonyms: ["plant nourishment", "solar conversion"],
          }
        ]
      }
    ],
    origin: "Greek photo- 'light' + synthesis 'composition'."
  },
  democracy: {
    word: "democracy",
    phonetic: "/dɪˈmɒk.rə.si/",
    meanings: [
      {
        partOfSpeech: "noun",
        definitions: [
          {
            definition: "A system of government by the whole population or all the eligible members of a state, typically through elected representatives.",
            example: "The country transitioned to a stable democracy.",
            synonyms: ["self-government", "republic", "popular sovereignty"],
            antonyms: ["autocracy", "dictatorship", "monarchy"]
          }
        ]
      }
    ]
  },
  fraction: {
    word: "fraction",
    phonetic: "/ˈfræk.ʃən/",
    meanings: [
      {
        partOfSpeech: "noun",
        definitions: [
          {
            definition: "A numerical quantity that is not a whole number (e.g., 1/2, 0.5).",
            example: "Three-quarters is written as the fraction 3/4.",
            synonyms: ["portion", "segment", "fragment", "part"],
          }
        ]
      }
    ]
  },
  ecosystem: {
    word: "ecosystem",
    phonetic: "/ˈiː.koʊˌsɪs.təm/",
    meanings: [
      {
        partOfSpeech: "noun",
        definitions: [
          {
            definition: "A biological community of interacting organisms and their physical environment.",
            example: "Coral reefs support a vibrant and diverse marine ecosystem.",
            synonyms: ["habitat", "biome", "ecological community"],
          }
        ]
      }
    ]
  },
  gravity: {
    word: "gravity",
    phonetic: "/ˈɡræv.ə.ti/",
    meanings: [
      {
        partOfSpeech: "noun",
        definitions: [
          {
            definition: "The force that attracts a body toward the center of the earth, or toward any other physical body having mass.",
            example: "Gravity keeps planets in orbit around the sun.",
            synonyms: ["gravitational force", "pull", "weightiness"],
          }
        ]
      }
    ]
  },
  hypothesis: {
    word: "hypothesis",
    phonetic: "/haɪˈpɒθ.ə.sɪs/",
    meanings: [
      {
        partOfSpeech: "noun",
        definitions: [
          {
            definition: "A supposition or proposed explanation made on the basis of limited evidence as a starting point for further investigation.",
            example: "The scientists tested their hypothesis through rigorous lab experiments.",
            synonyms: ["theory", "supposition", "premise", "assumption"],
            antonyms: ["fact", "certainty"]
          }
        ]
      }
    ]
  },
  vocabulary: {
    word: "vocabulary",
    phonetic: "/vəˈkæb.jə.ler.i/",
    meanings: [
      {
        partOfSpeech: "noun",
        definitions: [
          {
            definition: "The body of words used in a particular language or known to an individual.",
            example: "Reading books every day helps expand your vocabulary.",
            synonyms: ["lexicon", "word stock", "terminology", "glossary"],
          }
        ]
      }
    ]
  }
};

const WORD_OF_THE_DAY_LIST = [
  "algorithm",
  "photosynthesis",
  "democracy",
  "hypothesis",
  "ecosystem",
  "fraction",
  "gravity",
  "vocabulary"
];

export default function SharedDictionaryScreen() {
  const router = useRouter();
  const config = useSchoolConfig();
  const brandPrimary = config.brandPrimary || COLORS.primary || "#6366F1";
  const brandSecondary = config.brandSecondary || config.secondaryColor || "#4338ca";

  const [searchQuery, setSearchQuery] = useState("");
  const [currentWord, setCurrentWord] = useState<string>("algorithm");
  const [entryData, setEntryData] = useState<DictionaryEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"search" | "wotd" | "favorites" | "history">("search");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [speaking, setSpeaking] = useState(false);

  // Load saved favorites and history on mount
  useEffect(() => {
    loadUserData();
    fetchWordDefinition("algorithm");
  }, []);

  const loadUserData = async () => {
    try {
      const savedFavs = await AsyncStorage.getItem("@edueaz_dict_favorites");
      if (savedFavs) setFavorites(JSON.parse(savedFavs));

      const savedHist = await AsyncStorage.getItem("@edueaz_dict_history");
      if (savedHist) setHistory(JSON.parse(savedHist));
    } catch (err) {
      console.error("Error loading dictionary user data:", err);
    }
  };

  const saveFavorites = async (newFavs: string[]) => {
    try {
      setFavorites(newFavs);
      await AsyncStorage.setItem("@edueaz_dict_favorites", JSON.stringify(newFavs));
    } catch (err) {
      console.error("Error saving favorites:", err);
    }
  };

  const saveHistory = async (word: string) => {
    try {
      const cleaned = word.toLowerCase().trim();
      if (!cleaned) return;
      const filtered = [cleaned, ...history.filter(h => h !== cleaned)].slice(0, 30);
      setHistory(filtered);
      await AsyncStorage.setItem("@edueaz_dict_history", JSON.stringify(filtered));
    } catch (err) {
      console.error("Error saving history:", err);
    }
  };

  const fetchWordDefinition = async (wordToSearch: string) => {
    const cleanWord = wordToSearch.toLowerCase().trim();
    if (!cleanWord) return;

    setLoading(true);
    setErrorMessage(null);
    setCurrentWord(cleanWord);

    try {
      // Try online Free Dictionary API first
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const entry: DictionaryEntry = data[0];
          setEntryData(entry);
          setLoading(false);
          saveHistory(cleanWord);
          return;
        }
      }

      // Fallback to offline dictionary if online fails or word not found
      if (OFFLINE_DICTIONARY[cleanWord]) {
        setEntryData(OFFLINE_DICTIONARY[cleanWord]);
        setLoading(false);
        saveHistory(cleanWord);
        return;
      }

      // If not found anywhere, create a smart estimated entry or error
      setEntryData({
        word: cleanWord,
        phonetic: "/.../",
        meanings: [
          {
            partOfSpeech: "general",
            definitions: [
              {
                definition: `No direct definition found online or in offline records for "${cleanWord}". Please check spelling or try another term.`,
                example: "Check your spelling and search again.",
              }
            ]
          }
        ]
      });
      setErrorMessage(`No definition found for "${cleanWord}".`);
    } catch (err) {
      // Fallback on network error
      if (OFFLINE_DICTIONARY[cleanWord]) {
        setEntryData(OFFLINE_DICTIONARY[cleanWord]);
        setErrorMessage(null);
      } else {
        setErrorMessage("Network request failed. Showing offline fallback if available.");
        setEntryData({
          word: cleanWord,
          phonetic: "/.../",
          meanings: [
            {
              partOfSpeech: "error",
              definitions: [
                {
                  definition: "Unable to reach dictionary server. Please check your internet connection.",
                }
              ]
            }
          ]
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = () => {
    if (!searchQuery.trim()) return;
    fetchWordDefinition(searchQuery);
    setSearchQuery("");
  };

  const handleSpeak = async (textToSpeak: string) => {
    try {
      setSpeaking(true);
      await Speech.stop();
      Speech.speak(textToSpeak, {
        language: 'en',
        rate: 0.9,
        onDone: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    } catch (err) {
      setSpeaking(false);
    }
  };

  const toggleFavorite = (word: string) => {
    const clean = word.toLowerCase();
    if (favorites.includes(clean)) {
      saveFavorites(favorites.filter(f => f !== clean));
    } else {
      saveFavorites([...favorites, clean]);
    }
  };

  const isFavorite = entryData ? favorites.includes(entryData.word.toLowerCase()) : false;

  const handleShare = async () => {
    if (!entryData) return;
    try {
      const defText = entryData.meanings[0]?.definitions[0]?.definition || '';
      await Share.share({
        message: `Word: ${entryData.word}\nPhonetic: ${entryData.phonetic || ''}\nDefinition: ${defText}\n- Shared via EduEaz Dictionary Hub`,
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Get Word of the Day based on current date
  const getWordOfTheDay = () => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const wordKey = WORD_OF_THE_DAY_LIST[dayOfYear % WORD_OF_THE_DAY_LIST.length];
    return OFFLINE_DICTIONARY[wordKey] || OFFLINE_DICTIONARY["algorithm"];
  };

  const wotd = getWordOfTheDay();

  return (
    <View style={styles.container}>
      <StationaryBackground />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: brandPrimary }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <SVGIcon name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Dictionary & Vocabulary</Text>
            <Text style={styles.headerSubtitle}>Explore definitions, synonyms & pronunciation</Text>
          </View>
          <TouchableOpacity onPress={() => fetchWordDefinition(wotd.word)} style={styles.wotdHeaderBtn}>
            <SVGIcon name="sunny" size={20} color="#FFD700" />
          </TouchableOpacity>
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchBarContainer}>
          <SVGIcon name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search any word (e.g., photosynthesis)..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
              <SVGIcon name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSearchSubmit} style={[styles.searchBtn, { backgroundColor: brandSecondary }]}>
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* NAVIGATION TABS */}
      <View style={styles.tabContainer}>
        {[
          { id: 'search', label: 'Definition', icon: 'book' },
          { id: 'wotd', label: 'Word of Day', icon: 'sunny' },
          { id: 'favorites', label: `Saved (${favorites.length})`, icon: 'heart' },
          { id: 'history', label: 'History', icon: 'time' },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isActive && { borderBottomColor: brandPrimary, borderBottomWidth: 3 }]}
              onPress={() => setActiveTab(tab.id as any)}
            >
              <SVGIcon name={tab.icon as any} size={16} color={isActive ? brandPrimary : '#64748B'} />
              <Text style={[styles.tabText, isActive && { color: brandPrimary, fontWeight: '800' }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* TAB 1: SEARCH / DEFINITION VIEW */}
        {activeTab === 'search' && (
          <View>
            {loading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={brandPrimary} />
                <Text style={styles.loadingText}>Looking up definition...</Text>
              </View>
            ) : entryData ? (
              <View style={[styles.card, SHADOWS.medium]}>
                {/* WORD HEADER */}
                <View style={styles.wordHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wordTitle}>{entryData.word}</Text>
                    {entryData.phonetic && (
                      <Text style={styles.phoneticText}>{entryData.phonetic}</Text>
                    )}
                  </View>

                  <div style={{ display: 'flex', gap: 8 }} className="flex-row gap-2">
                    <TouchableOpacity
                      style={[styles.iconActionBtn, { backgroundColor: brandPrimary + '15' }]}
                      onPress={() => handleSpeak(entryData.word)}
                    >
                      <SVGIcon name="volume-high" size={22} color={brandPrimary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.iconActionBtn, { backgroundColor: isFavorite ? '#FEE2E2' : '#F1F5F9' }]}
                      onPress={() => toggleFavorite(entryData.word)}
                    >
                      <SVGIcon name={isFavorite ? "heart" : "heart-outline"} size={22} color={isFavorite ? "#EF4444" : "#64748B"} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.iconActionBtn, { backgroundColor: '#F1F5F9' }]}
                      onPress={handleShare}
                    >
                      <SVGIcon name="share-social" size={20} color="#64748B" />
                    </TouchableOpacity>
                  </div>
                </View>

                {errorMessage && (
                  <View style={styles.warningBanner}>
                    <SVGIcon name="alert-circle" size={16} color="#D97706" />
                    <Text style={styles.warningText}>{errorMessage}</Text>
                  </View>
                )}

                {/* MEANINGS */}
                {entryData.meanings.map((meaning, mIndex) => (
                  <View key={mIndex} style={styles.meaningSection}>
                    <View style={styles.partOfSpeechBadge}>
                      <Text style={styles.partOfSpeechText}>{meaning.partOfSpeech}</Text>
                    </View>

                    {meaning.definitions.map((def, dIndex) => (
                      <View key={dIndex} style={styles.definitionBox}>
                        <Text style={styles.definitionNumber}>{dIndex + 1}.</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.definitionText}>{def.definition}</Text>
                          {def.example && (
                            <Text style={styles.exampleText}>"{def.example}"</Text>
                          )}
                        </View>
                      </View>
                    ))}

                    {/* SYNONYMS */}
                    {meaning.synonyms && meaning.synonyms.length > 0 && (
                      <View style={styles.synonymsContainer}>
                        <Text style={styles.synonymsLabel}>Synonyms:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                          {meaning.synonyms.map((syn, sIdx) => (
                            <TouchableOpacity
                              key={sIdx}
                              style={styles.synonymChip}
                              onPress={() => fetchWordDefinition(syn)}
                            >
                              <Text style={styles.synonymChipText}>{syn}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                ))}

                {entryData.origin && (
                  <View style={styles.originBox}>
                    <Text style={styles.originTitle}>Origin & Etymology</Text>
                    <Text style={styles.originText}>{entryData.origin}</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.centerBox}>
                <SVGIcon name="search-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>Search for any word above</Text>
                <Text style={styles.emptySubtitle}>Explore meanings, phonetics, and speech audio instantly.</Text>
              </View>
            )}
          </View>
        )}

        {/* TAB 2: WORD OF THE DAY */}
        {activeTab === 'wotd' && (
          <View style={[styles.card, SHADOWS.medium]}>
            <View style={styles.wotdBadgeBanner}>
              <SVGIcon name="sunny" size={18} color="#D97706" />
              <Text style={styles.wotdBannerTitle}>WORD OF THE DAY 🌟</Text>
            </View>

            <View style={styles.wordHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.wordTitle}>{wotd.word}</Text>
                {wotd.phonetic && <Text style={styles.phoneticText}>{wotd.phonetic}</Text>}
              </View>
              <TouchableOpacity
                style={[styles.iconActionBtn, { backgroundColor: brandPrimary + '15' }]}
                onPress={() => handleSpeak(wotd.word)}
              >
                <SVGIcon name="volume-high" size={22} color={brandPrimary} />
              </TouchableOpacity>
            </View>

            {wotd.meanings.map((meaning, mIndex) => (
              <View key={mIndex} style={styles.meaningSection}>
                <View style={styles.partOfSpeechBadge}>
                  <Text style={styles.partOfSpeechText}>{meaning.partOfSpeech}</Text>
                </View>
                {meaning.definitions.map((def, dIndex) => (
                  <View key={dIndex} style={styles.definitionBox}>
                    <Text style={styles.definitionNumber}>{dIndex + 1}.</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.definitionText}>{def.definition}</Text>
                      {def.example && <Text style={styles.exampleText}>"{def.example}"</Text>}
                    </View>
                  </View>
                ))}
              </View>
            ))}

            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: brandPrimary }]}
              onPress={() => {
                fetchWordDefinition(wotd.word);
                setActiveTab('search');
              }}
            >
              <Text style={styles.primaryActionText}>View Full Details</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* TAB 3: FAVORITES */}
        {activeTab === 'favorites' && (
          <View style={[styles.card, SHADOWS.medium]}>
            <Text style={styles.sectionHeading}>Saved Vocabulary ({favorites.length})</Text>
            {favorites.length === 0 ? (
              <View style={styles.centerBox}>
                <SVGIcon name="heart-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No saved words yet</Text>
                <Text style={styles.emptySubtitle}>Tap the heart icon on any word to save it here for study.</Text>
              </View>
            ) : (
              <View style={styles.listContainer}>
                {favorites.map((favWord, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.listItem}
                    onPress={() => {
                      fetchWordDefinition(favWord);
                      setActiveTab('search');
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[styles.listIconBox, { backgroundColor: brandPrimary + '15' }]}>
                        <SVGIcon name="bookmark" size={16} color={brandPrimary} />
                      </View>
                      <Text style={styles.listItemText}>{favWord}</Text>
                    </View>
                    <TouchableOpacity onPress={() => toggleFavorite(favWord)} style={{ padding: 6 }}>
                      <SVGIcon name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* TAB 4: HISTORY */}
        {activeTab === 'history' && (
          <View style={[styles.card, SHADOWS.medium]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.sectionHeading}>Recent Searches ({history.length})</Text>
              {history.length > 0 && (
                <TouchableOpacity onPress={async () => {
                  setHistory([]);
                  await AsyncStorage.removeItem("@edueaz_dict_history");
                }}>
                  <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 13 }}>Clear History</Text>
                </TouchableOpacity>
              )}
            </View>

            {history.length === 0 ? (
              <View style={styles.centerBox}>
                <SVGIcon name="time-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No search history</Text>
                <Text style={styles.emptySubtitle}>Words you search will appear here for quick recall.</Text>
              </View>
            ) : (
              <View style={styles.listContainer}>
                {history.map((histWord, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.listItem}
                    onPress={() => {
                      fetchWordDefinition(histWord);
                      setActiveTab('search');
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[styles.listIconBox, { backgroundColor: '#F1F5F9' }]}>
                        <SVGIcon name="search" size={16} color="#64748B" />
                      </View>
                      <Text style={styles.listItemText}>{histWord}</Text>
                    </View>
                    <SVGIcon name="chevron-forward" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 36,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  wotdHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    ...SHADOWS.small,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  searchBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 6,
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  wordHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 16,
  },
  wordTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    textTransform: 'capitalize',
  },
  phoneticText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
  },
  iconActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    gap: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600',
    flex: 1,
  },
  meaningSection: {
    marginBottom: 16,
  },
  partOfSpeechBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  partOfSpeechText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
    fontStyle: 'italic',
  },
  definitionBox: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  definitionNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
    width: 20,
  },
  definitionText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    fontWeight: '500',
  },
  exampleText: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 2,
  },
  synonymsContainer: {
    marginTop: 8,
    marginLeft: 28,
  },
  synonymsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  synonymChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  synonymChipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  originBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  originTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  originText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  wotdBadgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
    gap: 6,
  },
  wotdBannerTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#B45309',
  },
  primaryActionBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 14,
  },
  listContainer: {
    gap: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  listIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    textTransform: 'capitalize',
  },
});
