const { sanitizeGranteeOtherPersonFields } = require('./granteeOtherPersonFields');

const GRANTEE_UPDATE_FIELDS = [
    'program',
    'batchNo',
    'academicYear',
    'seqNo',
    'studentId',
    'awardNumber',
    'fullName',
    'enrolledProgram',
    'yearLevel',
    'status',
    'active',
    'inactiveRemarks',
    'email',
    'phoneNumber',
    'bankAccount',
    'grantCycle',
    'semesterClaims',
    'requirementChecklistByYearSem',
    'enrolledProgramArchives',
];

function pickGranteeUpdateFields(body) {
    const source = body && typeof body === 'object' ? body : {};
    const sanitized = sanitizeGranteeOtherPersonFields(source);
    const update = {};

    for (const key of GRANTEE_UPDATE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
            update[key] = sanitized[key];
        }
    }

    return update;
}

module.exports = {
    GRANTEE_UPDATE_FIELDS,
    pickGranteeUpdateFields,
};
