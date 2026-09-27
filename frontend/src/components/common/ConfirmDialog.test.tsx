import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

afterEach(cleanup)
describe('ConfirmDialog', () => {
  it('mantiene el foco en el diálogo y lo devuelve al cerrar', async () => {
    const user = userEvent.setup()
    const props = {
      title: 'Confirmar cambio',
      description: 'Revisa los datos antes de continuar.',
      confirmLabel: 'Confirmar',
      onConfirm: vi.fn(),
      onClose: vi.fn(),
    }
    const { rerender } = render(
      <>
        <button>Abrir</button>
        <ConfirmDialog {...props} open={false} />
      </>,
    )
    screen.getByRole('button', { name: 'Abrir' }).focus()
    rerender(
      <>
        <button>Abrir</button>
        <ConfirmDialog {...props} open />
      </>,
    )
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(props.onClose).toHaveBeenCalledOnce()
    rerender(
      <>
        <button>Abrir</button>
        <ConfirmDialog {...props} open={false} />
      </>,
    )
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus()
  })

  it('impide cerrar o confirmar de nuevo durante el procesamiento', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        pending
        title="Confirmar"
        description="Guardando cambios"
        confirmLabel="Guardar"
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Procesando…' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
