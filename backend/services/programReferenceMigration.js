const Grantee = require('../models/GranteeModel');
const ClaimHistory = require('../models/ClaimHistoryModel');
const LandingBatch = require('../models/LandingBatchModel');
const Archive = require('../models/ArchiveModel');

/**
 * Updates grantee, batch, claim, and archive records when a program code is renamed.
 */
async function migrateProgramReferences(oldCode, newCode) {
    const oldUpper = String(oldCode || '').trim().toUpperCase();
    const newUpper = String(newCode || '').trim().toUpperCase();

    if (!oldUpper || !newUpper || oldUpper === newUpper) {
        return { grantees: 0, claimHistory: 0, landingBatches: 0, archives: 0, awardNumbers: 0 };
    }

    const [grantees, claimHistory, landingBatches, archives] = await Promise.all([
        Grantee.updateMany({ program: oldUpper }, { $set: { program: newUpper } }),
        ClaimHistory.updateMany({ program: oldUpper }, { $set: { program: newUpper } }),
        LandingBatch.updateMany({ program: oldUpper }, { $set: { program: newUpper } }),
        Archive.updateMany({ grantType: oldUpper }, { $set: { grantType: newUpper } }),
    ]);

    const grantCyclePattern = new RegExp(oldUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const granteesWithCycle = await Grantee.find({
        grantCycle: { $regex: grantCyclePattern },
    }).select('_id grantCycle');

    let grantCyclesUpdated = 0;
    for (const doc of granteesWithCycle) {
        const nextCycle = String(doc.grantCycle || '').replace(grantCyclePattern, newUpper);
        if (nextCycle !== doc.grantCycle) {
            doc.grantCycle = nextCycle;
            await doc.save();
            grantCyclesUpdated += 1;
        }
    }

    const awardPrefix = new RegExp(`^${oldUpper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-`, 'i');
    const granteesWithAward = await Grantee.find({ awardNumber: awardPrefix }).select('_id awardNumber');
    let awardNumbersUpdated = 0;
    for (const doc of granteesWithAward) {
        const nextAward = String(doc.awardNumber || '').replace(awardPrefix, `${newUpper}-`);
        if (nextAward !== doc.awardNumber) {
            doc.awardNumber = nextAward;
            await doc.save();
            awardNumbersUpdated += 1;
        }
    }

    return {
        grantees: grantees.modifiedCount ?? 0,
        claimHistory: claimHistory.modifiedCount ?? 0,
        landingBatches: landingBatches.modifiedCount ?? 0,
        archives: archives.modifiedCount ?? 0,
        grantCycles: grantCyclesUpdated,
        awardNumbers: awardNumbersUpdated,
    };
}

module.exports = { migrateProgramReferences };
