import React from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Animatable from "react-native-animatable";
import SVGIcon from "../SVGIcon";
import { SHADOWS } from "../../constants/theme";

interface AcademicSignatureCardProps {
  signatureUrl: string;
  uploadingSig: boolean;
  handleUploadSignature: () => void;
  primary: string;
}

export const AcademicSignatureCard = ({
  signatureUrl,
  uploadingSig,
  handleUploadSignature,
  primary,
}: AcademicSignatureCardProps) => {
  return (
    <Animatable.View animation="fadeInDown" style={styles.signatureCard}>
      <View style={styles.sigHeader}>
        <SVGIcon name="shield-checkmark-outline" size={20} color={primary} />
        <Text style={styles.sigTitle}>Institution's Official Signature</Text>
      </View>
      <Text style={styles.sigSubtitle}>
        Tip: Sign on plain white paper and{" "}
        <Text style={{ fontWeight: "bold", color: primary }}>
          apply the school stamp
        </Text>{" "}
        over it before uploading for a professional look.
      </Text>
      <View style={styles.sigContent}>
        {signatureUrl ? (
          <Image
            source={{ uri: signatureUrl }}
            style={styles.sigImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.sigPlaceholder}>
            <SVGIcon name="image-outline" size={32} color="#94A3B8" />
            <Text style={styles.sigPlaceholderText}>No Signature Uploaded</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.sigUploadBtn, { backgroundColor: primary }]}
          onPress={handleUploadSignature}
          disabled={uploadingSig}
        >
          {uploadingSig ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sigUploadBtnText}>
              {signatureUrl ? "Replace Signature" : "Upload Signature"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  signatureCard: {
    backgroundColor: "#fff",
    margin: 20,
    padding: 20,
    borderRadius: 24,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: -40,
  },
  sigHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  sigTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  sigSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 15,
    fontWeight: "600",
  },
  sigContent: { alignItems: "center" },
  sigImage: {
    width: "100%",
    height: 80,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sigPlaceholder: {
    width: "100%",
    height: 80,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  sigPlaceholderText: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 8,
    fontWeight: "700",
  },
  sigUploadBtn: {
    marginTop: 15,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  sigUploadBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
