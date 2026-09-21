# Upgrade Academic Reports to Support Multiple Assessment Types (CAT/Trial Test)

This plan upgrades the academic report system to allow teachers to submit multiple assessment reports within a single term. It introduces "Class Assessment Task (CAT)" and "Trial Test" with automatic numbering (e.g., CAT 1, TEST 1, etc.).

## User Review Required

> [!IMPORTANT]
> - Existing "Mid-Term" reports will be preserved in the database but will be grouped under the new "Class Assessment Task (CAT)" category in the UI for consistency.
> - The report document IDs in Firestore will now include the assessment number (e.g., `CAT1`, `TEST2`) to allow multiple records per subject/term.

## Proposed Changes

### Core Academic Logic

#### [MODIFY] [useAcademicRecords.ts](file:///C:/Users/Administrator/EduEaz/hooks/teacher-dashboard/useAcademicRecords.ts)
- Update `ReportType` union: `"End of Term" | "Mid-Term" | "Mock Exams" | "Class Assessment Task (CAT)" | "Trial Test"`.
- Add `reportNumber` state (defaulting to 1).
- Update `calculateScores` to handle new report types.
- Update `docId` generation to include `reportNumber` in the slug for CAT and Trial Test.
- Update `academicRecordsSummary` key generation to include the number.

#### [MODIFY] [useViewAcademicRecords.ts](file:///C:/Users/Administrator/EduEaz/hooks/admin-dashboard/useViewAcademicRecords.ts)
- Update `ReportType` union.
- Add `selectedReportNumber` state.
- Update queries and data loading logic to filter by both type and number.
- Update `recalculateRankings` logic to handle numbered reports.

#### [MODIFY] [useAcademicRecordDetails.ts](file:///C:/Users/Administrator/EduEaz/hooks/admin-dashboard/useAcademicRecordDetails.ts)
- Update `ReportType` union.
- Support `reportNumber` in props and slug generation.

### User Interface

#### [MODIFY] [student-academic-records.tsx](file:///C:/Users/Administrator/EduEaz/app/teacher-dashboard/student-academic-records.tsx)
- Update "REPORT TYPE" selection to include CAT and Trial Test.
- Add a new "ASSESSMENT NUMBER" selection group that appears when CAT or Trial Test is selected.
- Update the UI to show "CAT X" or "TEST X" in headers and cards.

#### [MODIFY] [view-academic-records.tsx](file:///C:/Users/Administrator/EduEaz/app/admin-dashboard/view-academic-records.tsx)
- Add "ASSESSMENT NUMBER" filter to the admin dashboard.

#### [MODIFY] [student-academic-report.tsx](file:///C:/Users/Administrator/EduEaz/app/parent-dashboard/student-academic-report.tsx)
- Add "Assessment Number" selector for parents to view specific CATs or Tests.

#### [MODIFY] [AcademicReportPreview.tsx](file:///C:/Users/Administrator/EduEaz/components/admin-dashboard/AcademicReportPreview.tsx)
- Ensure the preview title displays correctly as "CAT 1 PROGRESS REPORT" or "TEST 2 PROGRESS REPORT".

#### [MODIFY] [StudentScoreCard.tsx](file:///C:/Users/Administrator/EduEaz/components/admin-dashboard/StudentScoreCard.tsx)
- Update `ReportType` definition.

## Verification Plan

### Manual Verification
1. **Teacher Dashboard**:
   - Log in as a teacher.
   - Select "Class Assessment Task (CAT)".
   - Verify "ASSESSMENT NUMBER" selector appears.
   - Save "CAT 1" scores and then "CAT 2" scores for the same subject/term.
   - Verify both records exist and show correct data.
2. **Admin Dashboard**:
   - Log in as an admin.
   - Filter by "CAT" and number "1".
   - Verify the correct student list and scores appear.
3. **Parent Dashboard**:
   - Log in as a parent.
   - Verify they can switch between different CATs/Tests for their child.
4. **PDF Generation**:
   - Generate a PDF for "Trial Test 1".
   - Verify the title shows "TEST 1 PROGRESS REPORT".
