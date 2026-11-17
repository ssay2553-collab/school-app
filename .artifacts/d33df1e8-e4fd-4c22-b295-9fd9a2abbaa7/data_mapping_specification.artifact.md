# EduEaz AI Admin Report Generator: Data-Mapping Specification

This data-mapping specification outlines the precise source-of-truth Firestore collections, internal records, and administrator input requirements feeding each of the 12 sections of the Comprehensive Official Administrative Report.

---

## 1. Data-Mapping Overview Matrix

| Section | Report Section Name | Primary EduEaz Firestore Collections / Sources | Automated vs. Admin Input |
| :--- | :--- | :--- | :--- |
| **1** | Executive Summary & Strategic Health | `users`, `attendance`, `studentFeeRecords`, `feePayments`, `expenditures`, `academicRecords` | **Automated** (Aggregated live stats & AI health analysis) |
| **2** | Student Enrolment, Population & Demographics | `users`, `student_charges` | **Mixed** (Enrolment counts automated; gender/withdrawals via Admin Placeholder) |
| **3** | Student Attendance & Campus Engagement | `attendance` | **Mixed** (Attendance rate automated; absentee/lateness patterns via Admin Placeholder) |
| **4** | Academic Performance & Instructional Standards | `academicRecords` | **Mixed** (Averages & top classes automated; grade spread via Admin Placeholder) |
| **5** | Teacher Attendance, Punctuality & Staff Performance | `users` (Staff role), `attendance` | **Mixed** (Staff count automated; lesson notes & appraisals via Admin Placeholder) |
| **6** | Parent Communication & Community Engagement | `users` (Parent role), Portal notification logs | **Mixed** (Registered parents automated; PTA meeting notes via Admin Placeholder) |
| **7** | Infrastructure, Maintenance & Facility Management | Facility audit logs | **Admin Input** (Maintenance & facility repair logs via Admin Placeholder) |
| **8** | Co-Curricular, Sports & Special School Events | Co-curricular calendar logs | **Admin Input** (Sports results, cultural events, awards via Admin Placeholder) |
| **9** | Financial Performance & Fee Ledger Breakdown | `studentFeeRecords`, `feePayments`, `dailyFinancials`, `expenditures` | **Strictly Automated** (Protected live financial records from EduEaz ledger) |
| **10** | Challenges Encountered & Risk Assessment | Synthesized from Sections 1–9 metrics | **Automated** (AI Evidence-Based Risk Analysis) |
| **11** | Prioritized Strategic Recommendations | Synthesized from financial & attendance findings | **Automated** (AI Evidence-Based Recommendations with Actionable Parameters) |
| **12** | Admin Enhancement & Additional Observations | Admin Portal Edit Workspace | **Admin Input** (Proprietor/Headteacher remarks, uncaptured events & signatures) |

---

## 2. Detailed Section-by-Section Data Source Specification

### Section 1: Executive Summary & Strategic Health
- **Total Students & Staff:** Queried from `users` collection where `role == "student"` (active) and `role in ["teacher", "staff", "admin", "superadmin"]`.
- **Attendance Percentage:** Aggregated from `attendance` collection for the selected term and academic year.
- **Financial Totals:** Billed, collected, and arrears aggregated from `studentFeeRecords` and `feePayments`.
- **Achievements & Challenges:** Synthesized programmatically from collection efficiency and attendance rates.

### Section 2: Student Enrolment, Population & Demographics
- **Registered Students:** Count of active student documents in `users`.
- **Class Distribution:** Grouped by `data.className` or `data.classId`.
- **New Admissions:** Queried from `student_charges` where fee type or category matches "admission".
- **Disaggregations (Gender, Withdrawals, Transferred, Promoted):** Provided via standardized administrator placeholders in the edit workspace.

### Section 3: Student Attendance & Campus Engagement
- **Attendance Rate:** Computed as `(Present Count / Total Attendance Records) * 100` from `attendance`.
- **Absenteeism & Lateness Patterns:** Flagged via automated threshold analysis or enhanced via admin input.

### Section 4: Academic Performance & Instructional Standards
- **Average Scores & Top Classes:** Aggregated from `academicRecords` filtering by `academicYear` and `term`.
- **Subject Analysis & Grade Spreads:** Subject averages computed from terminal scores; grade distribution curves populated via admin placeholders.

### Section 5: Teacher Attendance, Punctuality & Staff Performance
- **Staff Count & Attendance:** Queried from `users` (staff roles) and staff attendance logs.
- **Appraisals & Lesson Notes:** Department head evaluations and compliance notes populated via admin input placeholders.

### Section 6: Parent Communication & Community Engagement
- **Registered Parents:** Active parent user accounts linked in EduEaz.
- **Portal Adoption & Notifications:** PWA broadcast logs and PTA meeting records populated via admin input.

### Section 7: Infrastructure, Maintenance & Facility Management
- **Facility Audits:** Classroom conditions, sanitation, and utility statuses captured via structured admin placeholders.

### Section 8: Co-Curricular, Sports & Special School Events
- **Event Logs:** Inter-house sports outcomes, cultural festivals, and excursions captured via admin input placeholders.

### Section 9: Financial Performance & Fee Ledger Breakdown (Protected)
- **Tuition Billed:** Sum of `termBill` across active student fee records matching term/year.
- **Tuition Collected:** Sum of verified `feePayments` and `dailyFinancials` auxiliary receipts.
- **Outstanding Arrears:** `Total Billed - Total Paid - Discounts`.
- **Expenditures:** Sum of `expenditures` collection matching term/year.
- **Net Position:** `Total Collected - Total Expenditure`.

### Section 10: Challenges Encountered & Risk Assessment
- **AI Synthesis:** Programmatically generated based on deficit/surplus states, arrears balances, and attendance compliance.

### Section 11: Prioritized Strategic Recommendations
- **Evidence-Based Matching:** Automatically maps problems (e.g., collection efficiency < 75%, attendance < 80%) to targeted operational actions, priority levels, departments, timelines, and expected outcomes.

### Section 12: Admin Enhancement & Additional Observations
- **Executive Sign-Off & Remarks:** Dedicated input areas for Proprietor's remarks, Headteacher's remarks, uncaptured events, management decisions, and digital signature lines.
