const { sanitizeContactNumber } = require('./contactNumber');

const REQUIREMENT_CONTACT_KEYS = new Set([
    'firstSubmittedOtherContact',
    'secondSubmittedOtherContact',
]);

function sanitizeSemesterClaim(claim) {
    if (!claim || typeof claim !== 'object') return claim;
    return {
        ...claim,
        firstSemOtherContact: sanitizeContactNumber(claim.firstSemOtherContact),
        secondSemOtherContact: sanitizeContactNumber(claim.secondSemOtherContact),
    };
}

function sanitizeRequirementChecklistByYearSem(checklist) {
    if (!checklist || typeof checklist !== 'object') return checklist;

    const out = {};
    for (const [yearLevel, slice] of Object.entries(checklist)) {
        if (!slice || typeof slice !== 'object') {
            out[yearLevel] = slice;
            continue;
        }

        const nextSlice = { ...slice };
        for (const key of REQUIREMENT_CONTACT_KEYS) {
            if (typeof nextSlice[key] === 'string') {
                nextSlice[key] = sanitizeContactNumber(nextSlice[key]);
            }
        }
        out[yearLevel] = nextSlice;
    }
    return out;
}

function sanitizeGranteeOtherPersonFields(updateBody) {
    const next = { ...updateBody };

    if (Array.isArray(next.semesterClaims)) {
        next.semesterClaims = next.semesterClaims.map(sanitizeSemesterClaim);
    }

    if (next.requirementChecklistByYearSem && typeof next.requirementChecklistByYearSem === 'object') {
        next.requirementChecklistByYearSem = sanitizeRequirementChecklistByYearSem(next.requirementChecklistByYearSem);
    }

    return next;
}

module.exports = {
    sanitizeGranteeOtherPersonFields,
    sanitizeRequirementChecklistByYearSem,
    sanitizeSemesterClaim,
};
