# Implementation Plan - Staff Group Chat Feature

Enable staff members (admins and teachers) to create groups and chat with multiple staff members simultaneously, in addition to existing 1-on-1 direct chats.

## User Review Required

> [!IMPORTANT]
> - **Firestore Collection**: We will introduce a new `staffGroups` collection (analogous to `studentGroups`) to store group metadata and messages.
> - **Shared Logic**: `admin-dashboard/staff-chat.tsx` and `teacher-dashboard/staff-chat.tsx` will be enhanced to display both 1-on-1 chats and Staff Groups, plus a "Create Group" flow where staff can select multiple colleagues and name the group.

## Open Questions

- None at this time. The design mirrors the existing student group chat functionality adapted for staff roles.

## Proposed Changes

### Staff Chat & Group Feature

#### [MODIFY] [staff-chat.tsx](file:///C:/Users/Administrator/EduEaz/app/admin-dashboard/staff-chat.tsx)
- Add "Staff Groups" section alongside individual staff members in the list stage.
- Implement "Create Group" modal/screen allowing staff to select multiple members and enter a group name.
- Add group chat view handling messages, voice notes, and push notifications for `staffGroups`.

#### [MODIFY] [staff-chat.tsx](file:///C:/Users/Administrator/EduEaz/app/teacher-dashboard/staff-chat.tsx)
- Apply the same staff group chat and creation capabilities as admin staff-chat.

## Verification Plan

### Automated Tests
- Build test via Expo / TypeScript compilation check.

### Manual Verification
- Log in as admin/teacher, navigate to Staff Chat.
- Create a new staff group with multiple staff members.
- Send text and audio messages in the staff group.
- Verify unread counts and notifications for group members.
