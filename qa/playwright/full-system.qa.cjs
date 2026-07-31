/* eslint-disable no-console */
'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium, request } = require('playwright')

const ROOT = path.resolve(__dirname, '..', '..')
const FRONTEND_URL = (process.env.QA_FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
const API_URL = (process.env.QA_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const ADMIN_USERNAME = process.env.QA_USERNAME || 'demo_admin'
const ADMIN_PASSWORD = process.env.QA_PASSWORD || 'Demo12345!'
const HEADLESS = process.env.QA_HEADED !== '1'
const SLOW_MO = Number(process.env.QA_SLOW_MO || 0)
const RUN_ID =
  process.env.QA_RUN_ID ||
  new Date().toISOString().replace(/\D/g, '').slice(0, 14)
const ARTIFACT_DIR = path.join(__dirname, 'artifacts', RUN_ID)
const REPORT_DIR = path.join(__dirname, 'reports')

fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
fs.mkdirSync(REPORT_DIR, { recursive: true })

const suffix = RUN_ID.slice(-10)
const data = {
  runId: RUN_ID,
  category: {
    name: `QA Herramientas ${suffix}`,
    code: `QACAT${suffix}`,
  },
  priceLevel: {
    name: `QA Preferencial ${suffix}`,
    code: `QAPL${suffix}`,
    minimumQuantity: 3,
  },
  clientType: `QA Distribuidor ${suffix}`,
  client: {
    name: `QA Cliente ${suffix} S.R.L.`,
    taxId: `QA${suffix}`,
    department: 'Potosí',
    city: 'Zona Central',
    whatsapp: `7${suffix.slice(-7)}`,
  },
  warehouse: {
    name: `QA Almacén ${suffix}`,
    code: `QAALM${suffix}`,
  },
  products: [
    {
      name: `QA Taladro ${suffix}`,
      sku: `QATAL${suffix}`,
      normal: 20,
      special: 15,
      stock: 25,
      minimumStock: 1,
    },
    {
      name: `QA Sierra ${suffix}`,
      sku: `QASIE${suffix}`,
      normal: 35,
      special: 30,
      stock: 12,
      minimumStock: 1,
    },
  ],
}

const results = []
const browserSignals = {
  pageErrors: [],
  consoleErrors: [],
  serverErrors: [],
}
let currentPage = null

function now() {
  return new Date().toISOString()
}

function sanitizeFileName(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function formatMoney(value) {
  return `Bs ${Number(value).toFixed(2)}`
}

async function screenshot(name, page = currentPage) {
  if (!page || page.isClosed()) return null
  const target = path.join(ARTIFACT_DIR, `${sanitizeFileName(name)}.png`)
  await page.screenshot({ path: target, fullPage: true }).catch(() => undefined)
  return target
}

async function qaCase(id, title, action) {
  const startedAt = now()
  const started = Date.now()
  console.log(`\n[${id}] ${title}`)
  try {
    const evidence = await action()
    const item = {
      id,
      title,
      status: 'APROBADO',
      durationMs: Date.now() - started,
      startedAt,
      evidence: evidence || '',
    }
    results.push(item)
    console.log(`  ✓ APROBADO (${item.durationMs} ms)`)
    return evidence
  } catch (error) {
    const image = await screenshot(`${id}-fallo`)
    const item = {
      id,
      title,
      status: 'FALLIDO',
      durationMs: Date.now() - started,
      startedAt,
      error: error instanceof Error ? error.stack || error.message : String(error),
      screenshot: image,
    }
    results.push(item)
    console.error(`  ✗ FALLIDO: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

async function goto(page, route) {
  const response = await page.goto(`${FRONTEND_URL}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  assert(response, `No se recibió respuesta al abrir ${route}.`)
  assert(response.ok(), `La ruta ${route} respondió HTTP ${response.status()}.`)
}

function endpointMatches(response, endpoint, method = 'POST') {
  const pathname = new URL(response.url()).pathname
  return response.request().method() === method && pathname === `/api/v1/${endpoint}`
}

async function responseJson(response, label) {
  const body = await response.text()
  assert(
    response.ok(),
    `${label} respondió HTTP ${response.status()}: ${body.slice(0, 600)}`,
  )
  return body ? JSON.parse(body) : null
}

async function submitAndCapture(page, endpoint, buttonName, method = 'POST') {
  const responsePromise = page.waitForResponse(
    (response) => endpointMatches(response, endpoint, method),
    { timeout: 20_000 },
  )
  await page.getByRole('button', { name: buttonName, exact: true }).click()
  return responseJson(await responsePromise, `${method} ${endpoint}`)
}

async function fill(page, label, value) {
  const field = await formField(page, label)
  await field.waitFor({ state: 'visible' })
  await field.fill(String(value))
}

async function select(page, label, option) {
  const field = await formField(page, label)
  await field.waitFor({ state: 'visible' })
  await field.selectOption(option)
}

async function formField(page, label) {
  const visibleLabel = label.replace(/\s*\*$/, '').trim()
  const matchingLabel = page.locator('label').filter({ hasText: visibleLabel })
  await matchingLabel.first().waitFor({ state: 'visible', timeout: 30_000 })
  const nested = matchingLabel.locator('input, select, textarea')
  assert(
    (await nested.count()) > 0,
    `No se encontró el campo de formulario "${label}".`,
  )
  return nested.first()
}

async function waitForText(locator, expected, timeout = 15_000) {
  const deadline = Date.now() + timeout
  let current = ''
  await locator.waitFor({ state: 'visible', timeout })
  while (Date.now() < deadline) {
    current = (await locator.textContent()) || ''
    if (current.includes(expected)) return
    await locator.page().waitForTimeout(100)
  }
  assert.fail(`No apareció "${expected}". Texto actual: "${current.trim()}".`)
}

async function login(page, username, password) {
  await goto(page, '/login')
  await fill(page, 'Nombre de usuario *', username)
  await fill(page, 'Contraseña *', password)
  const responsePromise = page.waitForResponse(
    (response) => endpointMatches(response, 'auth/login/', 'POST'),
    { timeout: 20_000 },
  )
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  const loginData = await responseJson(await responsePromise, 'Inicio de sesión')
  await page.waitForURL(/\/dashboard(?:\/|$|\?)/, { timeout: 20_000 })
  return loginData
}

async function getJson(api, endpoint) {
  const response = await api.get(endpoint.replace(/^\/+/, ''))
  const body = await response.text()
  assert(response.ok(), `GET ${endpoint} respondió HTTP ${response.status()}: ${body}`)
  return JSON.parse(body)
}

async function createCategory(page) {
  await goto(page, '/categories/new')
  await fill(page, 'Nombre *', data.category.name)
  await fill(page, 'Código *', data.category.code)
  await fill(page, 'Descripción', 'Categoría creada automáticamente por la prueba QA E2E.')
  const created = await submitAndCapture(
    page,
    'catalog/categories/',
    'Crear registro',
  )
  await page.waitForURL(/\/categories(?:\?|$)/)
  data.category.id = created.id
  return `Categoría ${created.name} creada con id ${created.id}.`
}

async function createPriceLevelAndTier(page) {
  await goto(page, '/price-levels/new')
  await fill(page, 'Nombre *', data.priceLevel.name)
  await fill(page, 'Código *', data.priceLevel.code)
  await fill(
    page,
    'Descripción',
    'Nivel preferencial temporal para validar precios automáticos por cantidad.',
  )
  const level = await submitAndCapture(
    page,
    'catalog/price-levels/',
    'Crear registro',
  )
  data.priceLevel.id = level.id
  await goto(page, `/price-levels/${level.id}/rules`)
  await fill(page, 'Cantidad mínima', data.priceLevel.minimumQuantity)
  const tier = await submitAndCapture(page, 'catalog/price-tiers/', 'Agregar')
  data.priceLevel.tierId = tier.id
  await page.getByText(`${data.priceLevel.minimumQuantity} unidades`, { exact: true }).waitFor()
  return `Nivel ${level.name} y regla x${tier.minimum_quantity} creados.`
}

async function createWarehouse(page) {
  await goto(page, '/inventory/warehouses/new')
  await fill(page, 'Nombre', data.warehouse.name)
  await fill(page, 'Código', data.warehouse.code)
  await fill(page, 'Dirección', 'Av. QA 100, Potosí')
  await fill(page, 'Descripción', 'Almacén temporal para pruebas automatizadas.')
  const warehouse = await submitAndCapture(
    page,
    'inventory/warehouses/',
    'Crear almacén',
  )
  data.warehouse.id = warehouse.id
  await page.waitForURL(/\/inventory\/warehouses(?:\?|$)/)
  return `Almacén ${warehouse.name} creado con id ${warehouse.id}.`
}

async function createProduct(page, product) {
  await goto(page, '/products/new')
  await fill(page, 'Nombre *', product.name)
  await fill(page, 'SKU *', product.sku)
  await select(page, 'Categoría *', data.category.id)
  await fill(page, 'Código de barras', `${product.sku}BAR`)
  await fill(
    page,
    'Descripción',
    `Producto de prueba ${product.name}. Creado por Playwright.`,
  )
  await fill(page, 'Precio de venta normal (nivel x1) (Bs) *', product.normal)
  const created = await submitAndCapture(
    page,
    'catalog/products/',
    'Crear producto',
  )
  product.id = created.id
  await page.waitForURL(new RegExp(`/products/${created.id}(?:\\?|$)`))
  await page.getByText(formatMoney(product.normal), { exact: true }).waitFor()
  return `Producto ${created.name} creado a ${formatMoney(product.normal)}.`
}

async function configureProductSpecialPrice(page, api, product) {
  await goto(page, `/products/${product.id}`)
  await page.getByRole('button', { name: 'Precios', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: new RegExp(`Precios.*${product.name}`) })
  await dialog.waitFor()
  await dialog.getByRole('heading', { name: data.priceLevel.name, exact: true }).waitFor({
    timeout: 15_000,
  })
  const tierLabel = dialog
    .locator('label')
    .filter({ hasText: data.priceLevel.name })
    .filter({ hasText: `(desde ${data.priceLevel.minimumQuantity})` })
  assert.equal(
    await tierLabel.count(),
    1,
    `No se encontró una única tarifa ${data.priceLevel.name} x${data.priceLevel.minimumQuantity}.`,
  )
  await tierLabel.locator('input').fill(String(product.special))
  await dialog.getByRole('button', { name: 'Guardar precios', exact: true }).click()
  await page.getByText('Precios del producto guardados.', { exact: true }).waitFor({
    timeout: 25_000,
  })
  await dialog.waitFor({ state: 'detached' })

  const prices = await getJson(
    api,
    `/catalog/product-prices/?product=${product.id}&price_tier=${data.priceLevel.tierId}`,
  )
  const configured = prices.results.find(
    (item) => item.price_tier === data.priceLevel.tierId,
  )
  assert(configured, 'El precio especial no quedó persistido en el backend.')
  assert.equal(Number(configured.unit_price), product.special)
  product.priceId = configured.id
  return `${product.name}: precio x${data.priceLevel.minimumQuantity} = ${formatMoney(product.special)}.`
}

async function createClient(page) {
  await goto(page, '/clients/new')
  await page.getByTitle('Crear tipo de cliente').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('Ej. Hotel').fill(data.clientType)
  const typeResponse = page.waitForResponse(
    (response) => endpointMatches(response, 'clients/types/', 'POST'),
  )
  await dialog.getByRole('button', { name: 'Crear tipo', exact: true }).click()
  const type = await responseJson(await typeResponse, 'Creación de tipo de cliente')
  await dialog.waitFor({ state: 'detached' })

  await fill(page, 'Nombre o razón social', data.client.name)
  await fill(page, 'NIT/CI', data.client.taxId)
  await fill(page, 'Departamento', data.client.department)
  await fill(page, 'Ciudad/Zona', data.client.city)
  await fill(page, 'WhatsApp', data.client.whatsapp)
  await fill(page, 'Rubro o actividad', 'Comercialización industrial')
  await select(page, 'Tipo de cliente', { label: type.name })
  await select(page, 'Nivel de precio', data.priceLevel.id)
  await fill(page, 'Observaciones', 'Cliente temporal creado por Playwright.')
  const client = await submitAndCapture(page, 'clients/', 'Crear cliente')
  data.client.id = client.id
  data.client.typeId = type.id
  await page.waitForURL(/\/clients(?:\?|$)/)
  return `Cliente ${client.name} asociado al nivel ${client.price_level.name}.`
}

async function createStock(page, product) {
  await goto(page, '/inventory/stocks/new')
  await select(page, 'Producto', product.id)
  await select(page, 'Almacén', data.warehouse.id)
  await fill(page, 'Stock mínimo', product.minimumStock)
  const stock = await submitAndCapture(
    page,
    'inventory/stocks/',
    'Crear existencia',
  )
  product.stockId = stock.id
  await page.waitForURL(/\/inventory\/stocks(?:\?|$)/)
  return `Existencia vinculada para ${product.name} en ${data.warehouse.name}.`
}

async function addStock(page, api, product) {
  await goto(page, `/inventory/movements/new?product=${product.id}&type=ENTRY`)
  const stockSelect = await formField(page, 'Existencia')
  await stockSelect.waitFor()
  await stockSelect.selectOption(product.stockId)
  await select(page, 'Tipo', 'ENTRY')
  await fill(page, 'Cantidad', product.stock)
  await fill(page, 'Referencia', `QA-${RUN_ID}`)
  await fill(page, 'Observaciones', `Ingreso E2E de ${product.stock} unidades.`)
  const movement = await submitAndCapture(
    page,
    'inventory/movements/',
    'Registrar movimiento',
  )
  await page.waitForURL(/\/inventory\/movements(?:\?|$)/)
  const stock = await getJson(api, `/inventory/stocks/${product.stockId}/`)
  assert.equal(stock.quantity, product.stock)
  assert.equal(stock.available_quantity, product.stock)
  assert.equal(movement.resulting_quantity, product.stock)
  return `Entrada de ${product.stock} unidades; saldo disponible verificado en ${stock.available_quantity}.`
}

async function selectQuotationClient(page) {
  const search = page.getByPlaceholder('Escribe para buscar un cliente…')
  await search.fill(data.client.taxId)
  const result = page.getByRole('button', { name: new RegExp(data.client.name) })
  await result.waitFor({ timeout: 15_000 })
  await result.click()
  const clientField = await formField(page, 'Cliente')
  await clientField.waitFor()
  assert.equal(await clientField.inputValue(), data.client.name)
}

async function addQuotationProduct(page, product, quantity) {
  const search = page.getByPlaceholder('Buscar por nombre, código o SKU…')
  await search.fill(product.sku)
  const result = page.getByRole('button', {
    name: new RegExp(`${product.name}.*${product.sku}`),
  })
  await result.waitFor({ timeout: 15_000 })
  const priceResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname ===
        `/api/v1/catalog/products/${product.id}/quotation-price/`,
    { timeout: 15_000 },
  )
  await result.click()
  await responseJson(await priceResponse, `Cálculo inicial de ${product.name}`)

  const row = page.locator('tbody tr').filter({ hasText: product.sku })
  await row.waitFor()
  if (quantity !== 1) {
    const recalculation = page.waitForResponse(
      (response) => {
        const url = new URL(response.url())
        return (
          response.request().method() === 'GET' &&
          url.pathname === `/api/v1/catalog/products/${product.id}/quotation-price/` &&
          url.searchParams.get('quantity') === String(quantity)
        )
      },
      { timeout: 15_000 },
    )
    await row.getByLabel('Cantidad').fill(String(quantity))
    await responseJson(await recalculation, `Recálculo de ${product.name}`)
  }
  const expectedUnit =
    quantity >= data.priceLevel.minimumQuantity ? product.special : product.normal
  const expectedSubtotal = expectedUnit * quantity
  await waitForText(row.locator('td').nth(4), formatMoney(expectedUnit))
  await waitForText(row.locator('td').nth(5), formatMoney(expectedSubtotal))
  return { expectedUnit, expectedSubtotal }
}

async function createQuotation(page, api, specification) {
  await goto(page, '/quotations')
  await page.getByRole('heading', { name: 'Nueva cotización' }).waitFor()
  await selectQuotationClient(page)

  let expectedNormal = 0
  let expectedTotal = 0
  for (const line of specification.lines) {
    const calculated = await addQuotationProduct(page, line.product, line.quantity)
    expectedNormal += line.product.normal * line.quantity
    expectedTotal += calculated.expectedSubtotal
  }

  const summary = page.locator('aside')
  const normalTotal = summary
    .getByText('Subtotal normal', { exact: true })
    .locator('..')
    .locator('dd')
  const finalTotal = summary
    .getByText('Total final', { exact: true })
    .locator('..')
    .locator('dd')
  await waitForText(normalTotal, formatMoney(expectedNormal))
  await waitForText(finalTotal, formatMoney(expectedTotal))
  await select(page, 'Estado', 'issued')
  await fill(page, 'Notas', specification.notes)
  const quotation = await submitAndCapture(
    page,
    'quotations/',
    'Guardar cotización',
  )
  await page.waitForURL(new RegExp(`/quotations/${quotation.id}(?:\\?|$)`))

  assert.equal(quotation.status, 'issued')
  assert.equal(quotation.client, data.client.id)
  assert.equal(quotation.items.length, specification.lines.length)
  const persistedNormal = quotation.items.reduce(
    (total, item) => total + Number(item.normal_unit_price) * Number(item.quantity),
    0,
  )
  const persistedSavings = quotation.items.reduce(
    (total, item) => total + Number(item.savings),
    0,
  )
  assert.equal(persistedNormal, expectedNormal)
  assert.equal(Number(quotation.total), expectedTotal)
  assert.equal(persistedSavings, expectedNormal - expectedTotal)

  const persisted = await getJson(api, `/quotations/${quotation.id}/`)
  assert.equal(Number(persisted.total), expectedTotal)
  assert.equal(persisted.status, 'issued')
  await page.getByRole('heading', { name: quotation.number }).waitFor()
  await page.getByText(`Total: ${formatMoney(expectedTotal)}`, { exact: true }).waitFor()

  specification.id = quotation.id
  specification.number = quotation.number
  specification.expectedNormal = expectedNormal
  specification.expectedTotal = expectedTotal
  specification.expectedSavings = expectedNormal - expectedTotal
  return `${quotation.number}: ${specification.lines.length} producto(s), total ${formatMoney(expectedTotal)}, ahorro ${formatMoney(expectedNormal - expectedTotal)}.`
}

async function verifyHistory(page, quotations) {
  await goto(page, '/quotations/history')
  const search = page.getByPlaceholder('Buscar por número, cliente o producto…')
  for (const quotation of quotations) {
    await search.fill(quotation.number)
    const row = page.locator('tbody tr').filter({ hasText: quotation.number })
    await row.waitFor({ timeout: 15_000 })
    await row.getByText(data.client.name, { exact: true }).waitFor()
    await row.getByText(formatMoney(quotation.expectedTotal), { exact: true }).waitFor()
    await row.getByText('Emitida', { exact: true }).waitFor()
  }
  return `Historial validado para ${quotations.map((item) => item.number).join(', ')}.`
}

async function verifyPdf(api, quotation, paper) {
  const response = await api.get(
    `quotations/${quotation.id}/pdf/?paper=${paper}`,
  )
  assert(response.ok(), `PDF ${paper} respondió HTTP ${response.status()}.`)
  const contentType = response.headers()['content-type'] || ''
  assert.match(contentType, /application\/pdf/i)
  const body = await response.body()
  assert(body.length > 1_000, `El PDF ${paper} está vacío o es demasiado pequeño.`)
  assert.equal(body.subarray(0, 4).toString(), '%PDF')
  const target = path.join(ARTIFACT_DIR, `${quotation.number}-${paper}.pdf`)
  fs.writeFileSync(target, body)
  return `${paper}: ${(body.length / 1024).toFixed(1)} KiB`
}

async function roleVisibility(browser, username, expected, unexpected) {
  const context = await browser.newContext({
    locale: 'es-BO',
    viewport: { width: 1440, height: 1000 },
  })
  const page = await context.newPage()
  try {
    await login(page, username, ADMIN_PASSWORD)
    const nav = page.getByRole('navigation', { name: 'Navegación principal' })
    for (const label of expected) {
      await nav.getByRole('link', { name: label, exact: true }).waitFor()
    }
    for (const label of unexpected) {
      assert.equal(
        await nav.getByRole('link', { name: label, exact: true }).count(),
        0,
        `${username} no debería visualizar ${label}.`,
      )
    }
  } finally {
    await context.close()
  }
}

function markdownReport(finishedAt, fatalError) {
  const passed = results.filter((item) => item.status === 'APROBADO').length
  const failed = results.filter((item) => item.status === 'FALLIDO').length
  const rows = results
    .map(
      (item) =>
        `| ${item.id} | ${item.title.replace(/\|/g, '\\|')} | ${item.status} | ${(item.durationMs / 1000).toFixed(2)} s | ${(item.evidence || item.error || '').split('\n')[0].replace(/\|/g, '\\|')} |`,
    )
    .join('\n')
  const signals = [
    ...browserSignals.pageErrors.map((value) => `- Error de página: ${value}`),
    ...browserSignals.consoleErrors.map((value) => `- Consola: ${value}`),
    ...browserSignals.serverErrors.map((value) => `- Backend: ${value}`),
  ]
  return `# Informe QA E2E — CRM IDESEM

## Resumen

- Ejecución: \`${RUN_ID}\`
- Inicio: ${results[0]?.startedAt || now()}
- Fin: ${finishedAt}
- Frontend: ${FRONTEND_URL}
- API: ${API_URL}
- Navegador: Chromium (Playwright)
- Resultado: **${failed || fatalError ? 'FALLIDO' : 'APROBADO'}**
- Casos aprobados: ${passed}
- Casos fallidos: ${failed}

## Casos ejecutados

| ID | Caso | Resultado | Duración | Evidencia |
| --- | --- | --- | ---: | --- |
${rows}

## Datos de prueba creados

- Categoría: ${data.category.name} (${data.category.code})
- Nivel de precio: ${data.priceLevel.name}, regla desde ${data.priceLevel.minimumQuantity} unidades
- Cliente: ${data.client.name}, asociado a ${data.priceLevel.name}
- Almacén: ${data.warehouse.name} (${data.warehouse.code})
- Productos:
  - ${data.products[0].name}: normal ${formatMoney(data.products[0].normal)}, especial ${formatMoney(data.products[0].special)}, stock ${data.products[0].stock}
  - ${data.products[1].name}: normal ${formatMoney(data.products[1].normal)}, especial ${formatMoney(data.products[1].special)}, stock ${data.products[1].stock}

## Señales técnicas observadas

${signals.length ? signals.join('\n') : '- No se detectaron errores JavaScript, errores de consola ni respuestas HTTP 5xx durante la ejecución principal.'}

## Evidencias

- Capturas y PDFs: \`${path.relative(ROOT, ARTIFACT_DIR)}\`
- Resultado estructurado: \`qa/playwright/reports/latest.json\`
${fatalError ? `\n## Error que detuvo la ejecución\n\n\`\`\`\n${String(fatalError.stack || fatalError)}\n\`\`\`\n` : ''}
`
}

function writeReports(fatalError = null) {
  const finishedAt = now()
  const report = {
    runId: RUN_ID,
    startedAt: results[0]?.startedAt || finishedAt,
    finishedAt,
    frontendUrl: FRONTEND_URL,
    apiUrl: API_URL,
    headless: HEADLESS,
    status:
      results.some((item) => item.status === 'FALLIDO') || fatalError
        ? 'FALLIDO'
        : 'APROBADO',
    totals: {
      executed: results.length,
      passed: results.filter((item) => item.status === 'APROBADO').length,
      failed: results.filter((item) => item.status === 'FALLIDO').length,
    },
    testData: data,
    browserSignals,
    results,
    fatalError: fatalError
      ? fatalError instanceof Error
        ? fatalError.stack || fatalError.message
        : String(fatalError)
      : null,
  }
  const json = `${JSON.stringify(report, null, 2)}\n`
  const markdown = markdownReport(finishedAt, fatalError)
  const timestampedBase = path.join(REPORT_DIR, `qa-full-system-${RUN_ID}`)
  fs.writeFileSync(`${timestampedBase}.json`, json, 'utf8')
  fs.writeFileSync(`${timestampedBase}.md`, markdown, 'utf8')
  fs.writeFileSync(path.join(REPORT_DIR, 'latest.json'), json, 'utf8')
  fs.writeFileSync(path.join(REPORT_DIR, 'latest.md'), markdown, 'utf8')
  return {
    json: `${timestampedBase}.json`,
    markdown: `${timestampedBase}.md`,
  }
}

async function main() {
  let browser
  let context
  let api
  let fatalError = null
  try {
    browser = await chromium.launch({ headless: HEADLESS, slowMo: SLOW_MO })
    context = await browser.newContext({
      locale: 'es-BO',
      timezoneId: 'America/La_Paz',
      viewport: { width: 1600, height: 1100 },
      acceptDownloads: true,
    })
    const page = await context.newPage()
    currentPage = page
    page.on('pageerror', (error) => browserSignals.pageErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') browserSignals.consoleErrors.push(message.text())
    })
    page.on('response', (response) => {
      if (response.status() >= 500) {
        browserSignals.serverErrors.push(`${response.status()} ${response.url()}`)
      }
    })

    let adminSession
    await qaCase(
      'QA-AUTH-001',
      'Inicio de sesión administrativo y carga del panel',
      async () => {
        const value = await login(page, ADMIN_USERNAME, ADMIN_PASSWORD)
        adminSession = value
        assert.equal(value.user.username, ADMIN_USERNAME)
        assert(value.user.is_admin, 'La cuenta usada no tiene acceso administrativo.')
        await page
          .getByRole('heading', { name: 'Panel principal', exact: true, level: 2 })
          .waitFor()
        return `Sesión iniciada como ${value.user.username}; ${value.user.permissions.length} permisos efectivos.`
      },
    )

    api = await request.newContext({
      baseURL: `${API_URL}/`,
      extraHTTPHeaders: {
        Accept: 'application/json',
        Authorization: `Bearer ${adminSession.access}`,
      },
    })

    await qaCase('QA-CAT-001', 'Crear una categoría de productos', () =>
      createCategory(page),
    )
    await qaCase(
      'QA-PRICE-001',
      'Crear nivel de precio y regla automática desde tres unidades',
      () => createPriceLevelAndTier(page),
    )
    await qaCase('QA-INV-001', 'Crear un almacén activo', () =>
      createWarehouse(page),
    )
    await qaCase('QA-PROD-001', 'Crear primer producto con precio normal', () =>
      createProduct(page, data.products[0]),
    )
    await qaCase('QA-PROD-002', 'Crear segundo producto con precio normal', () =>
      createProduct(page, data.products[1]),
    )
    await qaCase(
      'QA-PRICE-002',
      'Asignar precio especial por cantidad al primer producto',
      () => configureProductSpecialPrice(page, api, data.products[0]),
    )
    await qaCase(
      'QA-PRICE-003',
      'Asignar precio especial por cantidad al segundo producto',
      () => configureProductSpecialPrice(page, api, data.products[1]),
    )
    await qaCase(
      'QA-CLIENT-001',
      'Crear tipo y cliente asociado al nivel de precio',
      () => createClient(page),
    )

    for (let index = 0; index < data.products.length; index += 1) {
      const product = data.products[index]
      await qaCase(
        `QA-INV-00${index + 2}`,
        `Vincular ${product.name} con el almacén`,
        () => createStock(page, product),
      )
      await qaCase(
        `QA-INV-00${index + 4}`,
        `Registrar entrada y validar saldo de ${product.name}`,
        () => addStock(page, api, product),
      )
    }

    const singleQuotation = {
      notes: `QA cotización de un producto ${RUN_ID}`,
      lines: [{ product: data.products[0], quantity: 1 }],
    }
    const multiQuotation = {
      notes: `QA cotización con precios por cantidad ${RUN_ID}`,
      lines: [
        { product: data.products[0], quantity: 3 },
        { product: data.products[1], quantity: 4 },
      ],
    }
    await qaCase(
      'QA-QUOTE-001',
      'Generar cotización emitida de un producto a precio normal',
      () => createQuotation(page, api, singleQuotation),
    )
    await qaCase(
      'QA-QUOTE-002',
      'Generar cotización emitida con varios productos y descuentos automáticos',
      () => createQuotation(page, api, multiQuotation),
    )
    await qaCase(
      'QA-QUOTE-003',
      'Validar persistencia, total y estado emitido en el historial',
      () => verifyHistory(page, [singleQuotation, multiQuotation]),
    )
    await qaCase(
      'QA-QUOTE-004',
      'Generar PDF estándar y papel rollo de la cotización',
      async () => {
        const standard = await verifyPdf(api, multiQuotation, 'standard')
        const roll = await verifyPdf(api, multiQuotation, 'roll')
        return `${standard}; ${roll}.`
      },
    )
    await qaCase(
      'QA-RBAC-001',
      'Validar navegación visible para el perfil Comercial',
      async () => {
        await roleVisibility(
          browser,
          'demo_comercial',
          ['Clientes', 'Cotizaciones', 'Historial de cotizaciones', 'Productos'],
          ['Inventario', 'Usuarios', 'Roles y permisos'],
        )
        return 'Comercial ve operación de ventas y no ve inventario ni administración.'
      },
    )
    await qaCase(
      'QA-RBAC-002',
      'Validar navegación visible para el perfil Inventario',
      async () => {
        await roleVisibility(
          browser,
          'demo_inventario',
          ['Productos', 'Inventario'],
          ['Clientes', 'Cotizaciones', 'Historial de cotizaciones', 'Usuarios'],
        )
        return 'Inventario ve catálogo e inventario y no ve ventas ni administración.'
      },
    )
    await qaCase(
      'QA-TECH-001',
      'Validar ausencia de errores JavaScript y respuestas HTTP 5xx',
      async () => {
        assert.deepEqual(browserSignals.pageErrors, [])
        assert.deepEqual(browserSignals.serverErrors, [])
        const relevantConsoleErrors = browserSignals.consoleErrors.filter(
          (value) =>
            !value.includes('favicon') &&
            !value.includes('Download the React DevTools'),
        )
        assert.deepEqual(relevantConsoleErrors, [])
        await screenshot('flujo-completo-aprobado', page)
        return 'Sin errores de página, consola relevantes ni respuestas HTTP 5xx.'
      },
    )
  } catch (error) {
    fatalError = error
  } finally {
    if (api) await api.dispose()
    if (context) await context.close()
    if (browser) await browser.close()
    const reports = writeReports(fatalError)
    console.log(`\nInforme Markdown: ${reports.markdown}`)
    console.log(`Informe JSON: ${reports.json}`)
  }
  if (fatalError) throw fatalError
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
