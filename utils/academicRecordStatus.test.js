const test = require("node:test");
const assert = require("node:assert/strict");

const { isVisibleAcademicRecordStatus } = require("./academicRecordStatus");

test("approved states are visible to teachers and parents", () => {
  assert.equal(isVisibleAcademicRecordStatus("approved"), true);
  assert.equal(isVisibleAcademicRecordStatus("partially_approved"), true);
});

test("non-published states remain hidden from teacher and parent views", () => {
  assert.equal(isVisibleAcademicRecordStatus("pending"), false);
  assert.equal(isVisibleAcademicRecordStatus("draft"), false);
  assert.equal(isVisibleAcademicRecordStatus("rejected"), false);
  assert.equal(isVisibleAcademicRecordStatus(undefined), false);
});
