import { RequestHandler } from '../../../services/RequestHandler'

// Backups can take longer than normal CRUD requests.
const request = new RequestHandler({ timeout: 300_000 })
export type BackupSummary = {
  created_at: string
  images: number
  counts: Record<string, number>
}
export const backupService = {
  download: () => request.download('settings/backup/export/'),
  upload: (file: File, action: 'validate' | 'restore', confirmation = '') =>
    request.postMultipart<BackupSummary>('settings/backup/import/', {
      files: { file },
      fields: { action, confirmation },
    }),
}
