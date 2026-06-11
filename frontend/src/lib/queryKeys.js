export const queryKeys = {
  grantees: ["grantees"],
  archivedBatches: ["archivedBatches"],
  notifications: ["notifications"],
  announcements: ["announcements"],
  claimHistory: ["claimHistory"],
  programGrantees: (programCode) => ["programGrantees", programCode],
  batchGrantees: (program, batchNo, academicYear) => ["batchGrantees", program, batchNo, academicYear],
  archivedBatchDetail: (batchNo, program, academicYear) => [
    "archivedBatchDetail",
    batchNo,
    program,
    academicYear,
  ],
}
