/**
 * Content types for uploads to the private `cvs` bucket.
 *
 * The bucket only accepts the MIME types below (migration 047). Browsers don't
 * always report one (some Android pickers send '' for .docx), so uploads set
 * the type from the file extension instead of trusting File.type.
 */
const BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

/** Bucket-wide size cap, kept in step with the bucket's file_size_limit. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const CV_EXTENSIONS = ['pdf', 'doc', 'docx'] as const

export function fileExtension(name: string): string {
  return name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : ''
}

/** MIME type to upload with, or null when the bucket would refuse the file. */
export function uploadContentType(file: File): string | null {
  return BY_EXT[fileExtension(file.name)] ?? null
}
