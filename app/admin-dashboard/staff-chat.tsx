import React from "react";
import { StaffChatView } from "../../components/StaffChatView";
import { TierProtectedRoute } from "../../components/TierProtectedRoute";

export default function AdminStaffChatScreen() {
  return (
    <TierProtectedRoute featureId="admin_staff_chat">
      <StaffChatView />
    </TierProtectedRoute>
  );
}
