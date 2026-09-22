# Robust Weekly Lesson Planning & Curriculum Integration

This plan enhances the robustness of the Weekly Lesson planning system by expanding the GES/NaCCA curriculum database and improving the "Smart Lookup" user experience.

## User Review Required

> [!IMPORTANT]
> - **Data Expansion**: I will add a significant number of core indicators for Mathematics, Science, English, and Computing across Basic 1-6 and JHS 1-3.
> - **UI Feedback**: I will add a "No Match" warning to prevent confusion when a teacher enters a valid NaCCA code that isn't yet in our local database.
> - **Clear Functionality**: A "Clear" button will be added to the Indicator field to allow teachers to quickly reset auto-populated data if they change their mind.

## Proposed Changes

### 1. Curriculum Data (Database Expansion)

#### [MODIFY] [GES_Curriculum.ts](file:///C:/Users/Administrator/EduEaz/constants/GES_Curriculum.ts)
- Populate `GES_CURRICULUM_DATA` with a wider range of indicators.
- Ensure all levels from Basic 1 to JHS 3 have at least core strand data.

### 2. Logic Layer (Hook Enhancement)

#### [MODIFY] [useWeeklyTopics.ts](file:///C:/Users/Administrator/EduEaz/hooks/teacher-dashboard/useWeeklyTopics.ts)
- Add `lookupResult` state (`'success' | 'not_found' | 'idle'`).
- Add a `clearIndicator()` function to reset the `topicData` to an empty state.
- Improve the debounced lookup to update this state.

### 3. UI Layer (UX Improvements)

#### [MODIFY] [weekly-topics.tsx](file:///C:/Users/Administrator/EduEaz/app/teacher-dashboard/weekly-topics.tsx)
- Display a "Warning" icon or text if `lookupResult === 'not_found'`.
- Add a "Clear" icon inside the Indicator Input.
- Improve the "Smart Lookup" badge to show activity.

## Verification Plan

### Automated Tests
- I will verify the lookup function with a set of test codes across different subjects and levels using a scratch script.

### Manual Verification
1. **Negative Test**: Enter a non-existent code (e.g., `X9.9.9`) and verify the "No Match Found" feedback appears.
2. **Positive Test**: Enter a newly added code (e.g., `B4.1.1.1.1`) and verify all fields populate instantly.
3. **Clear Test**: Click the "Clear" button and verify the Strand, Sub-strand, and Objectives are wiped.
