const APPROVED_ACADEMIC_RECORD_STATUSES = new Set([
  "approved",
  "partially_approved",
]);

function isApprovedAcademicRecordStatus(status) {
  return (
    typeof status === "string" &&
    APPROVED_ACADEMIC_RECORD_STATUSES.has(status.trim().toLowerCase())
  );
}

function isVisibleAcademicRecordStatus(status) {
  return isApprovedAcademicRecordStatus(status);
}

module.exports = {
  APPROVED_ACADEMIC_RECORD_STATUSES,
  isApprovedAcademicRecordStatus,
  isVisibleAcademicRecordStatus,
};
