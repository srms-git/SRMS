const CONTENT_KIND_BULLETIN = 'bulletin';
const CONTENT_KIND_FEATURED_STORY = 'featured_story';
const FEATURED_STORY_CUSTOM_TYPE = 'featured story';
const MAX_FEATURED_STORY_IMAGES = 5;
const MAX_FEATURED_STORIES_WITH_IMAGES = 5;

function resolveContentKind(body, typeFields = {}) {
    const raw = String(body?.contentKind ?? '').trim();
    if (raw === CONTENT_KIND_FEATURED_STORY || raw === CONTENT_KIND_BULLETIN) {
        return raw;
    }

    if (
        typeFields.type === 'other' &&
        String(typeFields.customType ?? '').trim().toLowerCase() === FEATURED_STORY_CUSTOM_TYPE
    ) {
        return CONTENT_KIND_FEATURED_STORY;
    }

    return CONTENT_KIND_BULLETIN;
}

function isFeaturedStoryRecord(record) {
    if (!record) return false;
    if (record.contentKind === CONTENT_KIND_FEATURED_STORY) return true;
    return (
        record.type === 'other' &&
        String(record.customType ?? '').trim().toLowerCase() === FEATURED_STORY_CUSTOM_TYPE
    );
}

function featuredStoryHasImages(record) {
    if (!record) return false;
    return Array.isArray(record.images) && record.images.length > 0;
}

async function countFeaturedStoriesWithImages(Announcement, excludeId = null) {
    const records = await Announcement.find({
        $or: [
            { contentKind: CONTENT_KIND_FEATURED_STORY },
            {
                type: 'other',
                customType: { $regex: new RegExp(`^${FEATURED_STORY_CUSTOM_TYPE}$`, 'i') },
            },
        ],
        'images.0': { $exists: true },
    }).select('_id');

    if (!excludeId) return records.length;
    return records.filter((record) => String(record._id) !== String(excludeId)).length;
}

module.exports = {
    CONTENT_KIND_BULLETIN,
    CONTENT_KIND_FEATURED_STORY,
    MAX_FEATURED_STORY_IMAGES,
    MAX_FEATURED_STORIES_WITH_IMAGES,
    resolveContentKind,
    isFeaturedStoryRecord,
    featuredStoryHasImages,
    countFeaturedStoriesWithImages,
};
