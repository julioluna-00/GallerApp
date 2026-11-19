import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../lib/api'

type FightStatus = 'upcoming' | 'live' | 'finished'
interface EventItem { id: string; name: string; fights: number; status: 'live' | 'upcoming' | 'finished' }
interface RoosterItem { id: string; name: string; code: string; status: 'active' | 'inactive' }
interface FightItem {
  id: string
  number: number
  eventId: string
  eventName: string
  eventDate: string
  eventTime: string
  eventArena: string
  roosterA: { id: string; name: string; code: string }
  roosterB: { id: string; name: string; code: string }
  status: FightStatus
  winnerRoosterId: string | null
  winnerRoosterName: string | null
}

const statusLabel: Record<FightStatus, string> = { upcoming: 'Programada', live: 'En vivo', finished: 'Finalizada' }
const fieldClass = 'w-full rounded-lg border border-[#333] bg-[#0F0F0F] px-3 py-2.5 text-sm text-white outline-none focus:border-[#D71920]'
const actionClass = 'rounded-lg border border-[#444] px-3 py-2 text-[10px] font-black tracking-wider text-white disabled:opacity-50'

export default function FightsManager() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [roosters, setRoosters] = useState<RoosterItem[]>([])
  const [fights, setFights] = useState<FightItem[]>([])
  const [eventId, setEventId] = useState('')
  const [roosterAId, setRoosterAId] = useState('')
  const [roosterBId, setRoosterBId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | FightStatus>('all')
  const [eventFilter, setEventFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  async function refresh() {
    try {
      const [eventData, roosterData, fightData] = await Promise.all([
        apiRequest<{ events: EventItem[] }>('/events'),
        apiRequest<{ roosters: RoosterItem[] }>('/roosters'),
        apiRequest<{ fights: FightItem[] }>('/fights'),
      ])
      setEvents(eventData.events)
      setRoosters(roosterData.roosters)
      setFights(fightData.fights)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las peleas.')
    } finally { setLoading(false) }
  }
  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => { void refresh() }, 3000)
    return () => window.clearInterval(interval)
  }, [])

  const availableEvents = useMemo(() => events.filter(event => event.status !== 'finished'), [events])
  const reservedRoosterIds = useMemo(() => new Set(
    fights
      .filter(fight => fight.status !== 'finished')
      .flatMap(fight => [fight.roosterA.id, fight.roosterB.id]),
  ), [fights])
  const activeRoosters = useMemo(
    () => roosters.filter(rooster => rooster.status === 'active' && !reservedRoosterIds.has(rooster.id)),
    [roosters, reservedRoosterIds],
  )
  const filteredFights = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    const priority: Record<FightStatus, number> = { live: 0, upcoming: 1, finished: 2 }
    return fights
      .filter(fight => statusFilter === 'all' || fight.status === statusFilter)
      .filter(fight => eventFilter === 'all' || fight.eventId === eventFilter)
      .filter(fight => !term || [fight.eventName, fight.roosterA.name, fight.roosterB.name, String(fight.number)].some(value => value.toLocaleLowerCase('es').includes(term)))
      .sort((a, b) => priority[a.status] - priority[b.status] || a.eventName.localeCompare(b.eventName, 'es') || a.number - b.number)
  }, [fights, statusFilter, eventFilter, search])
  const fightsPerPage = 4
  const totalPages = Math.max(1, Math.ceil(filteredFights.length / fightsPerPage))
  const visibleFights = filteredFights.slice((page - 1) * fightsPerPage, page * fightsPerPage)
  const fightCounts = useMemo(() => ({
    all: fights.length,
    upcoming: fights.filter(fight => fight.status === 'upcoming').length,
    live: fights.filter(fight => fight.status === 'live').length,
    finished: fights.filter(fight => fight.status === 'finished').length,
  }), [fights])
  useEffect(() => { setPage(current => Math.min(current, totalPages)) }, [totalPages])
  const selectedEvent = events.find(event => event.id === eventId)
  const scheduledCount = fights.filter(fight => fight.eventId === eventId).length
  const canSchedule = Boolean(selectedEvent && selectedEvent.status !== 'finished' && scheduledCount < selectedEvent.fights)

  async function createFight(event: React.FormEvent) {
    event.preventDefault()
    if (!canSchedule) return
    setSaving(true)
    setError('')
    try {
      await apiRequest('/admin/fights', { eventId, roosterAId, roosterBId }, 'POST')
      setRoosterAId('')
      setRoosterBId('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo programar la pelea.')
    } finally { setSaving(false) }
  }

  async function updateFight(fight: FightItem, action: 'start' | 'finish', winnerRoosterId?: string) {
    setBusyId(fight.id)
    setError('')
    try {
      await apiRequest(`/admin/fights/${fight.id}/${action}`, action === 'finish' ? { winnerRoosterId } : {}, 'PUT')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la pelea.')
    } finally { setBusyId(null) }
  }

  async function cancelFight(fight: FightItem) {
    if (!window.confirm(`¿Cancelar la pelea #${fight.number} de ${fight.eventName}?`)) return
    setBusyId(fight.id)
    setError('')
    try {
      await apiRequest(`/admin/fights/${fight.id}`, undefined, 'DELETE')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar la pelea.')
    } finally { setBusyId(null) }
  }

  return <section className="mt-8 border-t border-[#2A2A2A] pt-7">
    <h2 className="text-xl font-black">Gestión de peleas y resultados</h2>
    <p className="mb-5 mt-1 text-sm text-[#A3A3A3]">Elige un evento y asigna dos gallos registrados y activos: uno como Gallo A y otro como Gallo B. La lista se actualiza automáticamente.</p>
    {error && <p role="alert" className="mb-4 rounded-lg border border-[#D71920]/40 bg-[#D71920]/10 p-3 text-sm text-[#F5A0A3]">{error}</p>}

    <details className="rounded-xl border border-[#2A2A2A] bg-[#101010] p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-white">
        <span>Programar una pelea</span>
        <span className="text-xs font-semibold text-[#A3A3A3]">{selectedEvent ? `${selectedEvent.fights - scheduledCount} cupos en ${selectedEvent.name}` : 'Abrir formulario'}</span>
      </summary>
      <form onSubmit={createFight} className="mt-4 grid gap-3 border-t border-[#2A2A2A] pt-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#A3A3A3] sm:col-span-2">Evento
        <select className={fieldClass} required value={eventId} onChange={e => setEventId(e.target.value)}>
          <option value="">Selecciona un evento</option>
          {availableEvents.map(event => {
            const count = fights.filter(fight => fight.eventId === event.id).length
            return <option key={event.id} value={event.id} disabled={count >= event.fights}>{event.name} · {count}/{event.fights} peleas registradas</option>
          })}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#A3A3A3]">Gallo A
        <select className={fieldClass} required value={roosterAId} onChange={e => setRoosterAId(e.target.value)}>
        <option value="">Selecciona el Gallo A registrado</option>
          {activeRoosters.length === 0 && <option value="" disabled>No hay gallos disponibles</option>}
          {activeRoosters.map(rooster => <option key={rooster.id} value={rooster.id} disabled={rooster.id === roosterBId}>{rooster.name} · {rooster.code}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#A3A3A3]">Gallo B
        <select className={fieldClass} required value={roosterBId} onChange={e => setRoosterBId(e.target.value)}>
        <option value="">Selecciona el Gallo B registrado</option>
          {activeRoosters.length === 0 && <option value="" disabled>No hay gallos disponibles</option>}
          {activeRoosters.map(rooster => <option key={rooster.id} value={rooster.id} disabled={rooster.id === roosterAId}>{rooster.name} · {rooster.code}</option>)}
        </select>
      </label>
      <div className="flex items-end sm:col-span-2">
        <button disabled={saving || !canSchedule || !roosterAId || !roosterBId} className="rounded-lg bg-[#D71920] px-4 py-2.5 text-xs font-black tracking-wider text-white disabled:opacity-50">{saving ? 'GUARDANDO…' : 'PROGRAMAR PELEA'}</button>
        {selectedEvent && <span className="ml-3 pb-2 text-xs text-[#888]">{selectedEvent.fights - scheduledCount} cupos disponibles en este evento</span>}
      </div>
      </form>
    </details>

    <section className="mt-6" aria-label="Buscar y filtrar peleas">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-white">Peleas registradas</h3>
          <p className="mt-1 text-xs text-[#888]">Mostrando {filteredFights.length === 0 ? 0 : (page - 1) * fightsPerPage + 1}–{Math.min(page * fightsPerPage, filteredFights.length)} de {filteredFights.length}</p>
        </div>
        <label className="min-w-48 flex-1 text-[10px] font-bold text-[#888] sm:max-w-xs">BUSCAR PELEA O GALLO
          <input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Evento, gallo o número…" className={`${fieldClass} mt-1`} />
        </label>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_13rem]">
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-[#2A2A2A] bg-[#0F0F0F] p-1 sm:grid-cols-4">
          {([['all', 'Todas'], ['upcoming', 'Programadas'], ['live', 'En vivo'], ['finished', 'Finalizadas']] as const).map(([status, label]) => (
            <button key={status} type="button" onClick={() => { setStatusFilter(status); setPage(1) }} aria-pressed={statusFilter === status} className={`rounded-lg px-2 py-2 text-[10px] font-black tracking-wide transition-colors ${statusFilter === status ? 'bg-[#D71920] text-white' : 'text-[#999] hover:bg-[#1C1C1C] hover:text-white'}`}>
              {label} <span className="ml-1 opacity-75">{fightCounts[status]}</span>
            </button>
          ))}
        </div>
        <label className="text-[10px] font-bold text-[#888]">EVENTO
          <select value={eventFilter} onChange={event => { setEventFilter(event.target.value); setPage(1) }} className={`${fieldClass} mt-1`}>
            <option value="all">Todos los eventos</option>
            {events.map(event => <option key={event.id} value={event.id}>{event.name}</option>)}
          </select>
        </label>
      </div>
    </section>

    {filteredFights.length > fightsPerPage && <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[#2A2A2A] bg-[#101010] px-4 py-3">
      <span className="text-xs text-[#888]">Página {page} de {totalPages}</span>
      <div className="flex gap-2">
        <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1} className={`${actionClass} disabled:cursor-not-allowed`}>ANTERIOR</button>
        <button type="button" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className={`${actionClass} disabled:cursor-not-allowed`}>SIGUIENTE</button>
      </div>
    </div>}

    <div className="mt-3 space-y-3">
      {loading ? <p className="text-sm text-[#888]">Cargando peleas…</p> : fights.length === 0 ? <p className="rounded-lg border border-dashed border-[#333] p-5 text-center text-sm text-[#888]">Todavía no hay enfrentamientos programados.</p> : filteredFights.length === 0 ? <p className="rounded-lg border border-dashed border-[#333] p-5 text-center text-sm text-[#888]">No hay peleas que coincidan con esos filtros.</p> : visibleFights.map(fight => {
        const busy = busyId === fight.id
        return <article key={fight.id} className="rounded-xl border border-[#2A2A2A] bg-[#101010] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#D71920]">{fight.eventName} · PELEA #{String(fight.number).padStart(3, '0')}</p>
              <h3 className="mt-1 font-heading text-base font-black">{fight.roosterA.name} <span className="text-[#D71920]">VS</span> {fight.roosterB.name}</h3>
              <p className="mt-1 text-xs text-[#888]">{fight.eventDate} · {fight.eventTime} · Gallera {fight.eventArena}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[9px] font-black tracking-widest ${fight.status === 'live' ? 'bg-[#D71920]/15 text-[#F58A8E]' : fight.status === 'upcoming' ? 'bg-[#D99024]/10 text-[#D99024]' : 'bg-[#252525] text-[#AAA]'}`}>{statusLabel[fight.status]}</span>
          </div>
          {fight.status === 'upcoming' && <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => void updateFight(fight, 'start')} className={`${actionClass} border-[#176B45]/60 bg-[#176B45]/20 text-[#72D1A4]`}>{busy ? 'ACTUALIZANDO…' : 'INICIAR PELEA'}</button>
            <button disabled={busy} onClick={() => void cancelFight(fight)} className={`${actionClass} text-[#F58A8E]`}>CANCELAR</button>
          </div>}
          {fight.status === 'live' && <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => void updateFight(fight, 'finish', fight.roosterA.id)} className={`${actionClass} border-[#D71920]/50 bg-[#D71920]/15 text-white`}>{busy ? 'GUARDANDO…' : `FINALIZAR · GANÓ ${fight.roosterA.name}`}</button>
            <button disabled={busy} onClick={() => void updateFight(fight, 'finish', fight.roosterB.id)} className={`${actionClass} border-[#D71920]/50 bg-[#D71920]/15 text-white`}>{busy ? 'GUARDANDO…' : `FINALIZAR · GANÓ ${fight.roosterB.name}`}</button>
          </div>}
          {fight.status === 'finished' && <p className="mt-3 rounded-lg border border-[#176B45]/40 bg-[#176B45]/10 px-3 py-2 text-sm font-bold text-[#72D1A4]">Ganador oficial: {fight.winnerRoosterName}</p>}
        </article>
      })}
    </div>
    {filteredFights.length > fightsPerPage && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#2A2A2A] bg-[#101010] px-4 py-3">
      <span className="text-xs text-[#888]">Página {page} de {totalPages}</span>
      <div className="flex gap-2">
        <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1} className={`${actionClass} disabled:cursor-not-allowed`}>ANTERIOR</button>
        <button type="button" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className={`${actionClass} disabled:cursor-not-allowed`}>SIGUIENTE</button>
      </div>
    </div>}
  </section>
}
