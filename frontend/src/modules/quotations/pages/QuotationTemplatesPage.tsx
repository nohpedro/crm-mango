import {
  FilePlus2,
  ImagePlus,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Undo2,
  X,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { ConfirmDialog } from '../../../components/common/ConfirmDialog'
import { PageHeading } from '../../../components/common/PageHeading'
import { getAdminErrorMessage } from '../../admin/components/AdminError'
import {
  useQuotationTemplateMutations,
  useQuotationTemplates,
} from '../hooks/useQuotations'
import type {
  QuotationTemplate,
  QuotationTemplateLayout,
  QuotationTemplateSection,
} from '../types/quotation.types'

const MAX_ROWS = 120
const EDITOR_ROW_HEIGHT_MM = 1.5
const EDITOR_GAP_SCALE = 0.3125
const STANDARD_FRAME_HEIGHT_MM = 279 - 9 - 12 - (12 * 25.4) / 72
const STANDARD_HEADER_GAP_MM = 5
const layoutDefault: QuotationTemplateLayout = {
  page_width_mm: 216,
  page_height_mm: 279,
  roll_width_mm: 80,
  roll_height_mm: 190,
  box_padding_mm: 4,
  header_image_id: null,
  header_height_mm: 24,
  header_image_width_mm: 43,
  header_image_height_mm: 16,
  header_company_font_size: 14,
  header_subtitle_font_size: 8,
  header_document_title: 'COTIZACI\u00d3N',
  header_document_title_font_size: 12,
  columns: 12,
  column_gap_mm: 1,
  row_gap_mm: 1,
  column_widths: Array(12).fill(1),
}
const baseSections = [
  [
    'company',
    'Información de la empresa',
    'IDESEM S.R.L.\nSoluciones comerciales y técnicas',
  ],
  ['client', 'Información del cliente', ''],
  ['items', 'Detalle de productos', ''],
  ['totals', 'Totales', ''],
  [
    'commercial_terms',
    'Condiciones comerciales',
    'Precios expresados en bolivianos. Disponibilidad sujeta a confirmación.',
  ],
  ['validity', 'Vigencia de la cotización', ''],
  [
    'bank_details',
    'Datos para el pago',
    'Banco BNB · Cuenta: 1000301171 · Titular: IDESEM S.R.L.',
  ],
  ['contact', 'Contacto', 'IDESEM S.R.L. · Atención comercial'],
  ['notes', 'Observaciones', ''],
  ['signature', 'Responsable', 'IDESEM S.R.L.\nGracias por su preferencia.'],
] as const
const defaultSections = (() => {
  let row = 1
  return baseSections.map(([key, title, content], index) => {
    const rowSpan = suggestedRows({ key, content })
    const item: QuotationTemplateSection = {
      key,
      title,
      content,
      visible: true,
      order: index * 10 + 10,
      type: 'system',
      show_savings: key === 'totals',
      grid_row: row,
      grid_column: 1,
      column_span: 12,
      row_span: rowSpan,
      horizontal_align: 'left',
      vertical_align: 'top',
      ...styleDefault(),
    }
    row += rowSpan + 2
    return item
  })
})()
const newTemplate = () => ({
  name: 'Nueva plantilla',
  description: '',
  is_active: true,
  is_default: false,
  layout: { ...layoutDefault },
  sections: defaultSections.map((item) => ({ ...item })),
})

export function QuotationTemplatesPage() {
  const templates = useQuotationTemplates()
  const mutations = useQuotationTemplateMutations()
  const imageInput = useRef<HTMLInputElement>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draft, setDraft] = useState(newTemplate)
  const [deleteTemplateOpen, setDeleteTemplateOpen] = useState(false)
  const orderedTemplates = useMemo(
    () =>
      [...(templates.data ?? [])].sort(
        (left, right) =>
          Number(right.is_default) - Number(left.is_default) ||
          left.name.localeCompare(right.name, 'es'),
      ),
    [templates.data],
  )
  const currentTemplate = templates.data?.find((item) => item.id === selectedId)
  const select = (template: QuotationTemplate) => {
    const previousColumns = template.layout.columns ?? 1
    const layout = {
      ...layoutDefault,
      ...template.layout,
      columns: 12,
      column_widths: Array(12).fill(1),
      column_gap_mm: Math.min(template.layout.column_gap_mm ?? 1, 2),
      row_gap_mm: Math.min(template.layout.row_gap_mm ?? 1, 2),
    }
    const sections = repairGrid(
      template.sections.map((section, index) =>
        withVisualDefaults({
          ...section,
          grid_row: section.grid_row ?? index * 9 + 1,
          grid_column: Math.max(
            1,
            Math.round((((section.grid_column ?? 1) - 1) / previousColumns) * 12) + 1,
          ),
          column_span: Math.max(
            1,
            Math.round(
              ((section.column_span ?? previousColumns) / previousColumns) * 12,
            ),
          ),
        }),
      ),
      layout.columns,
    )
    setSelectedId(template.id)
    setDraft({
      name: template.name,
      description: template.description,
      is_active: template.is_active,
      is_default: template.is_default,
      layout: constrainHeaderLayout(layout, sections),
      sections,
    })
  }
  const setLayout = (patch: Partial<QuotationTemplateLayout>) =>
    setDraft((value) => ({ ...value, layout: { ...value.layout, ...patch } }))
  const save = () => {
    const layout = constrainHeaderLayout(draft.layout, draft.sections)
    const payload = {
      ...draft,
      layout,
      name: draft.name.trim(),
      description: draft.description.trim(),
    }
    if (!payload.name) return toast.error('Escribe un nombre para la plantilla.')
    const operation = selectedId
      ? mutations.update.mutateAsync({ id: selectedId, payload })
      : mutations.create.mutateAsync(payload)
    void operation
      .then((result) => {
        toast.success('Plantilla guardada.')
        select(result)
      })
      .catch((error: unknown) =>
        toast.error(getAdminErrorMessage(error, 'No se pudo guardar la plantilla.')),
      )
  }
  const upload = async (file?: File) => {
    if (!file) return
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    )
      return toast.error('Usa una imagen JPG, PNG o WEBP de máximo 5 MB.')
    try {
      let templateId = selectedId
      if (!templateId) {
        const layout = constrainHeaderLayout(draft.layout, draft.sections)
        const payload = {
          ...draft,
          layout,
          name: draft.name.trim(),
          description: draft.description.trim(),
        }
        if (!payload.name)
          return toast.error(
            'Escribe un nombre para la plantilla antes de subir una imagen.',
          )
        const created = await mutations.create.mutateAsync(payload)
        select(created)
        templateId = created.id
        toast.success('Plantilla guardada para añadir la imagen.')
      }
      await mutations.uploadImage.mutateAsync({ template: templateId, image: file })
      toast.success('Imagen subida.')
    } catch (error) {
      toast.error(getAdminErrorMessage(error, 'No se pudo subir la imagen.'))
    }
  }
  const removeTemplate = () => {
    if (!selectedId) return
    void mutations.remove
      .mutateAsync(selectedId)
      .then(() => {
        setSelectedId(null)
        setDraft(newTemplate())
        toast.success('Plantilla eliminada.')
      })
      .catch((error: unknown) =>
        toast.error(getAdminErrorMessage(error, 'No se pudo eliminar la plantilla.')),
      )
      .finally(() => setDeleteTemplateOpen(false))
  }
  return (
    <>
      <PageHeading
        title="Plantillas de cotización"
        description="Diseña la hoja, recupera secciones y edita el contenido sin conocimientos técnicos."
        action={
          <Link
            to="/quotations"
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
          >
            Volver a cotizaciones
          </Link>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[17rem_1fr]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setSelectedId(null)
              setDraft(newTemplate())
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
          >
            <FilePlus2 className="size-4" /> Nueva plantilla
          </button>
          <div className="mt-4 space-y-2">
            {orderedTemplates.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => select(item)}
                className={`w-full rounded-xl border p-3 text-left text-sm ${selectedId === item.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}
              >
                <b className="block text-slate-800">{item.name}</b>
                <span className="text-xs text-slate-500">
                  {item.is_default
                    ? 'Predeterminada'
                    : item.description || 'Sin descripción'}
                </span>
              </button>
            ))}
          </div>
        </aside>
        <main className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Nombre"
              value={draft.name}
              onChange={(name) => setDraft((value) => ({ ...value, name }))}
            />
            <Field
              label="Descripción"
              value={draft.description}
              onChange={(description) => setDraft((value) => ({ ...value, description }))}
            />
          </div>
          <div className="mt-3 flex gap-5 text-sm font-semibold">
            <label>
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    is_active: event.target.checked,
                    is_default: event.target.checked ? value.is_default : false,
                  }))
                }
              />{' '}
              Disponible
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.is_default}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    is_default: event.target.checked,
                    is_active: event.target.checked ? true : value.is_active,
                  }))
                }
              />{' '}
              Predeterminada
            </label>
          </div>
          <VisualEditor
            sections={draft.sections}
            layout={draft.layout}
            images={currentTemplate?.images ?? []}
            onChange={(sections, layout) =>
              setDraft((value) => ({
                ...value,
                sections,
                layout: { ...value.layout, ...layout },
              }))
            }
          />
          <section className="mt-5 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <b>Imágenes</b>
                <p className="text-sm text-slate-500">
                  Úsalas en el encabezado o como sección.
                </p>
              </div>
              <button
                type="button"
                onClick={() => imageInput.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold"
              >
                <ImagePlus className="size-4" /> Subir
              </button>
              <input
                ref={imageInput}
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  void upload(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {currentTemplate?.images.map((image) => (
                <div key={image.id} className="rounded-lg border p-2">
                  <img
                    src={image.image}
                    alt="Imagen"
                    className="h-20 w-full object-contain"
                  />
                  <div className="mt-2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setLayout({ header_image_id: image.id })}
                      className="rounded bg-brand-50 px-2 py-1 text-xs font-bold"
                    >
                      Encabezado
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((value) => ({
                          ...value,
                          sections: place(
                            value.sections,
                            {
                              key: `image-${Date.now()}`,
                              type: 'image',
                              image_id: image.id,
                              title: 'Imagen',
                              content: '',
                              visible: true,
                              order: 999,
                              grid_row: 1,
                              grid_column: 1,
                              column_span: value.layout.columns,
                              row_span: 15,
                              ...styleDefault(),
                            },
                            value.layout.columns,
                          ),
                        }))
                      }
                      className="rounded bg-slate-100 px-2 py-1 text-xs font-bold"
                    >
                      A hoja
                    </button>
                    <button
                      type="button"
                      onClick={() => void mutations.removeImage.mutateAsync(image.id)}
                      className="ml-auto text-red-700"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={save}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white"
            >
              <Save className="size-4" /> Guardar
            </button>
            {selectedId && (
              <button
                type="button"
                onClick={() => setDeleteTemplateOpen(true)}
                className="rounded-xl border border-red-200 px-5 py-3 text-sm font-bold text-red-700"
              >
                Eliminar plantilla
              </button>
            )}
          </div>
        </main>
      </div>
      <ConfirmDialog
        open={deleteTemplateOpen}
        title="¿Eliminar esta plantilla?"
        description="Las cotizaciones ya generadas conservarán su diseño."
        confirmLabel="Eliminar plantilla"
        danger
        pending={mutations.remove.isPending}
        onClose={() => setDeleteTemplateOpen(false)}
        onConfirm={removeTemplate}
      />
    </>
  )
}

function VisualEditor({
  sections,
  layout,
  images,
  onChange,
}: {
  sections: QuotationTemplateSection[]
  layout: QuotationTemplateLayout
  images: QuotationTemplate['images']
  onChange: (
    sections: QuotationTemplateSection[],
    layout: Partial<QuotationTemplateLayout>,
  ) => void
}) {
  const gridPage = useRef<HTMLDivElement>(null)
  const dragged = useRef<string | null>(null)
  const resize = useRef<{
    key: string
    x: number
    y: number
    span: number
    rows: number
  } | null>(null)
  const past = useRef<
    Array<{ sections: QuotationTemplateSection[]; layout: QuotationTemplateLayout }>
  >([])
  const future = useRef<
    Array<{ sections: QuotationTemplateSection[]; layout: QuotationTemplateLayout }>
  >([])
  const copyNumber = useRef(0)
  const headerShiftRemainder = useRef(0)
  const [mode, setMode] = useState<'design' | 'content'>('design')
  const [selectedKey, setSelectedKey] = useState<string | null>(
    sections.find((item) => item.visible)?.key ?? null,
  )
  const [guide, setGuide] = useState<{ row: number; col: number; valid: boolean } | null>(
    null,
  )
  const [movingKey, setMovingKey] = useState<string | null>(null)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  const selected = sections.find((item) => item.key === selectedKey)
  const movingSection = sections.find((item) => item.key === movingKey)
  const companySection = sections.find((item) => item.key === 'company')
  const companyLines = (
    companySection?.content || 'IDESEM\nSoluciones comerciales y técnicas'
  )
    .split('\n')
    .filter(Boolean)
  const headerName = companyLines[0] || 'IDESEM'
  const headerSubtitle = companyLines[1] || 'Soluciones comerciales y técnicas'
  const imagesById = useMemo(
    () => new Map(images.map((image) => [image.id, image])),
    [images],
  )
  const headerImage = layout.header_image_id
    ? imagesById.get(layout.header_image_id)
    : undefined
  const maximumHeaderHeight = maximumHeaderHeightForSections(
    sections,
    layout.row_gap_mm,
  )
  const headerHeight = Math.max(
    18,
    Math.min(maximumHeaderHeight, layout.header_height_mm ?? 24),
  )
  const maximumHeaderImageHeight = Math.max(8, headerHeight - 4)
  const headerImageWidth = Math.max(15, Math.min(90, layout.header_image_width_mm ?? 43))
  const headerImageHeight = Math.max(
    8,
    Math.min(maximumHeaderImageHeight, layout.header_image_height_mm ?? 16),
  )
  const headerPreviewHeight = Math.max(76, Math.min(180, headerHeight * 1.6))
  const columns = layout.columns
  const commit = (
    nextSections: QuotationTemplateSection[],
    nextLayout: Partial<QuotationTemplateLayout> = {},
    history = true,
  ) => {
    if (history) {
      past.current.push({ sections, layout })
      future.current = []
    }
    onChange(
      nextSections,
      constrainHeaderLayout({ ...layout, ...nextLayout }, nextSections),
    )
  }
  const changeHeaderHeight = (requestedHeight: number) => {
    const nextHeight = Math.max(
      18,
      Math.min(maximumHeaderHeight, requestedHeight),
    )
    let nextSections = sections
    if (nextHeight > headerHeight) {
      const rowStep =
        EDITOR_ROW_HEIGHT_MM + layout.row_gap_mm * EDITOR_GAP_SCALE
      const firstRow = sections.reduce((minimum, section) => {
        if (!section.visible || section.key === 'company') return minimum
        return Math.min(minimum, section.grid_row ?? 1)
      }, MAX_ROWS + 1)
      const availableRows = Math.max(0, firstRow - 1)
      const accumulated =
        headerShiftRemainder.current + nextHeight - headerHeight
      const rowsToShift = Math.min(
        availableRows,
        Math.floor(accumulated / rowStep),
      )
      headerShiftRemainder.current = accumulated - rowsToShift * rowStep
      if (rowsToShift) {
        nextSections = sections.map((section) =>
          section.visible && section.key !== 'company'
            ? {
                ...section,
                grid_row: Math.max(1, (section.grid_row ?? 1) - rowsToShift),
              }
            : section,
        )
      }
    } else {
      headerShiftRemainder.current = 0
    }
    commit(nextSections, {
      header_height_mm: nextHeight,
      header_image_height_mm: Math.min(
        layout.header_image_height_mm ?? 16,
        Math.max(8, nextHeight - 4),
      ),
    })
  }
  const coordinates = (event: { clientX: number; clientY: number }) => {
    const box = gridPage.current?.getBoundingClientRect()
    if (!box) return null
    const inside =
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom
    return {
      row: Math.max(
        1,
        Math.min(
          MAX_ROWS,
          Math.round(((event.clientY - box.top) / Math.max(1, box.height)) * MAX_ROWS) +
            1,
        ),
      ),
      col: columnAt(event.clientX - box.left, box.width, layout.column_widths),
      inside,
    }
  }
  const destinationIsFree = (key: string, row: number, col: number) => {
    const source = sections.find((item) => item.key === key)
    if (!source) return false
    const span = source.column_span ?? 1
    const rows = source.row_span ?? 7
    return !sections.some((item) => {
      if (item.key === key || !item.visible) return false
      const itemColumn = item.grid_column ?? 1
      const itemRow = item.grid_row ?? 1
      return (
        row < itemRow + (item.row_span ?? 7) &&
        row + rows > itemRow &&
        col <= itemColumn + (item.column_span ?? 1) - 1 &&
        col + span - 1 >= itemColumn
      )
    })
  }
  const move = (
    key: string,
    row: number,
    col: number,
    span?: number,
    rows?: number,
    history = true,
  ) =>
    commit(
      resolveTemplateSections(sections, key, row, col, span, rows, columns),
      {},
      history,
    )
  const dragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (mode !== 'design') return
    event.preventDefault()
    const point = coordinates(event)
    if (point) {
      setGuide({
        row: point.row,
        col: point.col,
        valid:
          point.inside &&
          (!dragged.current || destinationIsFree(dragged.current, point.row, point.col)),
      })
    }
  }
  const drop = (event: React.DragEvent<HTMLDivElement>) => {
    const point = coordinates(event)
    if (dragged.current && point && guide?.valid)
      move(dragged.current, point.row, point.col, undefined, undefined, false)
    dragged.current = null
    setMovingKey(null)
    setGuide(null)
  }
  const beginMove = (event: React.PointerEvent, item: QuotationTemplateSection) => {
    if (mode !== 'design') return
    past.current.push({ sections, layout })
    future.current = []
    dragged.current = item.key
    setMovingKey(item.key)
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = coordinates(event)
    if (point)
      setGuide({
        row: point.row,
        col: point.col,
        valid: point.inside && destinationIsFree(item.key, point.row, point.col),
      })
  }
  const movePointer = (event: React.PointerEvent) => {
    if (!dragged.current || resize.current) return
    const point = coordinates(event)
    if (point)
      setGuide({
        row: point.row,
        col: point.col,
        valid: point.inside && destinationIsFree(dragged.current, point.row, point.col),
      })
  }
  const endMove = () => {
    if (dragged.current && guide?.valid) {
      move(dragged.current, guide.row, guide.col, undefined, undefined, false)
    }
    dragged.current = null
    setMovingKey(null)
    setGuide(null)
  }
  const beginResize = (event: React.PointerEvent, item: QuotationTemplateSection) => {
    if (mode !== 'design') return
    event.preventDefault()
    event.stopPropagation()
    past.current.push({ sections, layout })
    future.current = []
    resize.current = {
      key: item.key,
      x: event.clientX,
      y: event.clientY,
      span: item.column_span ?? 1,
      rows: item.row_span ?? 7,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const resizeMove = (event: React.PointerEvent) => {
    const active = resize.current
    const box = gridPage.current?.getBoundingClientRect()
    const item = sections.find((entry) => entry.key === active?.key)
    if (!active || !box || !item) return
    move(
      active.key,
      item.grid_row ?? 1,
      item.grid_column ?? 1,
      active.span + Math.round((event.clientX - active.x) / (box.width / columns)),
      active.rows +
        Math.round((event.clientY - active.y) / Math.max(1, box.height / MAX_ROWS)),
      false,
    )
  }
  const update = (key: string, patch: Partial<QuotationTemplateSection>) => {
    const current = sections.find((item) => item.key === key)
    if (!current) return
    const updated = withVisualDefaults({ ...current, ...patch })
    commit(
      resolveTemplateSections(
        sections.map((item) => (item.key === key ? updated : item)),
        key,
        updated.grid_row ?? 1,
        updated.grid_column ?? 1,
        updated.column_span,
        Math.max(updated.row_span ?? 7, suggestedRows(updated)),
        columns,
      ),
    )
  }
  const undo = () => {
    const previous = past.current.pop()
    if (!previous) return
    future.current.push({ sections, layout })
    onChange(previous.sections, previous.layout)
  }
  const redo = () => {
    const next = future.current.pop()
    if (!next) return
    past.current.push({ sections, layout })
    onChange(next.sections, next.layout)
  }
  const restore = (key: string) => {
    const defaultItem = defaultSections.find((item) => item.key === key)
    if (!defaultItem) return
    commit(
      resolveTemplateSections(
        sections.map((item) =>
          item.key === key
            ? {
                ...defaultItem,
                visible: true,
                grid_column: Math.min(defaultItem.grid_column ?? 1, columns),
                column_span: Math.min(defaultItem.column_span ?? 1, columns),
              }
            : item,
        ),
        key,
        defaultItem.grid_row ?? 1,
        defaultItem.grid_column ?? 1,
        defaultItem.column_span,
        defaultItem.row_span,
        columns,
      ),
      key === 'company'
        ? {
            header_image_id: null,
            header_height_mm: layoutDefault.header_height_mm,
            header_image_width_mm: layoutDefault.header_image_width_mm,
            header_image_height_mm: layoutDefault.header_image_height_mm,
            header_company_font_size: layoutDefault.header_company_font_size,
            header_subtitle_font_size: layoutDefault.header_subtitle_font_size,
            header_document_title: layoutDefault.header_document_title,
            header_document_title_font_size:
              layoutDefault.header_document_title_font_size,
          }
        : {},
    )
  }
  const show = (key: string) => {
    const existing = sections.find((item) => item.key === key)
    if (existing)
      update(key, {
        visible: true,
        ...(key === 'totals' && existing.show_savings === undefined
          ? { show_savings: true }
          : {}),
      })
    else restore(key)
  }
  const removeSelected = () => {
    if (!selected) return
    if (selected.type === 'system') update(selected.key, { visible: false })
    else setConfirmKey(selected.key)
  }
  const duplicateSelected = () => {
    if (!selected) return
    copyNumber.current += 1
    const copy: QuotationTemplateSection = {
      ...selected,
      key: `copy-${selected.key}-${copyNumber.current}`,
      type: 'text',
      title: `${selected.title} (copia)`,
      grid_row: Math.min(
        MAX_ROWS - (selected.row_span ?? 7),
        (selected.grid_row ?? 1) + (selected.row_span ?? 7) + 2,
      ),
      image_id: undefined,
    }
    commit(place(sections, copy, columns))
    setSelectedKey(copy.key)
  }
  const grid = {
    gridTemplateColumns: layout.column_widths
      .map((weight) => `minmax(0, ${weight}fr)`)
      .join(' '),
    columnGap: `${layout.column_gap_mm * 1.5}px`,
    rowGap: `${layout.row_gap_mm * 1.25}px`,
    gridTemplateRows: `repeat(${MAX_ROWS}, minmax(0, 1fr))`,
  }
  const hidden = defaultSections.filter(
    (item) => !sections.find((section) => section.key === item.key && section.visible),
  )
  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">Editor de hoja tamaño carta</h2>
          <p className="text-sm text-slate-500">
            Detalle de productos puede ocupar toda la hoja cuando no existen otras cajas
            debajo; si existen, se detendrá antes de ellas.
          </p>
        </div>
        <div className="rounded-xl border p-1 text-sm font-bold">
          <button
            type="button"
            onClick={() => setMode('design')}
            className={`rounded-lg px-3 py-2 ${mode === 'design' ? 'bg-brand-600 text-white' : ''}`}
          >
            Diseño
          </button>
          <button
            type="button"
            onClick={() => setMode('content')}
            className={`rounded-lg px-3 py-2 ${mode === 'content' ? 'bg-brand-600 text-white' : ''}`}
          >
            Contenido
          </button>
        </div>
      </div>
      <div
        className={
          mode === 'content' ? 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]' : ''
        }
      >
        <div
          onDragOver={dragOver}
          onDrop={drop}
          className="relative mx-auto w-full max-w-[760px] overflow-hidden border border-slate-300 bg-white p-5 shadow-lg"
          style={{
            aspectRatio: '8.5 / 11',
            backgroundImage: 'radial-gradient(#dce7f0 .7px, transparent .7px)',
            backgroundSize: '8px 8px',
          }}
        >
          <header
            onDoubleClick={() => {
              setSelectedKey('company')
              setMode('content')
            }}
            className="relative z-20 flex h-20 cursor-pointer justify-between border-b-2 border-brand-700 bg-white pb-3"
            title="Doble clic para editar el texto del encabezado"
            style={{ height: `${headerPreviewHeight}px` }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {headerImage && (
                <img
                  src={headerImage.image}
                  alt="Encabezado"
                  className="shrink-0 object-contain"
                  style={{
                    width: `${headerImageWidth * 1.5}px`,
                    height: `${Math.min(
                      headerPreviewHeight - 12,
                      headerImageHeight * 1.6,
                    )}px`,
                    maxWidth: '55%',
                  }}
                />
              )}
              <div className="min-w-0">
                <b
                  className="block leading-tight text-brand-900"
                  style={{
                    fontSize: `${layout.header_company_font_size ?? 14}px`,
                  }}
                >
                  {headerName}
                </b>
                <p
                  className="leading-tight text-slate-500"
                  style={{
                    fontSize: `${layout.header_subtitle_font_size ?? 8}px`,
                  }}
                >
                  {headerSubtitle}
                </p>
              </div>
            </div>
            <div className="max-w-[42%] shrink-0 text-right">
              <b
                className="text-brand-900"
                style={{
                  fontSize: `${layout.header_document_title_font_size ?? 12}px`,
                }}
              >
                {layout.header_document_title || 'COTIZACI\u00d3N'}
              </b>
              <p className="text-xs text-slate-500">COT-000001 · 15/07/2026</p>
            </div>
          </header>
          <div
            ref={gridPage}
            className="relative mt-4 grid"
            style={{
              ...grid,
              height: `calc(100% - ${headerPreviewHeight + 48}px)`,
            }}
          >
            {[...Array(Math.max(0, columns - 1))].map((_, index) => (
              <Guide
                key={index}
                index={index}
                weights={layout.column_widths}
                onPointerDown={(event) =>
                  resizeDivider(event, index, layout, (patch) => commit(sections, patch))
                }
              />
            ))}
            {guide && movingSection && mode === 'design' && (
              <div
                className={`pointer-events-none z-20 rounded-md border-2 border-dashed shadow-sm ${guide.valid ? 'border-emerald-500 bg-emerald-100/70' : 'border-red-500 bg-red-100/70'}`}
                style={{
                  gridColumn: `${guide.col} / span ${movingSection.column_span ?? 1}`,
                  gridRow: `${guide.row} / span ${movingSection.row_span ?? 7}`,
                }}
              >
                <span
                  className={`block p-1 text-[10px] font-bold ${guide.valid ? 'text-emerald-800' : 'text-red-800'}`}
                >
                  {guide.valid
                    ? `Ubicar: ${movingSection.title}`
                    : 'No se puede ubicar aquí'}
                </span>
              </div>
            )}
            {sections
              .filter((item) => item.visible)
              .map((item) => (
                <Block
                  key={item.key}
                  section={item}
                  image={item.image_id ? imagesById.get(item.image_id) : undefined}
                  selected={item.key === selectedKey}
                  moving={movingKey === item.key && Boolean(guide)}
                  design={mode === 'design'}
                  onSelect={() => setSelectedKey(item.key)}
                  onEdit={() => {
                    setSelectedKey(item.key)
                    setMode('content')
                  }}
                  onPointerDown={(event) => beginMove(event, item)}
                  onPointerMove={movePointer}
                  onPointerUp={endMove}
                  onResizeStart={(event) => beginResize(event, item)}
                  onResizeMove={resizeMove}
                  onResizeEnd={() => {
                    resize.current = null
                  }}
                  onToggleSavings={() =>
                    update(item.key, { show_savings: item.show_savings === false })
                  }
                />
              ))}
          </div>
        </div>
        {mode === 'content' && (
          <Properties
            section={selected}
            layout={layout}
            maximumHeaderHeight={maximumHeaderHeight}
            onHeaderHeightChange={changeHeaderHeight}
            onChange={update}
            onLayoutChange={(patch) => commit(sections, patch)}
            onRemove={removeSelected}
            onRestore={() => selected && restore(selected.key)}
            onDuplicate={duplicateSelected}
          />
        )}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
        <section className="rounded-xl border border-slate-200 p-3">
          <b className="text-sm">Secciones disponibles</b>
          <p className="text-xs text-slate-500">
            Recupera una sección predeterminada sin perder su contenido original.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {hidden.length ? (
              hidden.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => show(item.key)}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700"
                >
                  + {item.title}
                </button>
              ))
            ) : (
              <span className="text-xs text-slate-500">
                Todas las secciones predeterminadas están visibles.
              </span>
            )}
          </div>
        </section>
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={undo}
            className="rounded-xl border p-3"
            title="Deshacer"
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            className="rounded-xl border p-3"
            title="Rehacer"
          >
            <Redo2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const item: QuotationTemplateSection = {
                key: `text-${Date.now()}`,
                type: 'text',
                title: 'Información adicional',
                content: 'Escribe aquí el contenido.',
                visible: true,
                order: 999,
                grid_row: 1,
                grid_column: 1,
                column_span: columns,
                row_span: 9,
                ...styleDefault(),
              }
              commit(place(sections, item, columns))
              setSelectedKey(item.key)
              setMode('content')
            }}
            className="inline-flex items-center gap-1 rounded-xl border px-3 py-3 text-sm font-bold"
          >
            <Plus className="size-4" /> Texto
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(confirmKey)}
        title="¿Eliminar esta sección personalizada?"
        description="Esta acción eliminará su contenido. Puedes cancelar para conservarlo."
        confirmLabel="Eliminar sección"
        danger
        onClose={() => setConfirmKey(null)}
        onConfirm={() => {
          if (confirmKey) commit(sections.filter((item) => item.key !== confirmKey))
          setConfirmKey(null)
          setSelectedKey(null)
        }}
      />
    </section>
  )
}

function Properties({
  section,
  layout,
  maximumHeaderHeight,
  onHeaderHeightChange,
  onChange,
  onLayoutChange,
  onRemove,
  onRestore,
  onDuplicate,
}: {
  section?: QuotationTemplateSection
  layout: QuotationTemplateLayout
  maximumHeaderHeight: number
  onHeaderHeightChange: (value: number) => void
  onChange: (key: string, patch: Partial<QuotationTemplateSection>) => void
  onLayoutChange: (patch: Partial<QuotationTemplateLayout>) => void
  onRemove: () => void
  onRestore: () => void
  onDuplicate: () => void
}) {
  if (!section)
    return (
      <aside className="rounded-xl border p-4 text-sm text-slate-500">
        Selecciona una tarjeta para editarla.
      </aside>
    )
  const automatic = ['client', 'items'].includes(section.key)
  const isHeader = section.key === 'company'
  const companyLines = (
    section.content || 'IDESEM S.R.L.\nSoluciones comerciales y técnicas'
  ).split('\n')
  const companyName = companyLines[0] || 'IDESEM S.R.L.'
  const companySubtitle = companyLines[1] || ''
  const updateCompanyLine = (index: number, value: string) => {
    const next = [companyName, companySubtitle]
    next[index] = value
    onChange(section.key, { content: next.join('\n') })
  }
  return (
    <aside className="h-fit rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-bold">
        {isHeader ? 'Personalizar encabezado' : 'Propiedades'}
      </h3>
      <p className="text-xs text-slate-500">Los cambios se ven al instante.</p>
      {isHeader ? (
        <>
          <p className="mt-3 rounded-lg bg-white p-3 text-xs text-slate-600">
            El logotipo y el nombre siempre se mantienen visibles juntos. El alto del logo
            depende del espacio definido para el encabezado.
          </p>
          <TextInput
            label="Nombre de la empresa"
            value={companyName}
            onChange={(value) => updateCompanyLine(0, value)}
          />
          <TextInput
            label="Texto bajo el nombre"
            value={companySubtitle}
            onChange={(value) => updateCompanyLine(1, value)}
          />
          <TextInput
            label="Título del documento"
            value={layout.header_document_title || 'COTIZACI\u00d3N'}
            onChange={(header_document_title) =>
              onLayoutChange({ header_document_title })
            }
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <NumberInput
              label="Alto del encabezado (mm)"
              value={layout.header_height_mm ?? 24}
              min={18}
              max={maximumHeaderHeight}
              onChange={onHeaderHeightChange}
            />
            <NumberInput
              label="Ancho del logo (mm)"
              value={layout.header_image_width_mm ?? 43}
              min={15}
              max={90}
              onChange={(header_image_width_mm) =>
                onLayoutChange({ header_image_width_mm })
              }
            />
            <NumberInput
              label="Alto del logo (mm)"
              value={layout.header_image_height_mm ?? 16}
              min={8}
              max={Math.max(8, (layout.header_height_mm ?? 24) - 4)}
              onChange={(header_image_height_mm) =>
                onLayoutChange({ header_image_height_mm })
              }
            />
            <NumberInput
              label="Tamaño de empresa"
              value={layout.header_company_font_size ?? 14}
              min={9}
              max={22}
              onChange={(header_company_font_size) =>
                onLayoutChange({ header_company_font_size })
              }
            />
            <NumberInput
              label="Tamaño de descripción"
              value={layout.header_subtitle_font_size ?? 8}
              min={6}
              max={14}
              onChange={(header_subtitle_font_size) =>
                onLayoutChange({ header_subtitle_font_size })
              }
            />
            <NumberInput
              label="Tamaño del título"
              value={layout.header_document_title_font_size ?? 12}
              min={9}
              max={22}
              onChange={(header_document_title_font_size) =>
                onLayoutChange({ header_document_title_font_size })
              }
            />
          </div>
          {layout.header_image_id && (
            <button
              type="button"
              onClick={() => onLayoutChange({ header_image_id: null })}
              className="mt-3 text-xs font-bold text-red-700"
            >
              Quitar imagen del encabezado
            </button>
          )}
        </>
      ) : (
        <>
          <TextInput
            label="Título"
            value={section.title}
            onChange={(title) => onChange(section.key, { title })}
          />
          {automatic ? (
            <p className="mt-3 rounded-lg bg-white p-3 text-xs text-slate-600">
              El contenido se completa automáticamente al emitir la cotización.
            </p>
          ) : (
            <label className="mt-3 block text-xs font-bold">
              Contenido
              <textarea
                value={section.content}
                onChange={(event) =>
                  onChange(section.key, { content: event.target.value })
                }
                rows={7}
                className="mt-1 w-full rounded-lg border p-2 text-sm"
              />
            </label>
          )}
        </>
      )}
      {section.key === 'totals' && (
        <label className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-slate-700">
          <input
            type="checkbox"
            checked={section.show_savings !== false}
            onChange={(event) =>
              onChange(section.key, { show_savings: event.target.checked })
            }
          />
          Mostrar ahorro o descuento
        </label>
      )}
      {!isHeader && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <NumberInput
              label="Padding"
              value={section.padding_mm ?? 3}
              onChange={(padding_mm) => onChange(section.key, { padding_mm })}
            />
            <NumberInput
              label="Margen"
              value={section.margin_mm ?? 0}
              onChange={(margin_mm) => onChange(section.key, { margin_mm })}
            />
            <NumberInput
              label="Fuente"
              value={section.font_size ?? 9}
              onChange={(font_size) => onChange(section.key, { font_size })}
            />
            <NumberInput
              label="Borde"
              value={section.border_width ?? 1}
              onChange={(border_width) => onChange(section.key, { border_width })}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-bold">
            <Color
              label="Fondo"
              value={section.background_color ?? '#FFFFFF'}
              onChange={(background_color) => onChange(section.key, { background_color })}
            />
            <Color
              label="Texto"
              value={section.text_color ?? '#233548'}
              onChange={(text_color) => onChange(section.key, { text_color })}
            />
            <Color
              label="Borde"
              value={section.border_color ?? '#CBD5E1'}
              onChange={(border_color) => onChange(section.key, { border_color })}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <select
              value={section.horizontal_align ?? 'left'}
              onChange={(event) =>
                onChange(section.key, {
                  horizontal_align: event.target.value as 'left' | 'center' | 'right',
                })
              }
              className="rounded border p-1 text-xs"
            >
              <option value="left">Izquierda</option>
              <option value="center">Centro</option>
              <option value="right">Derecha</option>
            </select>
            <select
              value={section.vertical_align ?? 'top'}
              onChange={(event) =>
                onChange(section.key, {
                  vertical_align: event.target.value as 'top' | 'middle' | 'bottom',
                })
              }
              className="rounded border p-1 text-xs"
            >
              <option value="top">Arriba</option>
              <option value="middle">Centro</option>
              <option value="bottom">Abajo</option>
            </select>
          </div>
        </>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRestore}
          className="inline-flex items-center gap-1 text-xs font-bold text-brand-800"
        >
          <RotateCcw className="size-3" /> Restaurar
        </button>
        {!isHeader && (
          <>
            <button
              type="button"
              onClick={onDuplicate}
              className="text-xs font-bold text-slate-700"
            >
              Duplicar
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="text-xs font-bold text-red-700"
            >
              {section.type === 'system' ? 'Ocultar' : 'Eliminar'}
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
function Block({
  section,
  image,
  selected,
  moving,
  design,
  onSelect,
  onEdit,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  onToggleSavings,
}: {
  section: QuotationTemplateSection
  image?: QuotationTemplate['images'][number]
  selected: boolean
  moving: boolean
  design: boolean
  onSelect: () => void
  onEdit: () => void
  onPointerDown: (event: React.PointerEvent) => void
  onPointerMove: (event: React.PointerEvent) => void
  onPointerUp: () => void
  onResizeStart: (event: React.PointerEvent) => void
  onResizeMove: (event: React.PointerEvent) => void
  onResizeEnd: () => void
  onToggleSavings: () => void
}) {
  const style = {
    gridColumn: `${section.grid_column ?? 1} / span ${section.column_span ?? 1}`,
    gridRow: `${section.grid_row ?? 1} / span ${section.row_span ?? 7}`,
    textAlign: section.horizontal_align ?? 'left',
    justifyContent:
      section.vertical_align === 'middle'
        ? 'center'
        : section.vertical_align === 'bottom'
          ? 'flex-end'
          : 'flex-start',
    padding: `${(section.padding_mm ?? 3) * 1.25}px`,
    margin: `${(section.margin_mm ?? 0) * 1.2}px`,
    backgroundColor: section.background_color ?? '#FFFFFF',
    color: section.text_color ?? '#233548',
    borderColor: section.border_color ?? '#CBD5E1',
    borderWidth: `${section.border_width ?? 1}px`,
    borderRadius: `${section.border_radius ?? 4}px`,
    fontSize: `${Math.max(8, (section.font_size ?? 9) - 1)}px`,
  } as React.CSSProperties
  const content =
    section.content ||
    (section.key === 'client'
      ? 'Constructora Andina S.R.L.\nNIT: 10203040 · Tel.: 70000000\nAv. Mariscal Santa Cruz 123'
      : 'Información automática de la cotización.')
  return (
    <article
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onSelect}
      onDoubleClick={onEdit}
      style={style}
      className={`group relative z-10 flex min-w-0 flex-col border shadow-sm transition-shadow duration-100 ${design ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${moving ? 'border-emerald-500 ring-2 ring-emerald-300' : selected ? 'ring-2 ring-brand-300' : ''}`}
    >
      <h3 className="mb-1 font-bold uppercase tracking-wide text-brand-800">
        {section.title}
      </h3>
      {section.type === 'image' && image ? (
        <img
          src={image.image}
          alt={section.title}
          className="min-h-0 w-full flex-1 object-contain"
        />
      ) : section.key === 'items' ? (
        <SampleItems />
      ) : section.key === 'totals' ? (
        <div className="ml-auto text-right">
          <p>Subtotal: Bs 250.00</p>
          {section.show_savings !== false && (
            <p className="text-emerald-700">Ahorro: −Bs 20.00</p>
          )}
          <b className="block border-t pt-1">TOTAL: Bs 230.00</b>
        </div>
      ) : (
        <p className="whitespace-pre-line break-words">{content}</p>
      )}
      {design && selected && section.key === 'totals' && (
        <label
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className="absolute -bottom-9 right-0 z-40 flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-700 shadow-md"
        >
          <input
            type="checkbox"
            checked={section.show_savings !== false}
            onChange={onToggleSavings}
          />
          Mostrar ahorro
        </label>
      )}
      {design && (
        <button
          type="button"
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          className="absolute bottom-0 right-0 size-4 cursor-se-resize border-l border-t border-brand-500 bg-brand-100 opacity-0 group-hover:opacity-100"
          aria-label="Redimensionar"
        />
      )}
    </article>
  )
}
function SampleItems() {
  return (
    <div className="rounded border text-[8px]">
      <div className="grid grid-cols-[1fr_1.5rem_2.5rem] bg-brand-700 px-1 py-1 font-bold text-white">
        <span>Producto</span>
        <span>Cant.</span>
        <span>Total</span>
      </div>
      {[
        'Calefón instantáneo de gas 10L',
        'Kit de instalación completo',
        'Válvula reforzada',
        'Servicio técnico',
      ].map((name, index) => (
        <div key={name} className="grid grid-cols-[1fr_1.5rem_2.5rem] border-t px-1 py-1">
          <span className="truncate">{name}</span>
          <span>{index + 1}</span>
          <span>Bs {20 + index * 15}</span>
        </div>
      ))}
    </div>
  )
}
function Guide({
  index,
  weights,
  onPointerDown,
}: {
  index: number
  weights: number[]
  onPointerDown: (event: React.PointerEvent) => void
}) {
  const total = weights.reduce((sum, item) => sum + item, 0)
  const before = weights.slice(0, index + 1).reduce((sum, item) => sum + item, 0)
  return (
    <div
      style={{ left: `${(before / total) * 100}%` }}
      onPointerDown={onPointerDown}
      className="absolute bottom-0 top-0 z-20 -ml-1 w-2 cursor-col-resize border-l border-dashed border-brand-300"
    />
  )
}
function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border p-2"
      />
    </label>
  )
}
function TextInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="mt-3 block text-xs font-bold">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded border p-2 text-sm"
      />
    </label>
  )
}
function NumberInput({
  label,
  value,
  min = 0,
  max,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="text-xs font-bold">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const parsed = Number(event.target.value)
          if (!Number.isFinite(parsed)) return
          onChange(Math.max(min, max === undefined ? parsed : Math.min(max, parsed)))
        }}
        className="mt-1 w-full rounded border p-1"
      />
    </label>
  )
}
function Color({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label>
      {label}
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block h-7 w-full"
      />
    </label>
  )
}
function styleDefault(): Pick<
  QuotationTemplateSection,
  | 'padding_mm'
  | 'margin_mm'
  | 'font_size'
  | 'background_color'
  | 'text_color'
  | 'border_color'
  | 'border_width'
  | 'border_radius'
  | 'horizontal_align'
  | 'vertical_align'
> {
  return {
    padding_mm: 3,
    margin_mm: 0,
    font_size: 9,
    background_color: '#FFFFFF',
    text_color: '#233548',
    border_color: '#CBD5E1',
    border_width: 1,
    border_radius: 4,
    horizontal_align: 'left',
    vertical_align: 'top',
  }
}
function withVisualDefaults(section: QuotationTemplateSection): QuotationTemplateSection {
  return {
    ...styleDefault(),
    ...section,
    grid_row: section.grid_row ?? 1,
    grid_column: section.grid_column ?? 1,
    column_span: section.column_span ?? 1,
    row_span: section.row_span ?? suggestedRows(section),
  }
}
function minRows(section: Partial<QuotationTemplateSection>) {
  if (section.key === 'items') return 9
  if (section.key === 'totals') return 5
  if (section.type === 'image') return 6
  return 3
}
function suggestedRows(section: Partial<QuotationTemplateSection>) {
  if (section.key === 'items') return 14
  if (section.key === 'totals') return 7
  if (section.type === 'image') return 12
  const content =
    section.content ||
    (section.key === 'client'
      ? 'Constructora Andina S.R.L. NIT: 10203040 Teléfono: 70000000 Av. Mariscal Santa Cruz 123'
      : '')
  return Math.max(minRows(section), Math.min(16, 3 + Math.ceil(content.length / 60) * 2))
}
function columnAt(x: number, width: number, weights: number[]) {
  const total = weights.reduce((sum, item) => sum + item, 0)
  let used = 0
  for (let index = 0; index < weights.length; index += 1) {
    used += (weights[index] / total) * width
    if (x <= used) return index + 1
  }
  return weights.length
}
export function maximumHeaderHeightForSections(
  sections: QuotationTemplateSection[],
  rowGapMm = 1,
) {
  const rowStep = EDITOR_ROW_HEIGHT_MM + rowGapMm * EDITOR_GAP_SCALE
  const occupied = sections.reduce<{ first: number | null; last: number }>((result, section) => {
    if (!section.visible || section.key === 'company') return result
    const row = Math.max(1, section.grid_row ?? 1)
    const rowSpan = Math.max(3, section.row_span ?? 8)
    const gridHeight =
      rowSpan * EDITOR_ROW_HEIGHT_MM +
      Math.max(0, rowSpan - 1) * rowGapMm * EDITOR_GAP_SCALE
    const reservedHeight = Math.max(section.min_height_mm ?? 0, gridHeight)
    const start = (row - 1) * rowStep
    return {
      first: result.first === null ? start : Math.min(result.first, start),
      last: Math.max(result.last, start + reservedHeight),
    }
  }, { first: null, last: 0 })
  const occupiedHeight =
    occupied.first === null ? 0 : occupied.last - occupied.first
  const available =
    STANDARD_FRAME_HEIGHT_MM - STANDARD_HEADER_GAP_MM - occupiedHeight
  return Math.max(18, Math.min(120, Math.floor(available * 10) / 10))
}
function constrainHeaderLayout(
  layout: QuotationTemplateLayout,
  sections: QuotationTemplateSection[],
): QuotationTemplateLayout {
  const maximum = maximumHeaderHeightForSections(sections, layout.row_gap_mm)
  const headerHeight = Math.min(layout.header_height_mm ?? 24, maximum)
  return {
    ...layout,
    header_height_mm: headerHeight,
    header_image_height_mm: Math.min(
      layout.header_image_height_mm ?? 16,
      Math.max(8, headerHeight - 4),
    ),
  }
}
export function resolveTemplateSections(
  sections: QuotationTemplateSection[],
  key: string,
  row: number,
  column: number,
  requestedSpan: number | undefined,
  requestedRows: number | undefined,
  columns: number,
) {
  const source = sections.find((item) => item.key === key)
  if (!source) return sections
  const span = Math.max(1, Math.min(requestedSpan ?? source.column_span ?? 1, columns))
  const col = Math.max(1, Math.min(column, columns - span + 1))
  const safeRow = Math.max(1, Math.min(row, MAX_ROWS - minRows(source) + 1))
  const maximumRows = source.key === 'items' ? MAX_ROWS - safeRow + 1 : 42
  let rows = Math.max(
    minRows(source),
    Math.min(maximumRows, requestedRows ?? source.row_span ?? 7),
  )
  if (source.key === 'items') {
    const requestedEndColumn = col + span - 1
    const nextOccupiedRow = sections.reduce((closest, item) => {
      if (item.key === key || !item.visible) return closest
      const itemColumn = item.grid_column ?? 1
      const itemEndColumn = itemColumn + (item.column_span ?? 1) - 1
      const itemRow = item.grid_row ?? 1
      const sharesWidth = col <= itemEndColumn && requestedEndColumn >= itemColumn
      if (!sharesWidth || itemRow <= safeRow) return closest
      return Math.min(closest, itemRow)
    }, MAX_ROWS + 1)
    if (nextOccupiedRow <= MAX_ROWS && nextOccupiedRow - safeRow < minRows(source))
      return sections
    rows = Math.min(rows, Math.max(minRows(source), nextOccupiedRow - safeRow))
  }
  const finalRow = Math.min(safeRow, MAX_ROWS - rows + 1)
  const requested = {
    ...source,
    grid_row: finalRow,
    grid_column: col,
    column_span: span,
    row_span: rows,
  }
  const ordered = sections
    .map((item) => (item.key === key ? requested : item))
    .sort(
      (left, right) =>
        (left.key === key ? -1 : (left.grid_row ?? 1)) -
        (right.key === key ? -1 : (right.grid_row ?? 1)),
    )
  const positioned: QuotationTemplateSection[] = []
  const overlaps = (
    candidate: QuotationTemplateSection,
    other: QuotationTemplateSection,
  ) => {
    if (!candidate.visible || !other.visible) return false
    const candidateStart = candidate.grid_column ?? 1
    const candidateEnd = candidateStart + (candidate.column_span ?? 1) - 1
    const otherStart = other.grid_column ?? 1
    const otherEnd = otherStart + (other.column_span ?? 1) - 1
    return (
      (candidate.grid_row ?? 1) < (other.grid_row ?? 1) + (other.row_span ?? 7) &&
      (candidate.grid_row ?? 1) + (candidate.row_span ?? 7) > (other.grid_row ?? 1) &&
      candidateStart <= otherEnd &&
      candidateEnd >= otherStart
    )
  }
  for (const item of ordered) {
    const next = { ...item }
    while (
      (next.grid_row ?? 1) < MAX_ROWS - (next.row_span ?? 7) + 1 &&
      positioned.some((other) => overlaps(next, other))
    )
      next.grid_row = (next.grid_row ?? 1) + 1
    if ((next.grid_row ?? 1) > MAX_ROWS - (next.row_span ?? 7) + 1) return sections
    positioned.push({
      ...next,
      order: (next.grid_row ?? 1) * 10 + (next.grid_column ?? 1),
    })
  }
  return positioned
}
function place(
  sections: QuotationTemplateSection[],
  item: QuotationTemplateSection,
  columns: number,
) {
  return resolveTemplateSections(
    [...sections, item],
    item.key,
    item.grid_row ?? 1,
    item.grid_column ?? 1,
    item.column_span,
    item.row_span,
    columns,
  )
}
function repairGrid(sections: QuotationTemplateSection[], columns: number) {
  return [...sections]
    .sort((a, b) => (a.grid_row ?? a.order) - (b.grid_row ?? b.order))
    .reduce<QuotationTemplateSection[]>(
      (result, item) =>
        resolveTemplateSections(
          [...result, item],
          item.key,
          item.grid_row ?? 1,
          item.grid_column ?? 1,
          item.column_span,
          Math.max(minRows(item), item.row_span ?? suggestedRows(item)),
          columns,
        ),
      [],
    )
}
function resizeDivider(
  event: React.PointerEvent,
  index: number,
  layout: QuotationTemplateLayout,
  onChange: (patch: Partial<QuotationTemplateLayout>) => void,
) {
  const start = event.clientX
  const before = [...layout.column_widths]
  const move = (pointer: PointerEvent) => {
    const delta = (pointer.clientX - start) / 70
    const widths = [...before]
    widths[index] = Math.max(0.35, before[index] + delta)
    widths[index + 1] = Math.max(0.35, before[index + 1] - delta)
    onChange({ column_widths: widths })
  }
  const stop = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop)
}
