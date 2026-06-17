import { isOtherAnnouncementType } from "@/lib/announcementTypes"

export const CONTENT_KIND_BULLETIN = "bulletin"
export const CONTENT_KIND_FEATURED_STORY = "featured_story"
export const FEATURED_STORY_CUSTOM_TYPE = "Featured story"
export const MAX_FEATURED_STORY_IMAGES = 5
export const MAX_FEATURED_STORIES_WITH_IMAGES = 5

export function featuredStoryHasImages(item) {
  if (!item) return false
  if (Array.isArray(item.imageUrls) && item.imageUrls.length > 0) return true
  if (Array.isArray(item.images) && item.images.length > 0) return true
  return Boolean(item.imageUrl || item.image)
}

export function countFeaturedStoriesWithImages(records = [], excludeId = null) {
  let count = 0
  for (const item of records) {
    if (!isFeaturedStoryAnnouncement(item)) continue
    const id = item.id || item._id
    if (excludeId != null && String(id) === String(excludeId)) continue
    if (featuredStoryHasImages(item)) count += 1
  }
  return count
}

export function isFeaturedStoryAnnouncement(item) {
  if (!item) return false
  if (item.contentKind === CONTENT_KIND_FEATURED_STORY) return true
  return (
    isOtherAnnouncementType(item.type) &&
    String(item.customType ?? "")
      .trim()
      .toLowerCase() === FEATURED_STORY_CUSTOM_TYPE.toLowerCase()
  )
}

export function resolveAnnouncementContentKind(item) {
  return isFeaturedStoryAnnouncement(item) ? CONTENT_KIND_FEATURED_STORY : CONTENT_KIND_BULLETIN
}

export function partitionAnnouncementsByContentKind(records = []) {
  const featuredStories = []
  const bulletins = []

  for (const item of records) {
    if (isFeaturedStoryAnnouncement(item)) {
      featuredStories.push(item)
    } else {
      bulletins.push(item)
    }
  }

  return { featuredStories, bulletins }
}
