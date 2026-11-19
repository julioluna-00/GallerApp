import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../lib/api'

type EventStatus = 'live' | 'upcoming' | 'finished'
interface EventItem { id: string; name: string; date: string; time: string; arena: string; fights: number; status: EventStatus; prize: number }
type EventForm = Omit<EventItem, 'id'>
const blank: EventForm = { name: '', date: '', time: '', arena: '', fights: 1, status: 'upcoming', prize: 0 }
const statusLabels: Record<EventStatus, string> = { live: 'En vivo', upcoming: 'Próximo', finished: 'Finalizado' }

export default function EventsManager() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [form, setForm] = useState<EventForm>(blank)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | EventStatus>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  async function refresh() {
    setLoading(true)
    try {
      const result = await apiRequest<{ events: EventItem[] }>('/events')
      setEvents(result.events)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la cartelera.')
    } finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])

  function edit(event: EventItem) {
    const { id, ...values } = event
    setEditingId(id)
    setForm(values)
    setFormOpen(true)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function reset() { setEditingId(null); setForm(blank); setError(''); setFormOpen(false) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await apiRequest(editingId ? `/admin/events/${editingId}` : '/admin/events', form, editingId ? 'PUT' : 'POST')
      reset()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el evento.')
    } finally { setSaving(false) }
  }

  async function remove(event: EventItem) {
    if (!window.confirm(`¿Eliminar “${event.name}” de la cartelera y del calendario?`)) return
    setError('')
    try {
      await apiRequest(`/admin/events/${event.id}`, undefined, 'DELETE')
      if (editingId === event.id) reset()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el evento.')
    }
  }

  const inputClass = 'w-full rounded-lg border border-[#333] bg-[#0F0F0F] px-3 py-2.5 text-sm text-white outline-none focus:border-[#D71920]'
  const labelClass = 'flex flex-col gap-1.5 text-xs font-semibold text-[#A3A3A3]'
  const filteredEvents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    const priority: Record<EventStatus, number> = { live: 0, upcoming: 1, finished: 2 }
    return events
      .filter(event => statusFilter === 'all' || event.status === statusFilter)
      .filter(event => !term || [event.name, event.arena, event.date, event.time].some(value => value.toLocaleLowerCase('es').includes(term)))
      .sort((a, b) => priority[a.status] - priority[b.status] || `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
  }, [events, statusFilter, search])
  const eventsPerPage = 6
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / eventsPerPage))
  const visibleEvents = filteredEvents.slice((page - 1) * eventsPerPage, page * eventsPerPage)
  const eventCounts = useMemo(() => ({
    all: events.length,
    upcoming: events.filter(event => event.status === 'upcoming').length,
    live: events.filter(event => event.status === 'live').length,
    finished: events.filter(event => event.status === 'finished').length,
  }), [events])
  useEffect(() => { setPage(current => Math.min(current, totalPages)) }, [totalPages])

  return <section className="mt-8 border-t border-[#2A2A2A] pt-7">
    <h2 className="text-xl font-black">Gestión de eventos</h2>
    <p className="mt-1 mb-5 text-sm text-[#A3A3A3]">Los cambios se guardan y se reflejan en la cartelera y el calendario.</p>
    {error && <p role="alert" className="mb-4 rounded-lg border border-[#D71920]/40 bg-[#D71920]/10 p-3 text-sm text-[#F5A0A3]">{error}</p>}
    <button type="button" aria-expanded={formOpen} aria-controls="event-editor" onClick={() => setFormOpen(open => !open)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#2A2A2A] bg-[#101010] px-4 py-3 text-left font-bold text-white hover:border-[#444]">
      <span>{editingId ? 'Editar evento' : 'Crear un evento'}</span>
      <span className="text-xs font-semibold text-[#D99024]">{formOpen ? 'CERRAR' : editingId ? 'CONTINUAR EDITANDO' : 'ABRIR FORMULARIO'}</span>
    </button>
    {formOpen && <form id="event-editor" onSubmit={save} className="mt-3 grid gap-3 rounded-xl border border-[#2A2A2A] bg-[#101010] p-4 sm:grid-cols-2">
      <label className={labelClass}>Nombre del evento<input className={inputClass} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label className={labelClass}>Fecha<input className={inputClass} type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
      <label className={labelClass}>Hora<input className={inputClass} required value={form.time} placeholder="7:30 PM" onChange={e => setForm({ ...form, time: e.target.value })} /></label>
      <label className={labelClass}>Gallera / lugar<input className={inputClass} required value={form.arena} onChange={e => setForm({ ...form, arena: e.target.value })} /></label>
      <label className={labelClass}>Número de peleas<input className={inputClass} type="number" min="1" required value={form.fights} onChange={e => setForm({ ...form, fights: Number(e.target.value) })} /></label>
      <label className={labelClass}>Bolsa de premios<input className={inputClass} type="number" min="0" step="1000" value={form.prize} onChange={e => setForm({ ...form, prize: Number(e.target.value) })} /></label>
      <label className={labelClass}>Estado<select className={inputClass} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as EventStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="flex items-end gap-2"><button disabled={saving} className="rounded-lg bg-[#D71920] px-4 py-2.5 text-xs font-black tracking-wider text-white disabled:opacity-60">{saving ? 'GUARDANDO…' : editingId ? 'GUARDAR CAMBIOS' : 'AGREGAR EVENTO'}</button>{editingId && <button type="button" onClick={reset} className="rounded-lg border border-[#333] px-4 py-2.5 text-xs font-bold text-[#A3A3A3]">CANCELAR</button>}</div>
    </form>}

    <div className="mb-3 mt-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 className="font-bold text-white">Eventos registrados</h3>
        <p className="mt-1 text-xs text-[#888]">Mostrando {filteredEvents.length === 0 ? 0 : (page - 1) * eventsPerPage + 1}–{Math.min(page * eventsPerPage, filteredEvents.length)} de {filteredEvents.length}</p>
      </div>
      <label className="min-w-48 flex-1 text-[10px] font-bold text-[#888] sm:max-w-xs">BUSCAR EVENTO
        <input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Nombre, lugar o fecha…" className={`${inputClass} mt-1`} />
      </label>
    </div>
    <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-[#2A2A2A] bg-[#0F0F0F] p-1 sm:grid-cols-4">
      {([['all', 'Todos'], ['upcoming', 'Próximos'], ['live', 'En vivo'], ['finished', 'Finalizados']] as const).map(([status, label]) => (
        <button key={status} type="button" onClick={() => { setStatusFilter(status); setPage(1) }} aria-pressed={statusFilter === status} className={`rounded-lg px-2 py-2 text-[10px] font-black tracking-wide transition-colors ${statusFilter === status ? 'bg-[#D71920] text-white' : 'text-[#999] hover:bg-[#1C1C1C] hover:text-white'}`}>
          {label} <span className="ml-1 opacity-75">{eventCounts[status]}</span>
        </button>
      ))}
    </div>
    {filteredEvents.length > eventsPerPage && <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[#2A2A2A] bg-[#101010] px-4 py-3">
      <span className="text-xs text-[#888]">Página {page} de {totalPages}</span>
      <div className="flex gap-2">
        <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1} className="rounded-lg border border-[#444] px-3 py-2 text-[10px] font-black tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50">ANTERIOR</button>
        <button type="button" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="rounded-lg border border-[#444] px-3 py-2 text-[10px] font-black tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50">SIGUIENTE</button>
      </div>
    </div>}
    <div className="space-y-2">
      {loading ? <p className="text-sm text-[#888]">Cargando eventos…</p> : events.length === 0 ? <p className="rounded-lg border border-dashed border-[#333] p-5 text-center text-sm text-[#888]">No hay eventos en la cartelera.</p> : filteredEvents.length === 0 ? <p className="rounded-lg border border-dashed border-[#333] p-5 text-center text-sm text-[#888]">No hay eventos que coincidan con esos filtros.</p> : visibleEvents.map(event => <article key={event.id} className="flex flex-col justify-between gap-3 rounded-lg border border-[#2A2A2A] bg-[#101010] p-4 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{event.name}</h3><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${event.status === 'live' ? 'bg-[#D71920]/15 text-[#F58A8E]' : event.status === 'upcoming' ? 'bg-[#D99024]/10 text-[#D99024]' : 'bg-[#252525] text-[#AAA]'}`}>{statusLabels[event.status]}</span></div><p className="mt-1 text-xs text-[#A3A3A3]">{event.date} · {event.time} · Gallera {event.arena} · {event.fights} peleas · Bolsa {event.prize.toLocaleString('es-CO')}</p></div><div className="flex gap-2"><button onClick={() => edit(event)} className="rounded border border-[#444] px-3 py-2 text-xs font-bold text-white">EDITAR</button><button onClick={() => void remove(event)} className="rounded border border-[#D71920]/40 px-3 py-2 text-xs font-bold text-[#F58A8E]">ELIMINAR</button></div></article>)}
    </div>
    {filteredEvents.length > eventsPerPage && <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#2A2A2A] bg-[#101010] px-4 py-3">
      <span className="text-xs text-[#888]">Página {page} de {totalPages}</span>
      <div className="flex gap-2">
        <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1} className="rounded-lg border border-[#444] px-3 py-2 text-[10px] font-black tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50">ANTERIOR</button>
        <button type="button" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="rounded-lg border border-[#444] px-3 py-2 text-[10px] font-black tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50">SIGUIENTE</button>
      </div>
    </div>}
  </section>
}
