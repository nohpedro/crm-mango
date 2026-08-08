import { requestHandler } from '../../auth/services/auth.service'
import type {
  ImportOptions,
  ImportMode,
  ImportResult,
  TransferResource,
} from '../types/transfer.types'

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
  importFile: (
    resource: TransferResource,
    file: File,
    mode: ImportMode,
    options: ImportOptions = {},
  ) => {
    const formData = new FormData()
    formData.append('file', file, file.name)
    formData.append('mode', mode)
    if (resource === 'clients') {
      formData.append(
        'create_missing_client_types',
        String(Boolean(options.createMissingClientTypes)),
      )
      formData.append(
        'create_missing_price_levels',
        String(Boolean(options.createMissingPriceLevels)),
      )
    }
    if (resource === 'products') {
      formData.append(
        'create_missing_categories',
        String(Boolean(options.createMissingCategories)),
      )
    }
    return requestHandler.post<ImportResult, FormData>(
      `${endpoint(resource)}${resourcePath(resource)}import/`,
      formData,
    )
  },
  downloadReport: (resource: TransferResource, errors: unknown[]) => {
    const reportPath =
      resource === 'clients' || resource === 'products' ? 'report/' : 'transfer/report/'
    return requestHandler.postDownload(
      `${endpoint(resource)}${reportPath}?resource=${resource}&file_format=xlsx`,
      {
        errors,
      },
    )
  },
}
