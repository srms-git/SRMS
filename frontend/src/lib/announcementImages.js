import { getApiClientBaseUrl } from "@/lib/apiConfig"

export const MAX_ANNOUNCEMENT_IMAGES = 8

export function getAnnouncementImageUrl(announcementId, imageIndex = 0) {
  if (!announcementId) return null
  return `${getApiClientBaseUrl()}/announcements/${announcementId}/images/${imageIndex}`
}

export function resolveAnnouncementImageUrls(item) {
  if (!item) return []
  const id = item.id || item._id
  if (id && Array.isArray(item.images) && item.images.length > 0) {
    return item.images.map((_, index) => getAnnouncementImageUrl(id, index))
  }
  if (typeof item.image === "string" && item.image) return [item.image]
  if (item.imageUrl) return [item.imageUrl]
  return []
}

export function resolveAnnouncementImageUrl(item, imageIndex = 0) {
  return resolveAnnouncementImageUrls(item)[imageIndex] ?? null
}

export function normalizeAnnouncementImages(item) {
  const id = item.id || item._id
  const imageUrls = resolveAnnouncementImageUrls({ ...item, id })
  return {
    ...item,
    id,
    imageUrls,
    imageUrl: imageUrls[0] ?? null,
  }
}

export async function draftImagesToUploadFiles(draftImages) {
  const files = []
  for (const image of draftImages) {
    if (image.file) {
      files.push(image.file)
      continue
    }
    if (image.isExisting && image.previewUrl) {
      const response = await fetch(image.previewUrl)
      if (!response.ok) {
        throw new Error("Failed to prepare existing images for upload.")
      }
      const blob = await response.blob()
      files.push(
        new File([blob], image.fileName || "announcement-image.jpg", {
          type: blob.type || "image/jpeg",
        }),
      )
    }
  }
  return files
}
