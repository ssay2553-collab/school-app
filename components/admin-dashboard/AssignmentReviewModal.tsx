import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  StyleSheet,
  Platform,
  Dimensions
} from "react-native";
import { doc, updateDoc, serverTimestamp, query, collection, where, getDocs } from "firebase/firestore";
import { useRouter } from "expo-router";
import SVGIcon from "../SVGIcon";
import QuestionResponseItem from "../student-dashboard/assignments/QuestionResponseItem";
import { db } from "../../firebaseConfig";
import { useAuth } from "../../contexts/AuthContext";
import { sendNotification } from "../../src/services/notificationService";
import { SCHOOL_CONFIG } from "../../constants/Config";
import { SHADOWS } from "../../constants/theme";

interface AssignmentReviewModalProps {
  assignment: any;
  visible: boolean;
  onClose: () => void;
  onStatusUpdate: (updatedAssignment: any) => void;
}

export default function AssignmentReviewModal({
  assignment,
  visible,
  onClose,
  onStatusUpdate
}: AssignmentReviewModalProps) {
  const { appUser } = useAuth();
  const router = useRouter();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectionFeedback, setRejectionFeedback] = useState("");
  const [showRejectionInput, setShowRejectionInput] = useState(false);

  const primary = SCHOOL_CONFIG.primaryColor;

  const handleClose = () => {
    setShowRejectionInput(false);
    setRejectionFeedback("");
    onClose();
  };

  const approveAssignment = async () => {
    if (approvingId || !assignment) return;
    setApprovingId(assignment.id);

    try {
      const assignmentRef = doc(db, "assignments", assignment.id);
      await updateDoc(assignmentRef, {
        status: "approved",
        updatedAt: serverTimestamp(),
      });

      const updatedAssignment = { ...assignment, status: 'approved', updatedAt: new Date() };
      onStatusUpdate(updatedAssignment);

      // Send notifications to students
      const studentsQuery = query(
        collection(db, "users"),
        where("role", "==", "student"),
        where("classId", "==", assignment.classId)
      );

      const studentsSnap = await getDocs(studentsQuery);

      await Promise.allSettled(
        studentsSnap.docs.map(studentDoc =>
          sendNotification({
            recipientId: studentDoc.id,
            senderId: appUser?.uid || "admin",
            senderName: "School Admin",
            type: "assignment",
            title: "Assignment Approved",
            body: `${assignment.subjectId || assignment.subject}: ${assignment.title} is now available.`,
            data: {
              assignmentId: assignment.id,
              classId: assignment.classId,
            },
          })
        )
      );

      Alert.alert("Success", "Assignment approved and sent to students.");
      handleClose();
    } catch (error) {
      console.error("Approval error:", error);
      Alert.alert("Error", "Failed to approve assignment. Please try again.");
    } finally {
      setApprovingId(null);
    }
  };

  const rejectAssignment = async () => {
    if (!assignment || !rejectionFeedback.trim()) {
      Alert.alert("Error", "Please provide feedback for the teacher.");
      return;
    }

    setApprovingId(assignment.id);
    try {
      const assignmentRef = doc(db, "assignments", assignment.id);
      await updateDoc(assignmentRef, {
        status: "rejected",
        feedback: rejectionFeedback,
        updatedAt: serverTimestamp(),
      });

      const updatedAssignment = { ...assignment, status: 'rejected', feedback: rejectionFeedback, updatedAt: new Date() };
      onStatusUpdate(updatedAssignment);

      // Notify teacher
      await sendNotification({
        recipientId: assignment.teacherId,
        senderId: appUser?.uid || "admin",
        senderName: "School Admin",
        type: "assignment",
        title: "Assignment Returned",
        body: `Your assignment "${assignment.title}" requires corrections. Feedback: ${rejectionFeedback}`,
        data: {
          assignmentId: assignment.id,
          status: "rejected"
        },
      });

      Alert.alert("Success", "Assignment returned to teacher for corrections.");
      handleClose();
    } catch (error) {
      console.error("Rejection error:", error);
      Alert.alert("Error", "Failed to return assignment. Please try again.");
    } finally {
      setApprovingId(null);
    }
  };

  if (!assignment) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { height: '95%' }]}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Review Assignment</Text>
              <Text style={styles.modalSubtitle}>{assignment?.title} • {assignment?.subjectId || assignment?.subject}</Text>
            </View>
            <TouchableOpacity onPress={handleClose}>
              <SVGIcon name="close-circle" size={28} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
            <View style={styles.reviewContentBox}>
              <Text style={styles.reviewLabel}>Instructions / Description</Text>
              <Text style={styles.reviewDescription}>{assignment?.description || "No description provided."}</Text>

              {assignment?.fileUrl && (
                <TouchableOpacity
                  style={styles.attachmentLink}
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      window.open(assignment.fileUrl, '_blank');
                    } else {
                      router.push({
                        pathname: '/shared/web-view',
                        params: { url: assignment.fileUrl, title: assignment.fileName || 'Attachment' },
                      });
                    }
                  }}
                >
                  <SVGIcon name="attach" size={18} color={primary} />
                  <Text style={[styles.attachmentLinkText, { color: primary }]}>View Attachment: {assignment.fileName}</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.sectionTitle}>Interactive Questions ({assignment?.questions?.length || 0})</Text>

            {assignment?.questions?.map((q: any, idx: number) => (
              <QuestionResponseItem
                key={idx}
                q={q}
                qIdx={idx}
                type={assignment.type}
                answer={null}
                setAnswer={() => {}}
                readOnly={true}
              />
            ))}

            {assignment?.status === 'rejected' && assignment.feedback && (
              <View style={styles.feedbackAlert}>
                 <Text style={styles.feedbackAlertTitle}>Previous Feedback:</Text>
                 <Text style={styles.feedbackAlertText}>{assignment.feedback}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.reviewFooter}>
            {showRejectionInput ? (
              <View style={styles.rejectionContainer}>
                <TextInput
                  style={styles.rejectionInput}
                  placeholder="Enter reason for rejection or needed corrections..."
                  multiline
                  value={rejectionFeedback}
                  onChangeText={setRejectionFeedback}
                />
                <View style={styles.rejectionActionRow}>
                  <TouchableOpacity
                    style={styles.cancelRejectBtn}
                    onPress={() => setShowRejectionInput(false)}
                  >
                    <Text style={styles.cancelRejectText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmRejectBtn, approvingId && { opacity: 0.5 }]}
                    onPress={rejectAssignment}
                    disabled={!!approvingId}
                  >
                    {approvingId ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmRejectText}>Send Feedback</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.reviewActionRow}>
                <TouchableOpacity
                  style={[styles.rejectBtn, assignment?.status === 'approved' && { opacity: 0.5 }]}
                  onPress={() => setShowRejectionInput(true)}
                  disabled={assignment?.status === 'approved'}
                >
                  <Text style={styles.rejectBtnText}>Return for Correction</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.approveFullBtn, { backgroundColor: primary }, assignment?.status === 'approved' && { opacity: 0.5 }]}
                  onPress={approveAssignment}
                  disabled={!!approvingId || assignment?.status === 'approved'}
                >
                  {approvingId ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.approveFullBtnText}>{assignment?.status === 'approved' ? 'Approved' : 'Approve & Publish'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1E293B",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 20,
    marginBottom: 12,
  },
  reviewContentBox: {
    backgroundColor: '#F8FAFC',
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reviewLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  reviewDescription: {
    fontSize: 15,
    color: '#1E293B',
    lineHeight: 22,
  },
  attachmentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    gap: 6,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  attachmentLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
  feedbackAlert: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#EF444410',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF444420',
  },
  feedbackAlertTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#EF4444',
    marginBottom: 5,
  },
  feedbackAlertText: {
    fontSize: 13,
    color: '#EF4444',
    fontStyle: 'italic',
  },
  reviewFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  rejectionContainer: {
    gap: 12,
  },
  rejectionInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 15,
    fontSize: 14,
    color: '#1E293B',
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rejectionActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelRejectBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  cancelRejectText: {
    color: '#64748B',
    fontWeight: '800',
  },
  confirmRejectBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#EF4444',
  },
  confirmRejectText: {
    color: '#fff',
    fontWeight: '800',
  },
  reviewActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    alignItems: 'center',
  },
  rejectBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
  },
  approveFullBtn: {
    flex: 1.5,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  approveFullBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
