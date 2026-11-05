import React from "react";
import { StaffChatView } from "../../components/StaffChatView";
import { TierProtectedRoute } from "../../components/TierProtectedRoute";

export default function TeacherStaffChatScreen() {
  return (
    <TierProtectedRoute featureId="teacher_staff_chat">
      <StaffChatView />
    </TierProtectedRoute>
  );
}
