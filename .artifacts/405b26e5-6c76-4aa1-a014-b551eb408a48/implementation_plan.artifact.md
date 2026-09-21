# Waterfall Payment Robustness and "Other Charges" Refinement

This plan aims to make the waterfall payment feature robust and production-ready by ensuring that named "other" charges (e.g., "Lab Fee", "Graduation Fee") are correctly captured as individual items in the waterfall system and not lumped into the main Tuition or a generic "Other" category unless explicitly intended as "Other Charges".

## User Review Required

> [!IMPORTANT]
> The generic "Other" category will be renamed to "Other Charges" in the internal logic to distinguish it from specific named items. This aligns with the "Other Charges" screen in the admin dashboard.

> [!WARNING]
> This change impacts how payments are allocated. Payments labeled simply as "other" will now prioritize "Other Charges" debt in the waterfall before being used for tuition or other categories.

## Proposed Changes

### Core Logic & Utilities

#### [MODIFY] [utils.ts](file:///C:/Users/Administrator/EduEaz/hooks/admin-dashboard/finance-cleanup/utils.ts)
- Rename `"other"` to `"other charges"` in `waterfallOrder` and `isolatedKeys`.
- Update `normalizeCategory` to:
    - Return specific labels (like "Lab Fee") if provided in `otherCategory`.
    - Return `"other charges"` as the fallback for generic "other" payments/bills.
    - Improve cleaning logic to distinguish between "tuition" and "other" items more accurately.

#### [MODIFY] [reconciler.ts](file:///C:/Users/Administrator/EduEaz/hooks/admin-dashboard/finance-cleanup/reconciler.ts)
- Ensure `fullWaterfall` includes `"other charges"` explicitly.
- Update `extraTuitionCharges` to **only** include charges explicitly normalized as `"tuition"`. This prevents dynamic items (like "Lab Fee") from being wrongly added to the main Tuition bill.
- Update the `isHardcoded` check and aggregator logic to map both `"other charges"` and dynamic categories to the `otherBill`, `otherPaid`, and `otherBalance` fields on the student record.

---

### Dashboard Hooks

#### [MODIFY] [useFeeLedger.ts](file:///C:/Users/Administrator/EduEaz/hooks/admin-dashboard/useFeeLedger.ts)
- Align the manual payment settlement logic (`handleLogPayment`) with the renamed `"other charges"` category.
- Ensure the dynamic category waterfall correctly identifies and prioritizes named charges.
- Update the "Virtual Waterfall" for display to include the new naming and behavior.

#### [MODIFY] [useReceiptView.ts](file:///C:/Users/Administrator/EduEaz/hooks/useReceiptView.ts)
- Update the `nameMap` to use "Other Charges" consistently.
- Align the display waterfall logic with the reconciler's behavior to ensure the receipt breakdown matches the actual balances.

#### [MODIFY] [useOtherCharges.ts](file:///C:/Users/Administrator/EduEaz/hooks/admin-dashboard/useOtherCharges.ts)
- Verify that bulk and individual charges consistently use the `otherCategory` field.
- Ensure generic payments logged in this screen are normalized to `"other charges"`.

## Verification Plan

### Automated Tests
- Run `reconcileStudentBalances` with a mix of Tuition, PTA, and named "Other" charges (e.g., "Lab Fee").
- Verify that a generic payment for "other" settles "Other Charges" first.
- Verify that a specific payment for "Lab Fee" settles that item first.
- Verify that "Lab Fee" charges do NOT inflate the `termBill` (Tuition) field.

### Manual Verification
- Open the "Other Charges" screen and apply a bulk charge for "Mock Exam".
- Log a payment for a student and check the Student Ledger to see the waterfall allocation.
- View a Receipt to ensure the breakdown correctly shows the specific named items.
