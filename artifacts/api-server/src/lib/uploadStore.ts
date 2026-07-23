/**
 * In-memory store mapping uploadId → file info.
 * Entries persist for the lifetime of the server process.
 * In production with Supabase Storage this module will be replaced
 * by a lookup against the storage bucket.
 */
export interface UploadEntry {
  filePath: string;
  originalName: string;
  sizeBytes: number;
}

export const uploadStore = new Map<string, UploadEntry>();
