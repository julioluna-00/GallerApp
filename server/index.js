import { createServer } from 'node:http'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from 'node:crypto'
import { promisify } from 'node:util'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scrypt = promisify(scryptCallback)
const PORT = Number(process.env.PORT || process.env.API_PORT || 3001)
const SECRET = process.env.JWT_SECRET || 'gallerapp-demo-secret-cambiar-en-produccion'
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY)
const ALLOWED_ORIGINS = new Set([
  ...(process.env.WEB_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean),
  'http://localhost:8443',
])
if (Boolean(SUPABASE_URL) !== Boolean(SUPABASE_SECRET_KEY)) {
  throw new Error('Configura SUPABASE_URL y SUPABASE_SECRET_KEY juntos.')
}
if (process.env.NODE_ENV === 'production' && !USE_SUPABASE) {
  throw new Error('En producción se requiere Supabase para conservar los datos entre reinicios.')
}
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('En producción configura JWT_SECRET con al menos 32 caracteres aleatorios.')
}
const DB_FILE = resolve(dirname(fileURLToPath(import.meta.url)), 'data', 'users.json')
const TOKEN_TTL = 60 * 60 * 24
const EVENTS_FILE = resolve(dirname(fileURLToPath(import.meta.url)), 'data', 'events.json')
const ROOSTERS_FILE = resolve(dirname(fileURLToPath(import.meta.url)), 'data', 'roosters.json')
const FIGHTS_FILE = resolve(dirname(fileURLToPath(import.meta.url)), 'data', 'fights.json')
const BETS_FILE = resolve(dirname(fileURLToPath(import.meta.url)), 'data', 'bets.json')
const WAGERS_FILE = resolve(dirname(fileURLToPath(import.meta.url)), 'data', 'wagers.json')
const CHAT_MESSAGES_FILE = resolve(dirname(fileURLToPath(import.meta.url)), 'data', 'chat-messages.json')
const CHAT_MESSAGE_RETENTION_MS = 24 * 60 * 60 * 1000
const PASSWORD_RESETS_FILE = resolve(dirname(fileURLToPath(import.meta.url)), 'data', 'password-resets.json')
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000
const PASSWORD_RESET_MAX_ATTEMPTS = 5
const MP_TEST_ACCESS_TOKEN = process.env.MP_TEST_ACCESS_TOKEN || ''
const MP_TEST_WEBHOOK_SECRET = process.env.MP_TEST_WEBHOOK_SECRET || ''
const PUBLIC_API_URL = (process.env.PUBLIC_API_URL || 'https://gallerapp-api.onrender.com').replace(/\/$/, '')
const PUBLIC_WEB_URL = (process.env.PUBLIC_WEB_URL || 'https://gallerapp.vercel.app').replace(/\/$/, '')
const DEMO_PAYMENT_PACKAGES = [
  { id: 'demo-credits-small', title: 'Paquete demo inicial', creditAmount: 10000, priceCop: 1000 },
  { id: 'demo-credits-large', title: 'Paquete demo ampliado', creditAmount: 60000, priceCop: 5000 },
]

const defaultEvents = [
  { id: '1', name: 'Gran Derby GallerApp', date: '2026-03-07', time: '7:30 PM', arena: 'Principal', fights: 14, status: 'live', prize: 25000000 },
  { id: '2', name: 'Copa Elite', date: '2026-03-12', time: '8:00 PM', arena: 'Principal', fights: 12, status: 'upcoming', prize: 0 },
  { id: '3', name: 'Torneo del Campeon', date: '2026-03-18', time: '7:00 PM', arena: 'Norte', fights: 16, status: 'upcoming', prize: 0 },
  { id: '4', name: 'Clasico de la Montana', date: '2026-03-22', time: '6:30 PM', arena: 'Principal', fights: 10, status: 'upcoming', prize: 0 },
  { id: '5', name: 'Derby de Campeones', date: '2026-02-28', time: '8:30 PM', arena: 'Central', fights: 15, status: 'finished', prize: 0 },
  { id: '6', name: 'Copa Apertura', date: '2026-02-20', time: '7:30 PM', arena: 'Principal', fights: 11, status: 'finished', prize: 0 },
]

const defaultRoosters = [
  { id: 'sample-1', name: 'Obsidiana', code: 'AN-458921', breed: 'Kelso', weight: '2.18 kg', age: '20 meses', arena: 'Principal', owner: 'Criadero El Roble', wins: 8, fights: 10, status: 'active', image: 'https://images.unsplash.com/photo-1695641442811-41e101d07a40?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900&h=720' },
  { id: 'sample-2', name: 'Sangre Real', code: 'AN-572104', breed: 'Hatch', weight: '2.12 kg', age: '18 meses', arena: 'San Miguel', owner: 'Gallera La Corona', wins: 6, fights: 8, status: 'active', image: 'https://images.unsplash.com/photo-1695641442793-adb6fcbbd7b1?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900&h=720' },
  { id: 'sample-3', name: 'Furia Dorada', code: 'AN-390847', breed: 'Sweater', weight: '2.24 kg', age: '22 meses', arena: 'Norte', owner: 'Los Hermanos', wins: 7, fights: 9, status: 'active', image: 'https://images.unsplash.com/photo-1695641442766-c8d9319df9a3?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900&h=720' },
  { id: 'sample-4', name: 'Rayo Negro', code: 'AN-611305', breed: 'Radio', weight: '2.09 kg', age: '17 meses', arena: 'Principal', owner: 'Criadero El Rayo', wins: 5, fights: 6, status: 'active', image: 'https://images.unsplash.com/photo-1583991191610-3a5967914b10?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900&h=720' },
  { id: 'sample-5', name: 'El Campeón', code: 'AN-284190', breed: 'Claret', weight: '2.20 kg', age: '31 meses', arena: 'Central', owner: 'Gallera La Unión', wins: 11, fights: 15, status: 'inactive', image: 'https://images.unsplash.com/photo-1602241501571-c0a8e741af2e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900&h=720' },
  { id: 'sample-6', name: 'Trueno Rojo', code: 'AN-194632', breed: 'Roundhead', weight: '2.16 kg', age: '29 meses', arena: 'San Miguel', owner: 'Criadero Santa Fe', wins: 9, fights: 13, status: 'inactive', image: 'https://images.unsplash.com/photo-1695641442793-adb6fcbbd7b1?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900&h=720' },
]

async function readStoredArray(key, file, fallback = []) {
  if (USE_SUPABASE) {
    const query = new URLSearchParams({ key: `eq.${key}`, select: 'value' })
    const response = await fetch(`${SUPABASE_URL}/rest/v1/app_state?${query}`, {
      headers: { apikey: SUPABASE_SECRET_KEY },
    })
    if (!response.ok) throw new Error(`Supabase respondió HTTP ${response.status} al leer ${key}.`)
    const [row] = await response.json()
    if (row) return row.value
    if (fallback !== undefined) {
      await writeStoredArray(key, file, fallback)
      return fallback
    }
    return []
  }
  try { return JSON.parse(await readFile(file, 'utf8')) }
  catch (error) {
    if (error.code !== 'ENOENT') throw error
    if (fallback !== undefined) {
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, JSON.stringify(fallback, null, 2), 'utf8')
    }
    return fallback ?? []
  }
}
async function writeStoredArray(key, file, value) {
  if (USE_SUPABASE) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/app_state?on_conflict=key`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
    })
    if (!response.ok) throw new Error(`Supabase respondió HTTP ${response.status} al guardar ${key}.`)
    return
  }
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(value, null, 2), 'utf8')
}
async function readUsers() {
  return readStoredArray('users', DB_FILE)
}
function normalizeDocument(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
}
let userMutationQueue = Promise.resolve()
function withUserMutationLock(action) {
  const operation = userMutationQueue.then(action, action)
  userMutationQueue = operation.then(() => undefined, () => undefined)
  return operation
}
async function saveUsers(users) {
  const documents = new Set()
  for (const user of users) {
    const normalized = normalizeDocument(user.documento)
    if (!normalized) continue
    if (documents.has(normalized)) {
      const error = new Error('Ya existe una cuenta con este número de cédula o pasaporte.')
      error.status = 409
      throw error
    }
    documents.add(normalized)
    user.documentoNormalizado = normalized
  }
  await writeStoredArray('users', DB_FILE, users)
}
async function readEvents() {
  return readStoredArray('events', EVENTS_FILE, defaultEvents)
}
async function saveEvents(events) {
  await writeStoredArray('events', EVENTS_FILE, events)
}
async function readRoosters() {
  return readStoredArray('roosters', ROOSTERS_FILE, defaultRoosters)
}
async function saveRoosters(roosters) {
  await writeStoredArray('roosters', ROOSTERS_FILE, roosters)
}
async function readFights() {
  return readStoredArray('fights', FIGHTS_FILE)
}
async function saveFights(fights) {
  await writeStoredArray('fights', FIGHTS_FILE, fights)
}
async function readBets() {
  return readStoredArray('bets', BETS_FILE)
}
async function saveBets(bets) {
  await writeStoredArray('bets', BETS_FILE, bets)
}
async function readWagers() {
  return readStoredArray('wagers', WAGERS_FILE)
}
async function saveWagers(wagers) {
  await writeStoredArray('wagers', WAGERS_FILE, wagers)
}
async function readChatMessages() {
  return readStoredArray('chat-messages', CHAT_MESSAGES_FILE)
}
async function saveChatMessages(messages) {
  await writeStoredArray('chat-messages', CHAT_MESSAGES_FILE, messages)
}
function retainRecentChatMessages(messages, now = Date.now()) {
  const cutoff = now - CHAT_MESSAGE_RETENTION_MS
  return messages.filter(message => {
    const createdAt = Date.parse(message?.createdAt)
    return Number.isFinite(createdAt) && createdAt > cutoff && createdAt <= now
  })
}
async function pruneExpiredChatMessages() {
  return withUserMutationLock(async () => {
    const messages = await readChatMessages()
    const recentMessages = retainRecentChatMessages(messages)
    if (recentMessages.length !== messages.length) await saveChatMessages(recentMessages)
    return recentMessages
  })
}
async function readPasswordResets() {
  return readStoredArray('password-resets', PASSWORD_RESETS_FILE)
}
async function savePasswordResets(resets) {
  await writeStoredArray('password-resets', PASSWORD_RESETS_FILE, resets)
}
function hashPasswordResetCode(code) {
  return createHmac('sha256', SECRET).update(code).digest('hex')
}
function wagerView(wager, viewerId = null) {
  const { creatorUserId, accepterUserId, ...publicWager } = wager
  return { ...publicWager, isMine: Boolean(viewerId && [creatorUserId, accepterUserId].includes(viewerId)) }
}
function cancelWager(wager, users, reason) {
  if (wager.status !== 'open' && wager.status !== 'accepted') return false
  const creator = users.find(user => user.id === wager.creatorUserId)
  if (creator) creator.saldo = (creator.saldo || 0) + wager.amount
  if (wager.status === 'accepted') {
    const accepter = users.find(user => user.id === wager.accepterUserId)
    if (accepter) accepter.saldo = (accepter.saldo || 0) + wager.amount
  }
  wager.status = 'cancelled'
  wager.cancelReason = reason
  wager.cancelledAt = new Date().toISOString()
  return true
}
function fightView(fight, events, roosters) {
  const event = events.find(item => item.id === fight.eventId)
  const roosterA = roosters.find(item => item.id === fight.roosterAId)
  const roosterB = roosters.find(item => item.id === fight.roosterBId)
  const nameA = roosterA?.name || fight.roosterAName
  const nameB = roosterB?.name || fight.roosterBName
  return {
    ...fight,
    eventName: event?.name || fight.eventName,
    eventDate: event?.date || fight.eventDate,
    eventTime: event?.time || fight.eventTime,
    eventArena: event?.arena || fight.eventArena,
    roosterA: { id: fight.roosterAId, name: nameA, code: roosterA?.code || fight.roosterACode, image: roosterA?.image || fight.roosterAImage, weight: roosterA?.weight || fight.roosterAWeight, breed: roosterA?.breed || fight.roosterABreed },
    roosterB: { id: fight.roosterBId, name: nameB, code: roosterB?.code || fight.roosterBCode, image: roosterB?.image || fight.roosterBImage, weight: roosterB?.weight || fight.roosterBWeight, breed: roosterB?.breed || fight.roosterBBreed },
    oddsA: Number(fight.oddsA) || 1.85,
    oddsB: Number(fight.oddsB) || 2.10,
    winnerRoosterName: fight.winnerRoosterId === fight.roosterAId ? nameA : fight.winnerRoosterId === fight.roosterBId ? nameB : null,
  }
}
function syncEventStatuses(events, fights) {
  let changed = false
  for (const event of events) {
    const eventFights = fights.filter(fight => fight.eventId === event.id)
    const nextStatus = eventFights.some(fight => fight.status === 'live')
      ? 'live'
      : eventFights.length > 0 && eventFights.every(fight => fight.status === 'finished')
        ? 'finished'
        : event.status === 'live' ? 'upcoming' : event.status
    if (event.status !== nextStatus) { event.status = nextStatus; changed = true }
  }
  return changed
}
function validRoosterProfile(input, current) {
  const name = String(input.name ?? current?.name ?? '').trim()
  const code = String(input.code ?? current?.code ?? '').trim()
  const breed = String(input.breed ?? current?.breed ?? '').trim()
  const arena = String(input.arena ?? current?.arena ?? '').trim()
  const weight = Number(input.weight ?? Number.parseFloat(current?.weight))
  const age = Number(input.age ?? Number.parseInt(current?.age, 10))
  const image = input.image ?? ''
  if (!name || !code || !breed || !arena || !Number.isFinite(weight) || weight <= 0 || !Number.isInteger(age) || age <= 0) return null
  if (typeof image !== 'string' || (image && !/^data:image\/(png|jpeg|webp);base64,[a-z\d+/]+={0,2}$/i.test(image))) return null
  if (image && Buffer.byteLength(image.split(',')[1], 'base64') > 1_500_000) return null
  return { name, code, breed, weight: `${weight.toFixed(2)} kg`, age: `${age} meses`, arena, image: image || current?.image || defaultRoosters[0].image }
}
function validRoosterInput(input) {
  const profile = validRoosterProfile(input)
  const wins = Number(input.wins)
  if (!profile || !Number.isInteger(wins) || wins < 0 || wins > 10000) return null
  return { ...profile, wins, fights: wins, status: 'active' }
}
function validateEvent(input) {
  const event = {
    name: String(input.name || '').trim(),
    date: String(input.date || ''),
    time: String(input.time || '').trim(),
    arena: String(input.arena || '').trim(),
    fights: Number(input.fights),
    status: String(input.status || ''),
    prize: Math.max(0, Number(input.prize) || 0),
  }
  if (!event.name || !/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !event.time || !event.arena || !Number.isInteger(event.fights) || event.fights < 1 || !['live', 'upcoming', 'finished'].includes(event.status)) return null
  return event
}
async function adminFor(req) {
  const user = await authenticatedUser(req)
  return user?.role === 'administrador' ? user : null
}
function respond(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' })
  res.end(JSON.stringify(body))
}
async function bodyOf(req) {
  let raw = ''
  for await (const chunk of req) { raw += chunk; if (raw.length > 2_100_000) throw new Error('La solicitud es demasiado grande.') }
  return JSON.parse(raw || '{}')
}
function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', SECRET).update(data).digest('base64url')
  return `${data}.${signature}`
}
function verify(token) {
  const [data, signature] = (token || '').split('.')
  if (!data || !signature) return null
  const expected = createHmac('sha256', SECRET).update(data).digest()
  let actual
  try { actual = Buffer.from(signature, 'base64url') } catch { return null }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString())
    return payload.exp > Date.now() / 1000 ? payload : null
  } catch { return null }
}
const publicUser = ({ passwordHash, passwordSalt, profileImage, documentoNormalizado, demoPayments, ...user }) => ({ role: 'usuario', ...user })

function demoPaymentView(payment) {
  return {
    id: payment.id,
    packageId: payment.packageId,
    creditAmount: payment.creditAmount,
    priceCop: payment.priceCop,
    status: payment.status,
    createdAt: payment.createdAt,
    approvedAt: payment.approvedAt || null,
    creditedAt: payment.creditedAt || null,
  }
}

function verifyMercadoPagoSignature(signatureHeader, requestId, dataId, secret) {
  if (!signatureHeader || !requestId || !dataId || !secret) return false
  const parts = Object.fromEntries(String(signatureHeader).split(',').map(part => {
    const separator = part.indexOf('=')
    return separator < 0 ? ['', ''] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
  }))
  if (!parts.ts || !parts.v1 || !/^[a-f0-9]{64}$/i.test(parts.v1)) return false
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest()
  const actual = Buffer.from(parts.v1, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

async function mercadoPagoRequest(path, options = {}) {
  if (!MP_TEST_ACCESS_TOKEN) {
    const error = new Error('La pasarela de prueba aún no está configurada en el servidor.')
    error.status = 503
    throw error
  }
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${MP_TEST_ACCESS_TOKEN}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error('Mercado Pago no pudo procesar la operación de prueba.')
    error.status = response.status >= 500 ? 502 : 400
    throw error
  }
  return data
}

function paymentReturnUrl(paymentId) {
  const url = new URL('/', PUBLIC_WEB_URL)
  url.searchParams.set('view', 'profile')
  url.searchParams.set('demo_payment', paymentId)
  return url.toString()
}

async function findProviderPayment(paymentId, externalReference) {
  if (paymentId) return mercadoPagoRequest(`/v1/payments/${encodeURIComponent(paymentId)}`)
  const query = new URLSearchParams({ external_reference: externalReference, sort: 'date_created', criteria: 'desc', limit: '10' })
  const result = await mercadoPagoRequest(`/v1/payments/search?${query}`)
  return (result.results || []).find(payment => payment.external_reference === externalReference) || null
}

async function syncDemoPayment({ paymentId, externalReference, verifiedPayment = null }) {
  const providerPayment = verifiedPayment || await findProviderPayment(paymentId, externalReference)
  if (!providerPayment) return { updated: false, status: 'pending' }
  if (providerPayment.live_mode !== false || providerPayment.external_reference !== externalReference) return { updated: false, status: 'rejected' }

  return withUserMutationLock(async () => {
    const users = await readUsers()
    const owner = users.find(item => (item.demoPayments || []).some(transaction => transaction.id === externalReference))
    if (!owner) return { updated: false, status: 'not_found' }
    const transaction = owner.demoPayments.find(item => item.id === externalReference)
    const expectedAmount = Number(transaction.priceCop)
    const paidAmount = Number(providerPayment.transaction_amount)
    if (providerPayment.currency_id !== 'COP' || !Number.isFinite(paidAmount) || Math.round(paidAmount * 100) !== Math.round(expectedAmount * 100)) {
      return { updated: false, status: 'rejected' }
    }

    transaction.providerPaymentId = String(providerPayment.id)
    transaction.status = String(providerPayment.status || 'pending')
    transaction.updatedAt = new Date().toISOString()
    if (providerPayment.status === 'approved' && !transaction.creditedAt) {
      const duplicateCredit = users.some(item => (item.demoPayments || []).some(existing => existing.id !== transaction.id && existing.providerPaymentId === String(providerPayment.id) && existing.creditedAt))
      if (!duplicateCredit) {
        owner.saldo = (Number(owner.saldo) || 0) + Number(transaction.creditAmount)
        transaction.creditedAt = transaction.updatedAt
        transaction.approvedAt = providerPayment.date_approved || transaction.updatedAt
      }
    }
    await saveUsers(users)
    return {
      updated: true,
      status: transaction.status,
      payment: demoPaymentView(transaction),
      profile: { ...publicUser(owner), profileImage: owner.profileImage || '' },
    }
  })
}

async function authenticatedUser(req) {
  const payload = verify((req.headers.authorization || '').replace(/^Bearer\s+/i, ''))
  if (!payload) return null
  return (await readUsers()).find(user => user.id === payload.sub) || null
}

const server = createServer(async (req, res) => {
  const requestOrigin = req.headers.origin
  if (requestOrigin && ALLOWED_ORIGINS.has(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin)
    res.setHeader('Vary', 'Origin')
  }
  if (req.method === 'OPTIONS') return respond(res, 204, {})
  const path = new URL(req.url, `http://${req.headers.host}`).pathname
  try {
    if (req.method === 'GET' && path === '/api/health') return respond(res, 200, { ok: true, service: 'GallerApp API' })
    if (req.method === 'POST' && path === '/api/auth/register') {
      const input = await bodyOf(req)
      const email = String(input.email || '').trim().toLowerCase()
      const password = String(input.password || '')
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) return respond(res, 400, { message: 'Ingresa un correo válido.' })
      if (password.length < 8) return respond(res, 400, { message: 'La contraseña debe tener al menos 8 caracteres.' })
      if (!input.acepta || !input.mayores) return respond(res, 400, { message: 'Debes aceptar los términos y confirmar que eres mayor de edad.' })
      const passwordSalt = randomBytes(16).toString('hex')
      const passwordHash = (await scrypt(password, passwordSalt, 64)).toString('hex')
      const user = { id: randomBytes(12).toString('hex'), email, role: 'usuario', nombre: String(input.nombre || '').trim(), apellido: String(input.apellido || '').trim(), telefono: String(input.telefono || '').trim(), pais: String(input.pais || 'Colombia'), fecha: String(input.fecha || ''), documento: String(input.documento || '').trim(), saldo: 50000, createdAt: new Date().toISOString(), passwordSalt, passwordHash }
      if (!user.nombre || !user.apellido || !user.telefono || !user.documento || user.documento.length > 40) return respond(res, 400, { message: 'Completa todos los datos personales y revisa el número de documento.' })
      const normalizedDocument = normalizeDocument(user.documento)
      if (!normalizedDocument) return respond(res, 400, { message: 'Ingresa un número de cédula o pasaporte válido.' })
      user.documentoNormalizado = normalizedDocument
      return await withUserMutationLock(async () => {
        const users = await readUsers()
        if (users.some(item => item.email.toLowerCase() === email)) return respond(res, 409, { message: 'Ya existe una cuenta con ese correo.' })
        if (users.some(item => (item.documentoNormalizado || normalizeDocument(item.documento)) === normalizedDocument)) return respond(res, 409, { message: 'Ya existe una cuenta con este número de cédula o pasaporte.' })
        users.push(user)
        await saveUsers(users)
        return respond(res, 201, { message: 'Cuenta creada correctamente.', user: publicUser(user) })
      })
    }
    if (req.method === 'POST' && path === '/api/auth/forgot-password') {
      const input = await bodyOf(req)
      const email = String(input.email || '').trim().toLowerCase()
      if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return respond(res, 400, { message: 'Ingresa un correo electrónico válido.' })
      if (process.env.NODE_ENV === 'production') return respond(res, 503, { message: 'La recuperación por correo aún no está configurada en este servidor. Contacta al administrador.' })
      return await withUserMutationLock(async () => {
        const [users, resets] = await Promise.all([readUsers(), readPasswordResets()])
        const user = users.find(item => item.email.toLowerCase() === email)
        const message = 'Si el correo corresponde a una cuenta, se generó un código de recuperación válido durante 15 minutos.'
        if (!user) return respond(res, 200, { message })
        const code = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0')
        const activeResets = resets.filter(item => item.userId !== user.id && Date.parse(item.expiresAt) > Date.now())
        activeResets.push({ userId: user.id, codeHash: hashPasswordResetCode(code), attempts: 0, expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString() })
        await savePasswordResets(activeResets)
        return respond(res, 200, { message, developmentCode: code })
      })
    }
    if (req.method === 'POST' && path === '/api/auth/reset-password') {
      const input = await bodyOf(req)
      const email = String(input.email || '').trim().toLowerCase()
      const code = String(input.code || '').trim()
      const password = String(input.password || '')
      if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(code)) return respond(res, 400, { message: 'Ingresa el correo y el código de seis dígitos.' })
      if (password.length < 8) return respond(res, 400, { message: 'La nueva contraseña debe tener al menos 8 caracteres.' })
      return await withUserMutationLock(async () => {
        const [users, resets] = await Promise.all([readUsers(), readPasswordResets()])
        const user = users.find(item => item.email.toLowerCase() === email)
        const reset = user && resets.find(item => item.userId === user.id)
        if (!user || !reset || Date.parse(reset.expiresAt) <= Date.now() || reset.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) return respond(res, 400, { message: 'El código es inválido o venció. Solicita uno nuevo.' })
        const submittedHash = Buffer.from(hashPasswordResetCode(code), 'hex')
        const storedHash = Buffer.from(reset.codeHash, 'hex')
        if (submittedHash.length !== storedHash.length || !timingSafeEqual(submittedHash, storedHash)) {
          reset.attempts += 1
          await savePasswordResets(resets)
          return respond(res, 400, { message: reset.attempts >= PASSWORD_RESET_MAX_ATTEMPTS ? 'Se agotaron los intentos. Solicita un código nuevo.' : 'El código no coincide. Revisa los seis dígitos e inténtalo de nuevo.' })
        }
        user.passwordSalt = randomBytes(16).toString('hex')
        user.passwordHash = (await scrypt(password, user.passwordSalt, 64)).toString('hex')
        await saveUsers(users)
        await savePasswordResets(resets.filter(item => item.userId !== user.id))
        return respond(res, 200, { message: 'Contraseña actualizada. Ya puedes iniciar sesión con la nueva contraseña.' })
      })
    }
    if (req.method === 'POST' && path === '/api/auth/login') {
      const input = await bodyOf(req)
      const email = String(input.email || '').trim().toLowerCase()
      const users = await readUsers()
      const user = users.find(item => item.email === email)
      if (!user) return respond(res, 401, { message: 'Correo o contraseña incorrectos.' })
      const hash = await scrypt(String(input.password || ''), user.passwordSalt, 64)
      if (!timingSafeEqual(hash, Buffer.from(user.passwordHash, 'hex'))) return respond(res, 401, { message: 'Correo o contraseña incorrectos.' })
      const token = sign({ sub: user.id, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL })
      return respond(res, 200, { message: 'Inicio de sesión correcto.', token, user: publicUser(user) })
    }
    if (req.method === 'GET' && path === '/api/auth/me') {
      const user = await authenticatedUser(req)
      return user ? respond(res, 200, { user: publicUser(user) }) : respond(res, 401, { message: 'Usuario no encontrado.' })
    }
    if (path === '/api/auth/profile' && ['GET', 'PUT'].includes(req.method)) {
      const user = await authenticatedUser(req)
      if (!user) return respond(res, 401, { message: 'Inicia sesión para consultar tu perfil.' })
      if (req.method === 'GET') return respond(res, 200, { profile: { ...publicUser(user), profileImage: user.profileImage || '' } })
      const input = await bodyOf(req)
      const email = String(input.email || '').trim().toLowerCase()
      const nombre = String(input.nombre || '').trim()
      const apellido = String(input.apellido || '').trim()
      const telefono = String(input.telefono || '').trim()
      const pais = String(input.pais || '').trim()
      const fecha = String(input.fecha || '').trim()
      const documento = String(input.documento || '').trim()
      const profileImage = typeof input.profileImage === 'string' ? input.profileImage : user.profileImage || ''
      const imageBytes = profileImage.startsWith('data:image/') ? Math.floor((profileImage.split(',')[1] || '').length * 0.75) : 0
      if (!/^\S+@\S+\.\S+$/.test(email) || !nombre || !apellido || !telefono || !pais || !documento || (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha))) return respond(res, 400, { message: 'Revisa el correo y completa tus datos personales.' })
      if (email.length > 254 || nombre.length > 80 || apellido.length > 80 || telefono.length > 30 || pais.length > 80 || documento.length > 40) return respond(res, 400, { message: 'Uno de los datos supera el largo permitido.' })
      if (profileImage && (!/^data:image\/jpeg;base64,/.test(profileImage) || imageBytes > 1_500_000)) return respond(res, 400, { message: 'La foto debe ser JPG y no superar 1.5 MB.' })
      const normalizedDocument = normalizeDocument(documento)
      if (!normalizedDocument) return respond(res, 400, { message: 'Ingresa un número de cédula o pasaporte válido.' })
      return await withUserMutationLock(async () => {
        const users = await readUsers()
        if (users.some(item => item.id !== user.id && item.email.toLowerCase() === email)) return respond(res, 409, { message: 'Ese correo ya está asociado a otra cuenta.' })
        if (users.some(item => item.id !== user.id && (item.documentoNormalizado || normalizeDocument(item.documento)) === normalizedDocument)) return respond(res, 409, { message: 'Ese número de cédula o pasaporte ya está asociado a otra cuenta.' })
        const storedUser = users.find(item => item.id === user.id)
        Object.assign(storedUser, { email, nombre, apellido, telefono, pais, fecha, documento, documentoNormalizado: normalizedDocument, profileImage })
        await saveUsers(users)
        return respond(res, 200, { message: 'Perfil actualizado correctamente.', profile: { ...publicUser(storedUser), profileImage: storedUser.profileImage || '' } })
      })
    }
    if (req.method === 'GET' && path === '/api/payments/demo/config') {
      return respond(res, 200, {
        provider: 'Mercado Pago · modo de prueba',
        enabled: Boolean(MP_TEST_ACCESS_TOKEN && MP_TEST_WEBHOOK_SECRET),
        packages: DEMO_PAYMENT_PACKAGES.map(({ id, title, creditAmount, priceCop }) => ({ id, title, creditAmount, priceCop })),
      })
    }
    if (req.method === 'POST' && path === '/api/payments/demo/checkout') {
      const user = await authenticatedUser(req)
      if (!user) return respond(res, 401, { message: 'Inicia sesión para abrir el checkout de prueba.' })
      if (!MP_TEST_ACCESS_TOKEN || !MP_TEST_WEBHOOK_SECRET) return respond(res, 503, { message: 'El checkout de prueba aún no está configurado en Render.' })
      const input = await bodyOf(req)
      const selectedPackage = DEMO_PAYMENT_PACKAGES.find(item => item.id === input.packageId)
      if (!selectedPackage) return respond(res, 400, { message: 'Selecciona uno de los paquetes demo disponibles.' })

      const transaction = await withUserMutationLock(async () => {
        const users = await readUsers()
        const storedUser = users.find(item => item.id === user.id)
        if (!storedUser) return null
        const payment = {
          id: randomBytes(18).toString('hex'),
          packageId: selectedPackage.id,
          creditAmount: selectedPackage.creditAmount,
          priceCop: selectedPackage.priceCop,
          status: 'pending',
          createdAt: new Date().toISOString(),
        }
        storedUser.demoPayments = [...(storedUser.demoPayments || []), payment].slice(-30)
        await saveUsers(users)
        return payment
      })
      if (!transaction) return respond(res, 404, { message: 'No se encontró tu cuenta.' })

      try {
        const returnUrl = paymentReturnUrl(transaction.id)
        const preference = await mercadoPagoRequest('/checkout/preferences', {
          method: 'POST',
          body: JSON.stringify({
            items: [{
              id: selectedPackage.id,
              title: `${selectedPackage.title} · créditos ficticios`,
              description: 'Demostración de GallerApp. Créditos sin valor monetario, no canjeables.',
              quantity: 1,
              currency_id: 'COP',
              unit_price: selectedPackage.priceCop,
            }],
            external_reference: transaction.id,
            notification_url: `${PUBLIC_API_URL}/api/payments/webhook`,
            back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
            auto_return: 'approved',
            metadata: { demo_user_id: user.id, demo_package_id: selectedPackage.id },
          }),
        })
        const checkoutUrl = String(preference.sandbox_init_point || '')
        if (!checkoutUrl) throw new Error('Mercado Pago no devolvió un enlace de checkout Sandbox.')
        let safeCheckout
        try { safeCheckout = new URL(checkoutUrl) }
        catch { throw new Error('Mercado Pago devolvió un enlace Sandbox inválido.') }
        const allowedHost = safeCheckout.hostname === 'mercadopago.com' || safeCheckout.hostname.endsWith('.mercadopago.com') || safeCheckout.hostname === 'mercadopago.com.co' || safeCheckout.hostname.endsWith('.mercadopago.com.co')
        if (!allowedHost || safeCheckout.protocol !== 'https:') throw new Error('Mercado Pago no devolvió una URL de checkout Sandbox segura.')

        await withUserMutationLock(async () => {
          const users = await readUsers()
          const storedUser = users.find(item => item.id === user.id)
          const storedPayment = storedUser?.demoPayments?.find(item => item.id === transaction.id)
          if (storedPayment) {
            storedPayment.preferenceId = String(preference.id || '')
            await saveUsers(users)
          }
        })
        return respond(res, 201, { checkoutUrl: safeCheckout.toString(), payment: demoPaymentView(transaction) })
      } catch (error) {
        await withUserMutationLock(async () => {
          const users = await readUsers()
          const storedUser = users.find(item => item.id === user.id)
          const storedPayment = storedUser?.demoPayments?.find(item => item.id === transaction.id)
          if (storedPayment) {
            storedPayment.status = 'error'
            await saveUsers(users)
          }
        })
        throw error
      }
    }
    if (req.method === 'GET' && path === '/api/payments/demo/history') {
      const user = await authenticatedUser(req)
      if (!user) return respond(res, 401, { message: 'Inicia sesión para consultar tus pagos de prueba.' })
      const storedUser = (await readUsers()).find(item => item.id === user.id)
      const payments = (storedUser?.demoPayments || []).slice(-10).reverse().map(demoPaymentView)
      return respond(res, 200, { payments })
    }
    const demoPaymentRoute = path.match(/^\/api\/payments\/demo\/([a-f0-9]{36})\/sync$/)
    if (req.method === 'POST' && demoPaymentRoute) {
      const user = await authenticatedUser(req)
      if (!user) return respond(res, 401, { message: 'Inicia sesión para verificar el pago de prueba.' })
      const transaction = (user.demoPayments || []).find(item => item.id === demoPaymentRoute[1])
      if (!transaction) return respond(res, 404, { message: 'No se encontró ese checkout de prueba en tu cuenta.' })
      const input = await bodyOf(req)
      const paymentId = /^\d{1,30}$/.test(String(input.paymentId || '')) ? String(input.paymentId) : ''
      const result = await syncDemoPayment({ paymentId, externalReference: transaction.id })
      const currentUser = (await readUsers()).find(item => item.id === user.id)
      return respond(res, 200, {
        payment: result.payment || demoPaymentView((currentUser?.demoPayments || []).find(item => item.id === transaction.id) || transaction),
        profile: currentUser ? { ...publicUser(currentUser), profileImage: currentUser.profileImage || '' } : null,
      })
    }
    if (req.method === 'POST' && path === '/api/payments/webhook') {
      if (!MP_TEST_ACCESS_TOKEN || !MP_TEST_WEBHOOK_SECRET) return respond(res, 503, { message: 'Webhook de pagos de prueba no configurado.' })
      const url = new URL(req.url, `http://${req.headers.host}`)
      const input = await bodyOf(req)
      const dataId = String(url.searchParams.get('data.id') || input.data?.id || '')
      if (!verifyMercadoPagoSignature(req.headers['x-signature'], req.headers['x-request-id'], dataId, MP_TEST_WEBHOOK_SECRET)) {
        return respond(res, 401, { message: 'Firma del webhook inválida.' })
      }
      const topic = String(url.searchParams.get('type') || url.searchParams.get('topic') || input.type || input.topic || '')
      if (topic !== 'payment' || !/^\d{1,30}$/.test(dataId)) return respond(res, 200, { ok: true })
      const providerPayment = await mercadoPagoRequest(`/v1/payments/${encodeURIComponent(dataId)}`)
      if (providerPayment.live_mode === false && providerPayment.external_reference) {
        await syncDemoPayment({ paymentId: dataId, externalReference: providerPayment.external_reference, verifiedPayment: providerPayment })
      }
      return respond(res, 200, { ok: true })
    }
    if (req.method === 'GET' && path === '/api/roosters') return respond(res, 200, { roosters: await readRoosters() })
    if (req.method === 'POST' && path === '/api/roosters') {
      const input = await bodyOf(req)
      const values = validRoosterInput(input)
      if (!values) return respond(res, 400, { message: 'Revisa los datos del gallo y usa una foto JPG, PNG o WEBP de máximo 1.5 MB.' })
      const user = await authenticatedUser(req)
      return await withUserMutationLock(async () => {
        const roosters = await readRoosters()
        if (roosters.some(rooster => rooster.code.toLowerCase() === values.code.toLowerCase())) return respond(res, 409, { message: 'Ya existe un gallo con ese número de anillo o placa.' })
        const created = { id: randomBytes(12).toString('hex'), ...values, owner: user ? `${user.nombre} ${user.apellido}`.trim() : 'Participante', createdAt: new Date().toISOString() }
        roosters.unshift(created)
        await saveRoosters(roosters)
        return respond(res, 201, { message: 'Gallo inscrito correctamente.', rooster: created })
      })
    }
    const roosterRoute = path.match(/^\/api\/admin\/roosters\/([^/]+)(?:\/(wins))?$/)
    if (roosterRoute && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
      if (!await adminFor(req)) return respond(res, 403, { message: 'Solo un administrador puede modificar los gallos.' })
      const input = req.method === 'PUT' && !roosterRoute[2] ? await bodyOf(req) : undefined
      return await withUserMutationLock(async () => {
        const roosters = await readRoosters()
        const index = roosters.findIndex(rooster => rooster.id === roosterRoute[1])
        if (index < 0) return respond(res, 404, { message: 'Gallo no encontrado.' })
        const rooster = roosters[index]
        if (req.method === 'DELETE' && !roosterRoute[2]) {
          const fights = await readFights()
          if (fights.some(fight => (fight.roosterAId === rooster.id || fight.roosterBId === rooster.id) && fight.status !== 'finished')) return respond(res, 409, { message: 'No puedes eliminar un gallo que tiene peleas pendientes o en vivo.' })
          roosters.splice(index, 1)
          await saveRoosters(roosters)
          return respond(res, 200, { message: 'Gallo eliminado correctamente.' })
        }
        if (req.method === 'POST' && roosterRoute[2] === 'wins') {
          if (rooster.status !== 'active') return respond(res, 409, { message: 'Un gallo inactivo no puede sumar victorias.' })
          rooster.wins += 1
          rooster.fights += 1
          await saveRoosters(roosters)
          return respond(res, 200, { rooster })
        }
        if (req.method === 'PUT' && !roosterRoute[2]) {
          if (!input || typeof input !== 'object' || Array.isArray(input)) return respond(res, 400, { message: 'Revisa los datos del gallo.' })
          const status = input.status === undefined ? rooster.status : input.status
          if (!['active', 'inactive'].includes(status)) return respond(res, 400, { message: 'El estado debe ser activo o inactivo.' })
          if (rooster.status === 'inactive' && status === 'active') return respond(res, 409, { message: 'Un gallo inactivo no se puede reactivar.' })
          if (rooster.status === 'active' && status === 'inactive') {
            const fights = await readFights()
            if (fights.some(fight => (fight.roosterAId === rooster.id || fight.roosterBId === rooster.id) && fight.status !== 'finished')) return respond(res, 409, { message: 'Finaliza o cancela las peleas pendientes antes de dar de baja este gallo.' })
          }
          const profile = validRoosterProfile(input, rooster)
          const owner = typeof input.owner === 'string' ? input.owner.trim() : rooster.owner
          if (!profile || ('owner' in input && (typeof input.owner !== 'string' || !owner))) return respond(res, 400, { message: 'Revisa los datos del gallo y usa una foto JPG, PNG o WEBP de máximo 1.5 MB.' })
          if (roosters.some(other => other.id !== rooster.id && other.code.toLowerCase() === profile.code.toLowerCase())) return respond(res, 409, { message: 'Ya existe un gallo con ese número de anillo o placa.' })
          const updated = { ...rooster, ...profile, owner, status }
          roosters[index] = updated
          await saveRoosters(roosters)
          return respond(res, 200, { rooster: updated })
        }
        return respond(res, 404, { message: 'Ruta no encontrada.' })
      })
    }
    if (req.method === 'GET' && path === '/api/fights') {
      const [fights, events, roosters] = await Promise.all([readFights(), readEvents(), readRoosters()])
      return respond(res, 200, { fights: fights.map(fight => fightView(fight, events, roosters)) })
    }
    if (req.method === 'GET' && path === '/api/wagers') {
      const viewer = await authenticatedUser(req)
      const [wagers, fights] = await Promise.all([readWagers(), readFights()])
      const currentFightIds = new Set(fights.filter(fight => fight.status === 'upcoming' || fight.status === 'live').map(fight => fight.id))
      const visible = wagers.filter(wager => currentFightIds.has(wager.fightId) && ['open', 'accepted'].includes(wager.status))
      const myWagers = viewer ? wagers.filter(wager => wager.creatorUserId === viewer.id || wager.accepterUserId === viewer.id) : []
      return respond(res, 200, { wagers: visible.map(wager => wagerView(wager, viewer?.id)), myWagers: myWagers.map(wager => wagerView(wager, viewer?.id)) })
    }
    if (req.method === 'GET' && path === '/api/chat/messages') {
      const messages = await pruneExpiredChatMessages()
      return respond(res, 200, { messages: messages.slice(-100).map(({ userId, ...message }) => message) })
    }
    if (req.method === 'POST' && path === '/api/chat/messages') {
      const viewer = await authenticatedUser(req)
      if (!viewer) return respond(res, 401, { message: 'Inicia sesión para participar en el chat.' })
      const input = await bodyOf(req)
      const message = String(input.message || '').trim()
      if (!message || message.length > 500) return respond(res, 400, { message: 'Escribe un mensaje de hasta 500 caracteres.' })
      return await withUserMutationLock(async () => {
        const messages = retainRecentChatMessages(await readChatMessages())
        const chatMessage = {
          id: randomBytes(12).toString('hex'),
          userId: viewer.id,
          user: `${viewer.nombre} ${viewer.apellido}`.trim() || viewer.email.split('@')[0],
          msg: message,
          time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }),
          createdAt: new Date().toISOString(),
        }
        messages.push(chatMessage)
        await saveChatMessages(messages.slice(-500))
        const { userId, ...publicMessage } = chatMessage
        return respond(res, 201, { message: publicMessage })
      })
    }
    if (req.method === 'POST' && path === '/api/wagers') {
      const viewer = await authenticatedUser(req)
      if (!viewer) return respond(res, 401, { message: 'Inicia sesión para proponer una apuesta.' })
      const input = await bodyOf(req)
      const amount = Number(input.amount)
      if (!Number.isSafeInteger(amount) || amount < 1000 || !Number.isSafeInteger(amount * 2)) return respond(res, 400, { message: 'El monto mínimo es $1.000 y debe ser válido para pagar el pozo.' })
      return await withUserMutationLock(async () => {
        const [fights, wagers, users] = await Promise.all([readFights(), readWagers(), readUsers()])
        const fight = fights.find(item => item.id === String(input.fightId || ''))
        if (!fight || fight.status !== 'upcoming') return respond(res, 409, { message: 'Solo puedes proponer apuestas antes de que inicie el combate.' })
        const roosterId = String(input.roosterId || '')
        if (![fight.roosterAId, fight.roosterBId].includes(roosterId)) return respond(res, 400, { message: 'Selecciona uno de los gallos de esta pelea.' })
        const storedUser = users.find(item => item.id === viewer.id)
        if (!storedUser || amount > (storedUser.saldo || 0)) return respond(res, 409, { message: 'No tienes saldo suficiente para reservar esa apuesta.' })
        const roosters = await readRoosters()
        const rooster = roosters.find(item => item.id === roosterId)
        const wager = {
          id: randomBytes(12).toString('hex'), fightId: fight.id, fightNumber: fight.number, eventName: fight.eventName,
          creatorUserId: storedUser.id, creatorName: `${storedUser.nombre} ${storedUser.apellido}`.trim(),
          creatorRoosterId: roosterId, creatorRoosterName: rooster?.name || (roosterId === fight.roosterAId ? fight.roosterAName : fight.roosterBName),
          accepterUserId: null, accepterName: null, accepterRoosterId: null, accepterRoosterName: null,
          amount, status: 'open', createdAt: new Date().toISOString(), acceptedAt: null, settledAt: null,
        }
        storedUser.saldo -= amount
        wagers.push(wager)
        await Promise.all([saveUsers(users), saveWagers(wagers)])
        return respond(res, 201, { wager: wagerView(wager, storedUser.id), user: publicUser(storedUser) })
      })
    }
    const wagerRoute = path.match(/^\/api\/wagers\/([^/]+)(?:\/(accept))?$/)
    if (wagerRoute && req.method === 'POST' && wagerRoute[2] === 'accept') {
      const viewer = await authenticatedUser(req)
      if (!viewer) return respond(res, 401, { message: 'Inicia sesión para aceptar una apuesta.' })
      return await withUserMutationLock(async () => {
        const [fights, wagers, users, roosters] = await Promise.all([readFights(), readWagers(), readUsers(), readRoosters()])
        const wager = wagers.find(item => item.id === wagerRoute[1])
        if (!wager || wager.status !== 'open') return respond(res, 409, { message: 'Esta apuesta ya fue aceptada, cancelada o no existe.' })
        if (wager.creatorUserId === viewer.id) return respond(res, 409, { message: 'No puedes aceptar tu propia apuesta.' })
        const fight = fights.find(item => item.id === wager.fightId)
        if (!fight || fight.status !== 'upcoming') return respond(res, 409, { message: 'El combate ya inició; esta apuesta no se puede aceptar.' })
        const usersById = users.find(item => item.id === viewer.id)
        if (!usersById || wager.amount > (usersById.saldo || 0)) return respond(res, 409, { message: 'No tienes saldo suficiente para igualar esta apuesta.' })
        const accepterRoosterId = wager.creatorRoosterId === fight.roosterAId ? fight.roosterBId : fight.roosterAId
        const accepterRooster = roosters.find(item => item.id === accepterRoosterId)
        if (!accepterRooster) return respond(res, 409, { message: 'No se encuentra el gallo rival de esta pelea.' })
        usersById.saldo -= wager.amount
        wager.accepterUserId = usersById.id
        wager.accepterName = `${usersById.nombre} ${usersById.apellido}`.trim()
        wager.accepterRoosterId = accepterRoosterId
        wager.accepterRoosterName = accepterRooster.name
        wager.status = 'accepted'
        wager.acceptedAt = new Date().toISOString()
        await Promise.all([saveUsers(users), saveWagers(wagers)])
        return respond(res, 200, { wager: wagerView(wager, usersById.id), user: publicUser(usersById) })
      })
    }
    if (wagerRoute && req.method === 'DELETE' && !wagerRoute[2]) {
      const viewer = await authenticatedUser(req)
      if (!viewer) return respond(res, 401, { message: 'Inicia sesión para cancelar tu propuesta.' })
      return await withUserMutationLock(async () => {
        const [wagers, users] = await Promise.all([readWagers(), readUsers()])
        const wager = wagers.find(item => item.id === wagerRoute[1])
        if (!wager || wager.creatorUserId !== viewer.id || wager.status !== 'open') return respond(res, 409, { message: 'Solo puedes cancelar tus propuestas que aún nadie ha aceptado.' })
        cancelWager(wager, users, 'creator_cancelled')
        await Promise.all([saveUsers(users), saveWagers(wagers)])
        return respond(res, 200, { wager: wagerView(wager, viewer.id), user: publicUser(users.find(item => item.id === viewer.id)) })
      })
    }
    if (req.method === 'GET' && path === '/api/bets/me') {
      const user = await authenticatedUser(req)
      if (!user) return respond(res, 401, { message: 'Inicia sesión para consultar tus apuestas.' })
      const bets = await readBets()
      return respond(res, 200, { bets: bets.filter(bet => bet.userId === user.id).map(({ userId, ...bet }) => bet) })
    }
    if (req.method === 'POST' && path === '/api/bets') {
      return respond(res, 410, { message: 'Las apuestas por cuota fueron reemplazadas por retos 1 vs 1. Publica o acepta una propuesta desde Peleas y apuestas.' })
    }
    if (req.method === 'GET' && path === '/api/events') {
      const [events, fights] = await Promise.all([readEvents(), readFights()])
      if (syncEventStatuses(events, fights)) await saveEvents(events)
      return respond(res, 200, { events })
    }
    if (path === '/api/admin/events' && req.method === 'POST') {
      if (!await adminFor(req)) return respond(res, 403, { message: 'Solo un administrador puede modificar los eventos.' })
      const event = validateEvent(await bodyOf(req))
      if (!event) return respond(res, 400, { message: 'Revisa el nombre, fecha, hora, lugar, numero de peleas y estado.' })
      const events = await readEvents()
      const created = { id: randomBytes(12).toString('hex'), ...event }
      events.push(created)
      await saveEvents(events)
      return respond(res, 201, { event: created })
    }
    const eventRoute = path.match(/^\/api\/admin\/events\/([^/]+)$/)
    if (eventRoute && ['PUT', 'DELETE'].includes(req.method)) {
      if (!await adminFor(req)) return respond(res, 403, { message: 'Solo un administrador puede modificar los eventos.' })
      const events = await readEvents()
      const index = events.findIndex(event => event.id === eventRoute[1])
      if (index < 0) return respond(res, 404, { message: 'Evento no encontrado.' })
      if (req.method === 'DELETE') {
        return await withUserMutationLock(async () => {
          const [currentEvents, fights, wagers, users] = await Promise.all([readEvents(), readFights(), readWagers(), readUsers()])
          if (!currentEvents.some(event => event.id === eventRoute[1])) return respond(res, 404, { message: 'Evento no encontrado.' })
          if (fights.some(fight => fight.eventId === eventRoute[1] && fight.status === 'live')) return respond(res, 409, { message: 'Finaliza la pelea en vivo antes de eliminar el evento.' })
          const removedFightIds = new Set(fights.filter(fight => fight.eventId === eventRoute[1]).map(fight => fight.id))
          for (const wager of wagers.filter(item => removedFightIds.has(item.fightId) && ['open', 'accepted'].includes(item.status))) cancelWager(wager, users, 'event_cancelled')
          await Promise.all([
            saveEvents(currentEvents.filter(event => event.id !== eventRoute[1])),
            saveFights(fights.filter(fight => fight.eventId !== eventRoute[1])),
            saveWagers(wagers),
            saveUsers(users),
          ])
          return respond(res, 200, { message: 'Evento y sus peleas eliminados; los montos reservados fueron devueltos.' })
        })
      }
      const updated = validateEvent(await bodyOf(req))
      if (!updated) return respond(res, 400, { message: 'Revisa el nombre, fecha, hora, lugar, numero de peleas y estado.' })
      if (updated.status === 'finished') {
        const fights = await readFights()
        if (fights.some(fight => fight.eventId === eventRoute[1] && fight.status !== 'finished')) return respond(res, 409, { message: 'Cancela o finaliza las peleas pendientes antes de finalizar el evento.' })
      }
      events[index] = { id: events[index].id, ...updated }
      await saveEvents(events)
      return respond(res, 200, { event: events[index] })
    }
    if (req.method === 'POST' && path === '/api/admin/fights') {
      if (!await adminFor(req)) return respond(res, 403, { message: 'Solo un administrador puede programar peleas.' })
      const input = await bodyOf(req)
      const [events, roosters, fights] = await Promise.all([readEvents(), readRoosters(), readFights()])
      const event = events.find(item => item.id === String(input.eventId || ''))
      const roosterA = roosters.find(item => item.id === String(input.roosterAId || ''))
      const roosterB = roosters.find(item => item.id === String(input.roosterBId || ''))
      if (!event || event.status === 'finished') return respond(res, 400, { message: 'Selecciona un evento vigente.' })
      if (!roosterA || !roosterB || roosterA.id === roosterB.id) return respond(res, 400, { message: 'Selecciona dos gallos diferentes.' })
      if (roosterA.status !== 'active' || roosterB.status !== 'active') return respond(res, 400, { message: 'Solo se pueden programar gallos activos.' })
      const eventFights = fights.filter(fight => fight.eventId === event.id)
      if (eventFights.length >= event.fights) return respond(res, 409, { message: 'El evento ya tiene todas las peleas programadas.' })
      if (fights.some(fight => fight.status !== 'finished' && (fight.roosterAId === roosterA.id || fight.roosterBId === roosterA.id || fight.roosterAId === roosterB.id || fight.roosterBId === roosterB.id))) return respond(res, 409, { message: 'Uno de estos gallos ya está en una pelea pendiente o en vivo.' })
      const oddsA = Number(input.oddsA ?? 1.85)
      const oddsB = Number(input.oddsB ?? 2.10)
      if (!Number.isFinite(oddsA) || !Number.isFinite(oddsB) || oddsA < 1.01 || oddsB < 1.01 || oddsA > 100 || oddsB > 100 || Math.round(oddsA * 100) !== oddsA * 100 || Math.round(oddsB * 100) !== oddsB * 100) return respond(res, 400, { message: 'Las cuotas deben estar entre 1,01 y 100,00 con máximo dos decimales.' })
      const created = {
        id: randomBytes(12).toString('hex'), number: Math.max(0, ...eventFights.map(fight => fight.number)) + 1, eventId: event.id,
        eventName: event.name, eventDate: event.date, eventTime: event.time, eventArena: event.arena,
        roosterAId: roosterA.id, roosterAName: roosterA.name, roosterACode: roosterA.code, roosterAImage: roosterA.image,
        roosterBId: roosterB.id, roosterBName: roosterB.name, roosterBCode: roosterB.code, roosterBImage: roosterB.image,
        oddsA, oddsB,
        status: 'upcoming', winnerRoosterId: null, createdAt: new Date().toISOString(), finishedAt: null,
      }
      fights.push(created)
      await saveFights(fights)
      return respond(res, 201, { fight: fightView(created, events, roosters) })
    }
    const fightRoute = path.match(/^\/api\/admin\/fights\/([^/]+)(?:\/(start|finish|odds))?$/)
    if (fightRoute && ['PUT', 'DELETE'].includes(req.method)) {
      if (!await adminFor(req)) return respond(res, 403, { message: 'Solo un administrador puede administrar las peleas.' })
      const fights = await readFights()
      const index = fights.findIndex(fight => fight.id === fightRoute[1])
      if (index < 0) return respond(res, 404, { message: 'Pelea no encontrada.' })
      const fight = fights[index]
      if (req.method === 'PUT' && fightRoute[2] === 'odds') {
        if (fight.status !== 'upcoming') return respond(res, 409, { message: 'Las cuotas solo se pueden modificar antes de iniciar la pelea.' })
        const input = await bodyOf(req)
        const oddsA = Number(input.oddsA)
        const oddsB = Number(input.oddsB)
        if (!Number.isFinite(oddsA) || !Number.isFinite(oddsB) || oddsA < 1.01 || oddsB < 1.01 || oddsA > 100 || oddsB > 100 || Math.round(oddsA * 100) !== oddsA * 100 || Math.round(oddsB * 100) !== oddsB * 100) return respond(res, 400, { message: 'Las cuotas deben estar entre 1,01 y 100,00 con máximo dos decimales.' })
        fight.oddsA = oddsA
        fight.oddsB = oddsB
        await saveFights(fights)
        return respond(res, 200, { fight: fightView(fight, await readEvents(), await readRoosters()) })
      }
      if (req.method === 'DELETE' && !fightRoute[2]) {
        return await withUserMutationLock(async () => {
          const [currentFights, wagers, users] = await Promise.all([readFights(), readWagers(), readUsers()])
          const currentIndex = currentFights.findIndex(item => item.id === fightRoute[1])
          const currentFight = currentFights[currentIndex]
          if (!currentFight || currentFight.status !== 'upcoming') return respond(res, 409, { message: 'Solo se pueden cancelar peleas que aún no han comenzado.' })
          for (const wager of wagers.filter(item => item.fightId === currentFight.id && ['open', 'accepted'].includes(item.status))) cancelWager(wager, users, 'fight_cancelled')
          currentFights.splice(currentIndex, 1)
          await Promise.all([saveFights(currentFights), saveWagers(wagers), saveUsers(users)])
          return respond(res, 200, { message: 'Pelea cancelada. Las apuestas reservadas fueron devueltas.' })
        })
      }
      if (req.method === 'PUT' && fightRoute[2] === 'start') {
        return await withUserMutationLock(async () => {
          const [currentFights, events, wagers, users, roosters] = await Promise.all([readFights(), readEvents(), readWagers(), readUsers(), readRoosters()])
          const currentFight = currentFights.find(item => item.id === fightRoute[1])
          if (!currentFight || currentFight.status !== 'upcoming') return respond(res, 409, { message: 'La pelea ya comenzó o ya finalizó.' })
          if (currentFights.some(item => item.status === 'live')) return respond(res, 409, { message: 'Finaliza la pelea que está en vivo antes de iniciar otra.' })
          const event = events.find(item => item.id === currentFight.eventId)
          if (!event || event.status === 'finished') return respond(res, 409, { message: 'No puedes iniciar una pelea de un evento finalizado.' })
          for (const wager of wagers.filter(item => item.fightId === currentFight.id && item.status === 'open')) {
            const creator = users.find(item => item.id === wager.creatorUserId)
            if (creator) creator.saldo = (creator.saldo || 0) + wager.amount
            wager.status = 'cancelled'
            wager.cancelReason = 'fight_started'
            wager.cancelledAt = new Date().toISOString()
          }
          currentFight.status = 'live'
          currentFight.startedAt = new Date().toISOString()
          if (event.status !== 'live') event.status = 'live'
          await Promise.all([saveFights(currentFights), saveEvents(events), saveWagers(wagers), saveUsers(users)])
          return respond(res, 200, { fight: fightView(currentFight, events, roosters) })
        })
      }
      if (req.method === 'PUT' && fightRoute[2] === 'finish') {
        const input = await bodyOf(req)
        return await withUserMutationLock(async () => {
          const [currentFights, roosters, bets, wagers, users, events] = await Promise.all([readFights(), readRoosters(), readBets(), readWagers(), readUsers(), readEvents()])
          const currentFight = currentFights.find(item => item.id === fightRoute[1])
          if (!currentFight || currentFight.status !== 'live') return respond(res, 409, { message: 'Solo puedes finalizar una pelea que esté en vivo.' })
          if (![currentFight.roosterAId, currentFight.roosterBId].includes(String(input.winnerRoosterId || ''))) return respond(res, 400, { message: 'El ganador debe ser uno de los dos gallos de la pelea.' })
          const winner = roosters.find(rooster => rooster.id === input.winnerRoosterId)
          const opponent = roosters.find(rooster => rooster.id === (input.winnerRoosterId === currentFight.roosterAId ? currentFight.roosterBId : currentFight.roosterAId))
          if (!winner || !opponent) return respond(res, 409, { message: 'No se encuentran los dos gallos para guardar el resultado.' })
          currentFight.status = 'finished'
          currentFight.winnerRoosterId = winner.id
          currentFight.finishedAt = new Date().toISOString()
          winner.wins += 1
          winner.fights += 1
          opponent.fights += 1
          opponent.status = 'inactive'
          const changedBets = bets.filter(bet => bet.fightId === currentFight.id && bet.status === 'pending')
          for (const bet of changedBets) {
            bet.status = bet.roosterId === winner.id ? 'won' : 'lost'
            if (bet.status === 'won') {
              const bettor = users.find(item => item.id === bet.userId)
              if (bettor) bettor.saldo = (bettor.saldo || 0) + bet.potentialPayout
              bet.paidOut = bet.potentialPayout
            } else bet.paidOut = 0
            bet.settledAt = new Date().toISOString()
          }
          for (const wager of wagers.filter(item => item.fightId === currentFight.id && ['open', 'accepted'].includes(item.status))) {
            if (wager.status === 'open') {
              const creator = users.find(item => item.id === wager.creatorUserId)
              if (creator) creator.saldo = (creator.saldo || 0) + wager.amount
              wager.status = 'cancelled'
              wager.cancelReason = 'fight_finished_without_acceptance'
              wager.cancelledAt = new Date().toISOString()
              continue
            }
            const winningUserId = wager.creatorRoosterId === winner.id ? wager.creatorUserId : wager.accepterUserId
            const winningUser = users.find(item => item.id === winningUserId)
            const payout = wager.amount * 2
            if (winningUser) winningUser.saldo = (winningUser.saldo || 0) + payout
            wager.status = 'settled'
            wager.winningUserId = winningUserId
            wager.winningName = wager.creatorRoosterId === winner.id ? wager.creatorName : wager.accepterName
            wager.winningRoosterName = winner.name
            wager.paidOut = payout
            wager.settledAt = new Date().toISOString()
          }
          syncEventStatuses(events, currentFights)
          await Promise.all([saveFights(currentFights), saveRoosters(roosters), saveEvents(events), saveBets(bets), saveWagers(wagers), saveUsers(users)])
          return respond(res, 200, { fight: fightView(currentFight, events, roosters) })
        })
      }
    }
    if (req.method === 'GET' && path === '/api/admin/summary') {
      const user = await authenticatedUser(req)
      if (!user) return respond(res, 401, { message: 'Inicia sesión para continuar.' })
      if (user.role !== 'administrador') return respond(res, 403, { message: 'Esta sección es solo para administradores.' })
      const users = await readUsers()
      return respond(res, 200, { message: 'Acceso administrativo autorizado.', role: user.role, totalUsuarios: users.filter(item => item.role !== 'administrador').length, totalAdministradores: users.filter(item => item.role === 'administrador').length })
    }
    return respond(res, 404, { message: 'Ruta no encontrada.' })
  } catch (error) {
    const status = error.status || (error instanceof SyntaxError ? 400 : 500)
    return respond(res, status, { message: error.status === 409 ? error.message : status === 400 ? 'El cuerpo JSON no es válido.' : 'Error interno del servidor.' })
  }
})

server.listen(PORT, '0.0.0.0', () => console.log(`GallerApp API disponible en el puerto ${PORT}`))
