# Curriculum PDF Viewer and Storage Implementation Plan

This plan outlines the implementation of a Curriculum PDF Viewer and Storage system allowing teachers and admins to store, manage, and view PDF versions of curricula (GES, Cambridge, Montessori, etc.).

## User Review Required

- **Storage Method**: We will use Firestore collection `curriculums` to store curriculum metadata and PDF URLs (e.g., Google Drive link, Firebase Storage download URL, or external PDF URL), along with a clean UI screen in the teacher/admin dashboard.
- **PDF Viewer**: We will create a dedicated PDF Viewer screen (`app/shared/pdf-viewer.tsx` or `app/teacher-dashboard/curriculum-pdf-viewer.tsx`) using `react-native-webview` (with Google Docs viewer fallback for universal PDF rendering on mobile and web).

## Proposed Changes

### Database & Security
#### [MODIFY] [firestore.rules](file:///C:/Users/Administrator/EduEaz/firestore.rules)
- Add security rules for the `curriculums` collection (read access for all signed-in users, write/create access for admins and teachers).

### Screens & Components
#### [NEW] [curriculum-pdf-viewer.tsx](file:///C:/Users/Administrator/EduEaz/app/teacher-dashboard/curriculum-pdf-viewer.tsx)
- Create a comprehensive Curriculum PDF viewer and manager screen:
  - List saved curriculum PDFs grouped by Curriculum Type (GES, Cambridge, Montessori) and Subject.
  - Search and filter by class level and subject.
  - Modal / Form for Admins and Teachers to add/upload new curriculum PDF entries (Title, Curriculum Type, Subject, Class Level, PDF URL).
  - Open PDF in built-in PDF viewer or WebView.

#### [MODIFY] [teacher-dashboard/index.tsx](file:///C:/Users/Administrator/EduEaz/app/teacher-dashboard/index.tsx)
- Add "Curriculum PDFs" menu card under Teaching Tools pointing to `/teacher-dashboard/curriculum-pdf-viewer`.

## Verification Plan

### Automated Tests
- Build test via Metro / React Native bundle check.

### Manual Verification
- Navigate to Teacher Dashboard -> Curriculum PDFs.
- Test adding a new curriculum PDF entry.
- Test filtering by GES / Cambridge / Montessori and viewing the PDF.
