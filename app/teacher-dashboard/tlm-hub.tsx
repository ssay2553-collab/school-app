import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";
import { useTLMHub, TLM } from "../../hooks/teacher-dashboard/useTLMHub";
import { useRef, useEffect } from "react";
import { useRouter } from "expo-router";

export default function TLMHub() {
  const primary = SCHOOL_CONFIG.primaryColor;

  const {
    activeTab,
    setActiveTab,
    subject,
    setSubject,
    topic,
    setTopic,
    discoveryResults,
    savedTlms,
    loading,
    savingIds,
    showAddModal,
    setShowAddModal,
    uploading,
    uploadProgress,
    aiTip,
    newTlm,
    setNewTlm,
    handleAddCustomTlm,
    debouncedSearch,
    openUrl,
    handleSaveTlm,
    handlePickFile,
  } = useTLMHub();
  const router = useRouter();
  const isMounted = useRef(true);
  const isNavigating = useRef(false);

  const getTypeColor = (type: TLM["type"]) => {
    switch (type) {
      case "video":
        return "#EF4444";
      case "image":
        return "#10B981";
      case "pdf":
        return "#3B82F6";
      default:
        return "#8B5CF6";
    }
  };

  const renderTlmItem = ({ item }: { item: TLM }) => {
    const saving = savingIds.includes(item.id);

    return (
      <Animatable.View animation="fadeInUp" style={styles.tlmCard}>
        <Image
          source={{
            uri: item.thumbnail || "https://via.placeholder.com/150",
          }}
          style={styles.tlmThumbnail}
        />

        <View style={styles.tlmInfo}>
          <View style={styles.tlmHeader}>
            <Text style={styles.tlmTitle} numberOfLines={2}>
              {item.title}
            </Text>

            <View
              style={[
                styles.typeBadge,
                {
                  backgroundColor: getTypeColor(item.type) + "20",
                },
              ]}
            >
              <Text
                style={[
                  styles.typeText,
                  {
                    color: getTypeColor(item.type),
                  },
                ]}
              >
                {item.type.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.tlmMeta}>
            {item.subject} • {item.topic}
          </Text>

          <View style={styles.tlmActions}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  borderColor: primary,
                },
              ]}
              onPress={() => openUrl(item.url, item.title)}
            >
              <SVGIcon name="play-circle-outline" size={16} color={primary} />

              <Text
                style={[
                  styles.actionText,
                  {
                    color: primary,
                  },
                ]}
              >
                View
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={saving}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: item.isSaved ? "#EF4444" : primary,
                  borderColor: item.isSaved ? "#EF4444" : primary,
                },
              ]}
              onPress={() => handleSaveTlm(item)}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <SVGIcon
                    name={item.isSaved ? "trash-outline" : "bookmark-outline"}
                    size={16}
                    color="#FFF"
                  />

                  <Text
                    style={[
                      styles.actionText,
                      {
                        color: "#FFF",
                      },
                    ]}
                  >
                    {item.isSaved ? "Remove" : "Save"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Animatable.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            onPress={() => {
              if (isNavigating.current) return;
              isNavigating.current = true;
              router.back();
            }}
          >
            <SVGIcon name="arrow-back" size={24} color={primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>TLM Hub</Text>
        </View>

        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <SVGIcon name="add-circle-outline" size={28} color={primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "discovery" && { borderBottomColor: primary }]}
          onPress={() => setActiveTab("discovery")}
        >
          <Text style={[styles.tabText, activeTab === "discovery" && { color: primary, fontWeight: "700" }]}>
            Discovery
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "saved" && { borderBottomColor: primary }]}
          onPress={() => setActiveTab("saved")}
        >
          <Text style={[styles.tabText, activeTab === "saved" && { color: primary, fontWeight: "700" }]}>
            My Hub
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "discovery" && (
        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Subject"
            value={subject}
            onChangeText={setSubject}
            style={styles.input}
          />

          <TextInput
            placeholder="Topic"
            value={topic}
            onChangeText={setTopic}
            style={styles.input}
          />

          <TouchableOpacity
            style={[
              styles.searchBtn,
              {
                backgroundColor: primary,
              },
            ]}
            onPress={() => debouncedSearch()}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.searchText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {activeTab === "discovery" && aiTip && (
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>AI Teaching Tip</Text>

          <Text style={styles.tipText}>{aiTip}</Text>
        </View>
      )}

      <FlatList
        data={activeTab === "saved" ? savedTlms : discoveryResults}
        keyExtractor={(item) => item.id}
        renderItem={renderTlmItem}
        contentContainerStyle={{
          paddingBottom: 120,
        }}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={5}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Materials Found</Text>

            <Text style={styles.emptySubtitle}>
              Search for teaching materials to begin.
            </Text>
          </View>
        )}
      />

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Resource</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <SVGIcon name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter resource title"
                  value={newTlm.title}
                  onChangeText={(text) => setNewTlm({ ...newTlm, title: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Subject</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Mathematics"
                  value={newTlm.subject}
                  onChangeText={(text) => setNewTlm({ ...newTlm, subject: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Topic</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Addition"
                  value={newTlm.topic}
                  onChangeText={(text) => setNewTlm({ ...newTlm, topic: text })}
                />
              </View>

              <TouchableOpacity
                style={[styles.uploadBox, uploading && styles.disabledBtn]}
                onPress={handlePickFile}
                disabled={uploading}
              >
                {uploading ? (
                  <View style={styles.uploadInfo}>
                    <ActivityIndicator color={primary} />
                    <Text style={styles.uploadText}>Uploading... {Math.round(uploadProgress)}%</Text>
                  </View>
                ) : newTlm.url ? (
                  <View style={styles.uploadInfo}>
                    <SVGIcon name="checkmark-circle" size={32} color="#10B981" />
                    <Text style={styles.uploadText}>File Ready</Text>
                  </View>
                ) : (
                  <View style={styles.uploadInfo}>
                    <SVGIcon name="cloud-upload-outline" size={32} color={primary} />
                    <Text style={styles.uploadText}>Upload Document, Image or Video</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.orDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.orText}>OR LINK</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>External URL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://..."
                  value={newTlm.url}
                  onChangeText={(text) => setNewTlm({ ...newTlm, url: text, type: 'link' })}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: primary }]}
                onPress={handleAddCustomTlm}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save to Hub</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
  },

  header: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
  },

  searchContainer: {
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 10,
  },

  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },

  tab: {
    paddingVertical: 12,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },

  tabText: {
    fontSize: 15,
    color: "#6B7280",
  },

  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },

  searchBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  searchText: {
    color: "#FFF",
    fontWeight: "700",
  },

  tlmCard: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "#FFF",
    borderRadius: 18,
    overflow: "hidden",
    ...SHADOWS.medium,
  },

  tlmThumbnail: {
    width: 120,
    height: 120,
  },

  tlmInfo: {
    flex: 1,
    padding: 14,
  },

  tlmHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  tlmTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    marginRight: 10,
  },

  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  typeText: {
    fontSize: 10,
    fontWeight: "700",
  },

  tlmMeta: {
    marginTop: 8,
    color: "#6B7280",
  },

  tlmActions: {
    flexDirection: "row",
    marginTop: 14,
    gap: 10,
  },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },

  actionText: {
    fontWeight: "600",
  },

  tipCard: {
    margin: 20,
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 16,
  },

  tipTitle: {
    fontWeight: "700",
    marginBottom: 8,
  },

  tipText: {
    lineHeight: 22,
    color: "#374151",
  },

  emptyState: {
    alignItems: "center",
    marginTop: 80,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  emptySubtitle: {
    marginTop: 8,
    color: "#6B7280",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadInfo: {
    alignItems: 'center',
    gap: 12,
  },
  uploadText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  orText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
