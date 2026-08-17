import { useRouter } from "expo-router";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SCHOOL_CONFIG } from "../../constants/Config";

export default function LegalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const brandPrimary = SCHOOL_CONFIG.brandPrimary;
  const schoolName = SCHOOL_CONFIG.fullName || "the School";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal Agreement</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.introBox}>
          <Text style={styles.agreementText}>
            This agreement is made between:
          </Text>
          <Text style={styles.partyText}>
            <Text style={styles.bold}>Provider:</Text> EduEaz (Represented by
            Samuel Smith-Amankwah)
          </Text>
          <Text style={styles.partyText}>
            <Text style={styles.bold}>Client:</Text> {schoolName}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>1. Purpose</Text>
        <Text style={styles.bodyText}>
          This agreement outlines the terms for the provision and use of the
          School Management Application for managing school administration,
          student records, and communication.
        </Text>

        <Text style={styles.sectionTitle}>2. Services Provided</Text>
        <Text style={styles.bodyText}>
          The Provider will:{"\n"}• Provide the school with a branded version of
          the application.{"\n"}• Maintain system access for the school.{"\n"}•
          Provide reasonable technical support and guidance.
        </Text>

        <Text style={styles.sectionTitle}>3. System Use</Text>
        <Text style={styles.bodyText}>
          The Client agrees to use the application strictly for legitimate
          school administrative purposes including student management, academic
          records, and communication.
        </Text>

        <Text style={styles.sectionTitle}>4. Data Ownership and Protection</Text>
        <Text style={styles.bodyText}>
          All school and student data entered into the system remain the
          property of the Client. The Provider agrees to maintain
          confidentiality and reasonable data protection practices.
        </Text>

        <Text style={styles.sectionTitle}>5. Payment Terms</Text>
        <Text style={styles.bodyText}>
          All payment is done by the client school; EduEaz does not charge any
          parent, student, or staff directly or indirectly.
          {"\n\n"}
          <Text style={styles.bold}>Payment Schedule:</Text>{"\n"}
          Payment must be made on or before the second month after the school
          resumes each term.
        </Text>

        <Text style={styles.sectionTitle}>6. Data Security and Backups</Text>
        <Text style={styles.bodyText}>
          The Provider employs industry-standard security measures, including
          encryption and secure server hosting, to protect school data. Regular
          backups are performed to prevent data loss. However, the Client is
          encouraged to maintain independent records of critical information.
        </Text>

        <Text style={styles.sectionTitle}>7. Intellectual Property</Text>
        <Text style={styles.bodyText}>
          All software, code, designs, and branding associated with the EduEaz
          platform remain the exclusive property of the Provider. The Client is
          granted a non-exclusive license to use the system for the duration of
          this agreement.
        </Text>

        <Text style={styles.sectionTitle}>8. Limitation of Liability</Text>
        <Text style={styles.bodyText}>
          While the Provider strives for 100% uptime, they shall not be held
          liable for any indirect, incidental, or consequential damages arising
          from system downtime, data entry errors by the Client, or
          unauthorized access beyond the Provider's reasonable control.
        </Text>

        <Text style={styles.sectionTitle}>9. Prohibited Activities</Text>
        <Text style={styles.bodyText}>
          The Client and its users shall not:{"\n"}• Attempt to reverse
          engineer, decompile, or disassemble any part of the software.{"\n"}•
          Use the system to store or transmit infringing, libelous, or
          otherwise unlawful material.{"\n"}• Interfere with or disrupt the
          integrity or performance of the service.
        </Text>

        <Text style={styles.sectionTitle}>10. Updates and Maintenance</Text>
        <Text style={styles.bodyText}>
          The Provider reserves the right to perform scheduled maintenance and
          deploy system updates to improve performance and security. Users will
          be notified of significant downtime in advance whenever possible.
        </Text>

        <Text style={styles.sectionTitle}>11. Implementation</Text>
        <Text style={styles.bodyText}>
          Upon acceptance of this agreement, the Provider will activate the
          school's system and assist with onboarding.
        </Text>

        <Text style={styles.sectionTitle}>12. Support</Text>
        <Text style={styles.bodyText}>
          The Provider will offer technical support during business hours to
          assist the school in operating the system effectively. Critical
          system issues will be prioritized.
        </Text>

        <Text style={styles.sectionTitle}>13. Termination</Text>
        <Text style={styles.bodyText}>
          Either party may terminate this agreement with at least 30 days'
          written notice. Upon termination, the Client will be provided with a
          final export of their student and academic data.
        </Text>

        <Text style={styles.sectionTitle}>14. Confidentiality</Text>
        <Text style={styles.bodyText}>
          Both parties agree to keep all non-public information received from
          the other party strictly confidential. This includes school financial
          data, student personal information, and the Provider's proprietary
          technical details.
        </Text>

        <Text style={styles.sectionTitle}>15. Disclaimer of Warranties</Text>
        <Text style={styles.bodyText}>
          The service is provided "as is" and "as available." The Provider
          disclaims all warranties, express or implied, including but not
          limited to the implied warranties of merchantability and fitness for a
          particular purpose.
        </Text>

        <Text style={styles.sectionTitle}>16. Severability</Text>
        <Text style={styles.bodyText}>
          If any provision of this agreement is found to be unenforceable or
          invalid, that provision shall be limited or eliminated to the minimum
          extent necessary so that this agreement shall otherwise remain in
          full force and effect.
        </Text>

        <Text style={styles.sectionTitle}>17. Governing Law</Text>
        <Text style={styles.bodyText}>
          This agreement shall be governed by and construed in accordance with
          the laws of Ghana. Any disputes arising under this agreement shall be
          subject to the exclusive jurisdiction of the courts of Ghana.
        </Text>

        <Text style={styles.sectionTitle}>18. Force Majeure</Text>
        <Text style={styles.bodyText}>
          Neither party shall be liable for any failure to perform its
          obligations where such failure results from any cause beyond that
          party's reasonable control, including, but not limited to, mechanical,
          electronic, or communications failure or degradation.
        </Text>

        <Text style={styles.sectionTitle}>19. Acceptance</Text>
        <Text style={styles.bodyText}>
          By signing this agreement, both parties confirm their willingness to
          proceed with the use of the School Management Application provided by
          EduEaz.
        </Text>

        <View style={styles.footerSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backBtn: {
    padding: 8,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
  },
  content: {
    padding: 20,
  },
  introBox: {
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  agreementText: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 8,
  },
  partyText: {
    fontSize: 15,
    color: "#1e293b",
    marginBottom: 4,
  },
  bold: {
    fontWeight: "800",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1e293b",
    marginTop: 24,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 24,
    color: "#475569",
  },
  footerSpace: {
    height: 40,
  },
});
