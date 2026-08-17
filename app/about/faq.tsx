import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SVGIcon from "../../components/SVGIcon";
import { SHADOWS } from "../../constants/theme";

export default function FAQScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<number | null>(null);

  const faqs = [
    {
      q: "What is the payment schedule for EduEaz?",
      a: "Payments should be made on or before the second month after school resumes each term.",
    },
    {
      q: "How do I reset my password?",
      a: "You can reset your password from the login screen by clicking 'Forgot Password' or by contacting your school administrator.",
    },
    {
      q: "Can I use EduEaz on multiple devices?",
      a: "Yes, you can log in to your account on multiple devices simultaneously. Your data will be synced automatically.",
    },
    {
      q: "How do I receive notifications?",
      a: "Ensure that notifications are enabled in your device settings for the EduEaz app. You will receive updates about grades, attendance, and school news.",
    },
    {
      q: "Who should I contact for technical support?",
      a: "For technical issues, please use the 'Contact Us' section or reach out to ssay2553@gmail.com.",
    },
    {
      q: "How do I onboard my students?",
      a: "Students can be added individually via the Admin dashboard or imported in bulk from an Excel/CSV file provided by the school.",
    },
    {
      q: "What do parents need in order to register?",
      a: "Parents need a valid email address and the student's unique ID/code provided by the school to link their account.",
    },
    {
      q: "Are my chats secured?",
      a: "Yes, all communication and data within EduEaz are encrypted and accessible only by authorized users.",
    },
    {
      q: "How many email accounts can I use for the app?",
      a: "You can use one unique email account per user profile. There is no limit to the number of user profiles a school can have.",
    },
    {
      q: "Can I use the same email account twice?",
      a: "No, each email address must be unique to a single account to ensure security and proper data mapping.",
    },
    {
      q: "Can I use my admin account to register as a teacher?",
      a: "Admin accounts have broad permissions, but we recommend creating a specific teacher profile for classroom-specific tasks like grading and attendance.",
    },
    {
      q: "How is grading of assignments done?",
      a: "Teachers can enter marks for various assessments. The system then automatically calculates averages and generates terminal reports based on the school's grading system.",
    },
    {
      q: "How do I move to previous years to view my child's fee and academic records?",
      a: "You can use the 'Academic Year' or 'Session' filter in the academic and financial sections to view historical data for your child.",
    },
    {
      q: "Can I see contents in other dashboards if I am not an admin?",
      a: "No, EduEaz uses role-based access control. Users can only access the dashboard and information specifically assigned to their role (Admin, Teacher, Parent, or Student).",
    },
    {
      q: "Is my data backed up?",
      a: "Yes, we perform daily automated backups of all school data to secure cloud storage to ensure your information is safe and recoverable.",
    },
    {
      q: "How do I delete my account?",
      a: "To delete your account, please contact your school administrator. If you are an admin, please contact EduEaz support directly at ssay2553@gmail.com.",
    },
    {
      q: "Does the app work offline?",
      a: "EduEaz requires an internet connection to sync data in real-time. However, some previously loaded content may be accessible in a cached state.",
    },
    {
      q: "Can the school customize its report cards?",
      a: "Yes, EduEaz supports customized report templates to match your school's branding and specific grading criteria. Contact support for setup assistance.",
    },
    {
      q: "Is EduEaz compliant with data protection laws?",
      a: "Yes, we prioritize data privacy and comply with relevant data protection regulations to ensure that all student and staff information is handled securely and ethically.",
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <SVGIcon name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FAQ</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {faqs.map((faq, index) => (
          <TouchableOpacity
            key={index}
            style={styles.faqCard}
            onPress={() => setExpanded(expanded === index ? null : index)}
            activeOpacity={0.7}
          >
            <View style={styles.qRow}>
              <Text style={styles.question}>{faq.q}</Text>
              <SVGIcon
                name={expanded === index ? "chevron-up" : "chevron-down"}
                size={20}
                color="#64748b"
              />
            </View>
            {expanded === index && (
              <Text style={styles.answer}>{faq.a}</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
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
    gap: 12,
  },
  faqCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    ...SHADOWS.small,
  },
  qRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  question: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    flex: 1,
    marginRight: 10,
  },
  answer: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 12,
    lineHeight: 20,
  },
});
