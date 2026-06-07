import { getApiClientBaseUrl } from "@/lib/apiConfig"

export const MAX_ANNOUNCEMENT_IMAGES = 8
export const MAX_ANNOUNCEMENT_IMAGE_MB = 20
export const MAX_ANNOUNCEMENT_IMAGE_BYTES = MAX_ANNOUNCEMENT_IMAGE_MB * 1024 * 1024

const UPLOAD_OPTIMIZE_MAX_WIDTH = 1600
const UPLOAD_OPTIMIZE_JPEG_QUALITY = 0.82
const SKIP_CLIENT_OPTIMIZE_TYPES = new Set(["image/gif"])

/**
 * Resize large photos in the browser before upload so multiple large files
 * can be sent together without timing out or exhausting server memory.
 */
export async function optimizeAnnouncementImageForUpload(file) {
  if (!file?.type?.startsWith("image/") || SKIP_CLIENT_OPTIMIZE_TYPES.has(file.type)) {
    return file
  }

  if (typeof createImageBitmap !== "function") {
    return file
  }

  let bitmap
  try {
    bitmap = await createImageBitmap(file)
    const longestEdge = Math.max(bitmap.width, bitmap.height)
    if (longestEdge <= UPLOAD_OPTIMIZE_MAX_WIDTH && file.size <= 2 * 1024 * 1024) {
      bitmap.close()
      return file
    }

    const scale = Math.min(1, UPLOAD_OPTIMIZE_MAX_WIDTH / longestEdge)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) {
      bitmap.close()
      return file
    }

    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", UPLOAD_OPTIMIZE_JPEG_QUALITY)
    })
    if (!blob) return file

    const baseName = (file.name || "image").replace(/\.[^.]+$/, "") || "image"
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    })
  } catch {
    bitmap?.close?.()
    return file
  }
}

export async function prepareAnnouncementImageFiles(files) {
  const prepared = []
  for (const file of files) {
    prepared.push(await optimizeAnnouncementImageForUpload(file))
  }
  return prepared
}

export function getAnnouncementImageUrl(announcementId, imageIndex = 0, cacheKey = "") {
  if (!announcementId) return null
  const base = `${getApiClientBaseUrl()}/announcements/${announcementId}/images/${imageIndex}`
  if (!cacheKey) return base
  return `${base}?v=${encodeURIComponent(cacheKey)}`
}

function getAnnouncementImageCacheKey(item) {
  const stamp = item?.updatedAt || item?.createdAt
  if (!stamp) return ""
  const time = new Date(stamp).getTime()
  return Number.isNaN(time) ? "" : String(time)
}

export function resolveAnnouncementImageUrls(item) {
  if (!item) return []
  const id = item.id || item._id
  if (id && Array.isArray(item.images) && item.images.length > 0) {
    const cacheKey = getAnnouncementImageCacheKey(item)
    return item.images.map((_, index) => getAnnouncementImageUrl(id, index, cacheKey))
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

export async function draftImagesToUploadFiles(draftImages, announcementId) {
  const files = []
  for (const image of draftImages) {
    if (image.file) {
      files.push(image.file)
      continue
    }
    if (image.isExisting) {
      const fetchUrl =
        announcementId != null && Number.isInteger(image.existingIndex)
          ? getAnnouncementImageUrl(announcementId, image.existingIndex)
          : image.previewUrl
      if (!fetchUrl) continue

      const response = await fetch(fetchUrl)
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
