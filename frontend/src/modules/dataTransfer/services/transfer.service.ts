import { requestHandler } from '../../auth/services/auth.service'
import type { ImportMode, ImportResult, TransferResource } from '../types/transfer.types'

const endpoint = (resource: TransferResource) =>
  resource === 'clients'
    ? 'clients/'
    : resource === 'products'
      ? 'catalog/'
      : 'inventory/'
const resourcePath = (resource: TransferResource) =>
  resource === 'warehouses' ? 'warehouses/' : resource === 'stocks' ? 'stocks/' : ''

export const transferService = {
  downloadTemplate: (resource: TransferResource) =>
    requestHandler.download(`${endpoint(resource)}${resourcePath(resource)}template/`, {
      params: { file_format: 'xlsx' },
    }),
  exportData: (
    resource: TransferResource,
    filters: Record<string, string | number | boolean | undefined>,
  ) =>
    requestHandler.download(`${endpoint(resource)}${resourcePath(resource)}export/`, {
      params: { ...filters, file_format: 'xlsx' },
    }),
  importFile: (resource: TransferResource, file: File, mode: ImportMode) => {
    const formData = new FormData()
    formData.append('file', file, file.name)
    formData.append('mode', mode)
    return requestHandler.post<ImportResult, FormData>(
      `${endpoint(resource)}${resourcePath(resource)}import/`,
      formData,
    )
  },
  downloadReport: (resource: TransferResource, errors: unknown[]) =>
    requestHandler.postDownload(
      `${endpoint(resource)}transfer/report/?resource=${resource}&file_format=xlsx`,
      {
        errors,
      },
    ),
}
