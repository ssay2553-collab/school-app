# Standardize Financial Waterfall Logic

This plan standardizes the financial allocation order (waterfall) across the Ledger, Reconciler, and Receipt View to ensure consistency in how student payments are applied to debts.

## User Review Required

> [!IMPORTANT]
> The waterfall order will be strictly enforced as:
> 1. **Previous Terms Arrears** (Total debt from all categories in past terms)
> 2. **Tuition Fee** (Current term)
> 3. **Maintenance**
> 4. **PTA**
> 5. **Other Charges** (Dynamic items like Exams, Mocks, etc.)
> 6. **Admission**
> 7. **Books**
> 8. **Uniform**
> 9. **Surplus** (Excess funds)
>
> Any overpayments will be explicitly labeled as **"Surplus"** in the UI instead of showing negative balances.

## Proposed Changes

### [Finance Utilities]

#### [MODIFY] [utils.ts](file:///C:/Users/Administrator/EduEaz/hooks/admin-dashboard/finance-cleanup/utils.ts)
- Update `waterfallOrder` to match the new sequence.
- Add `getOrderedCategories(dynamicCategories: string[])` helper to inject dynamic "Other Charges" at the correct priority (position 5).
- Ensure `normalizeCategory` correctly identifies these types.

### [Background Reconciler]

#### [MODIFY] [reconciler.ts](file:///C:/Users/Administrator/EduEaz/hooks/admin-dashboard/finance-cleanup/reconciler.ts)
- Restructure the term loop to settle **Arrears first** (across all categories) before applying payments to current term bills.
- Implement the strict waterfall sequence for both Arrears and Current Bills.
- Ensure record updates use `Math.max(0, balance)` and store excess in a `surplus` field or `walletBalance`.

### [Fee Ledger Hook]

#### [MODIFY] [useFeeLedger.ts](file:///C:/Users/Administrator/EduEaz/hooks/admin-dashboard/useFeeLedger.ts)
- Reorder `isolatedTargets` to follow: Maintenance, PTA.
- Inject the dynamic waterfall (Other Charges) before processing Admission, Books, and Uniform.
- Rename `tuition_credit` payment type to `surplus`.
- Synchronize the "Arrears first" logic when processing the initial `tuitionContribution`.

### [Receipt View Hook]

#### [MODIFY] [useReceiptView.ts](file:///C:/Users/Administrator/EduEaz/hooks/useReceiptView.ts)
- Update `displayWaterfallOrder` to match the new sequence.
- Update `nameMap` to display "Surplus" for overpayments.
- Ensure the `categorySummary` virtual waterfall aligns perfectly with the Ledger and Reconciler.

## Verification Plan

### Automated Tests
- I will verify the logic by dry-running the reconciler (via a scratch script if needed) against known student records with mixed debts (e.g., PTA Arrears + Tuition Bill).

### Manual Verification
- Check the **Admin Dashboard -> Fee Ledger** to see if a payment settles Maintenance and PTA before Admission.
- Check the **Receipt View** for a student with an overpayment to confirm it shows "Surplus" instead of a negative Tuition balance.
