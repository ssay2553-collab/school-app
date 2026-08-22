# Implementation Plan - Rich Math Step-by-Step for Students

Give students access to the same mathematical expression tools as teachers for their "show working" (step-by-step) responses.

## User Review Required

> [!IMPORTANT]
> This change will update the data format of student submissions for mathematics assignments from `string` to `VisualItem[]`. Existing submissions for math assignments might need migration if they were already using the text-based format, though this is a new feature.

## Proposed Changes

### Shared Components

#### [NEW] [MathCanvas.tsx](file:///C:/Users/Administrator/EduEaz/components/MathCanvas.tsx)
Extract the math canvas logic from `MathematicsFields.tsx` into a reusable component.
- **Props**:
    - `value: VisualItem[]`
    - `onChange: (value: VisualItem[]) => void`
    - `label?: string`
    - `placeholder?: string`
    - `minHeight?: number`
    - `isLibraryVisible?: boolean`

### Teacher Dashboard

#### [MODIFY] [MathematicsFields.tsx](file:///C:/Users/Administrator/EduEaz/components/teacher-dashboard/upload-assignment/components/MathematicsFields.tsx)
Refactor to use the new `MathCanvas` component for building questions.

### Student Dashboard

#### [MODIFY] [QuestionResponseItem.tsx](file:///C:/Users/Administrator/EduEaz/components/student-dashboard/assignments/QuestionResponseItem.tsx)
Refactor to use `MathCanvas` for both "Show your working steps" and "Final Answer" when the assignment type is `mathematics`.

#### [MODIFY] [assignments.tsx](file:///C:/Users/Administrator/EduEaz/app/student-dashboard/assignments.tsx)
Ensure the `answers` state correctly handles objects/arrays returned by the new `MathCanvas` in `QuestionResponseItem`.

## Verification Plan

### Automated Tests
- N/A (UI-centric change in a React Native environment)

### Manual Verification
1.  **Teacher Side**:
    *   Navigate to "Post Assignment".
    *   Select type "Mathematics".
    *   Verify the Question Builder still works as expected using the new `MathCanvas`.
    *   Enable "Require Students to Show Working".
    *   Post the assignment.
2.  **Student Side**:
    *   Navigate to the student dashboard assignments.
    *   Start the math assignment.
    *   Verify the "Working" area now shows the full Math Symbol Library and Canvas.
    *   Build a complex solution (e.g., a fraction inside a square root).
    *   Submit the assignment.
3.  **Backend**:
    *   Check Firestore `submissions` to ensure `responses` contains the `VisualItem[]` structure.
