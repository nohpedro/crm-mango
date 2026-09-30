import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BackupPage } from './BackupPage'
import { backupService } from '../services/backup.service'
import { AdminRoute } from '../../../routes/AdminRoute'
import { useAuthStore } from '../../../store/authStore'
import { adminUser } from '../../../test/factories'

const summary = {
  created_at: '2026-09-29T10:00:00Z',
  images: 2,
  counts: { Clientes: 10, Cotizaciones: 5 },
}
beforeEach(() => {
  useAuthStore.setState({ status: 'authenticated', user: adminUser })
  vi.spyOn(backupService, 'upload').mockResolvedValue(summary)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
function setup() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="/settings" element={<BackupPage />} />
          </Route>
          <Route path="/unauthorized" element={<p>Sin permiso</p>} />
          <Route path="/login" element={<p>Iniciar sesión</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return userEvent.setup()
}
function selectFile(name = 'backup.zip') {
  fireEvent.change(screen.getByLabelText(/Archivo de respaldo/), {
    target: { files: [new File(['zip'], name)] },
  })
}
describe('BackupPage', () => {
  it('requiere revisión y confirmación antes de restaurar y cierra sesión al terminar', async () => {
    const user = setup()
    selectFile()
    expect(
      screen.queryByRole('button', { name: 'Restaurar y reemplazar datos' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Revisar backup' }))
    expect(await screen.findByText('Backup listo para restaurar')).toBeInTheDocument()
    expect(backupService.upload).toHaveBeenCalledWith(expect.any(File), 'validate', '')
    expect(
      screen.getByRole('button', { name: 'Restaurar y reemplazar datos' }),
    ).toBeDisabled()
    await user.type(
      screen.getByLabelText('Escribe RESTAURAR para confirmar'),
      'RESTAURAR',
    )
    await user.click(screen.getByRole('button', { name: 'Restaurar y reemplazar datos' }))
    expect(backupService.upload).toHaveBeenCalledWith(
      expect.any(File),
      'restore',
      'RESTAURAR',
    )
    expect(await screen.findByText('Iniciar sesión')).toBeInTheDocument()
    expect(useAuthStore.getState().status).toBe('anonymous')
  })
  it('cambiar de archivo invalida la revisión anterior', async () => {
    const user = setup()
    selectFile()
    await user.click(screen.getByRole('button', { name: 'Revisar backup' }))
    await screen.findByText('Backup listo para restaurar')
    selectFile('otro.zip')
    expect(screen.queryByText('Backup listo para restaurar')).not.toBeInTheDocument()
    selectFile('no.xlsx')
    expect(screen.getByRole('alert')).toHaveTextContent('.zip')
    expect(screen.getByRole('button', { name: 'Revisar backup' })).toBeDisabled()
  })
  it('no ofrece restaurar archivos que no se pudieron validar', async () => {
    vi.mocked(backupService.upload).mockRejectedValueOnce(new Error('invalid'))
    const user = setup()
    selectFile()
    await user.click(screen.getByRole('button', { name: 'Revisar backup' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Restaurar y reemplazar datos' }),
    ).not.toBeInTheDocument()
  })
  it('restringe la pantalla a administradores', () => {
    useAuthStore.setState({ user: { ...adminUser, is_admin: false, permissions: [] } })
    setup()
    expect(screen.getByText('Sin permiso')).toBeInTheDocument()
    expect(screen.queryByText('Configuración · Backup')).not.toBeInTheDocument()
  })
})
