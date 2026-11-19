import { useState, useRef, useEffect, type FormEvent } from 'react'
import Login from './pages/Login'
import Register from './pages/Register'
import About from './pages/About'
import Roosters from './pages/Roosters'
import RoosterDirectory from './pages/RoosterDirectory'
import Events from './pages/Events'
import AdminPanel from './pages/AdminPanel'
import Profile from './pages/Profile'
import { RoosterLogo } from './components/RoosterLogo'
import { apiRequest, type GallerUser } from './lib/api'

type EventStatus = 'live' | 'upcoming' | 'finished'
interface HomeEvent { id: string; name: string; date: string; time: string; arena: string; fights: number; status: EventStatus; prize: number }
type FightStatus = 'upcoming' | 'live' | 'finished'
type FightRooster = { id: string; name: string; code: string; image?: string; weight?: string; breed?: string }
interface HomeFight { id: string; number: number; eventId: string; eventName: string; eventDate: string; eventTime: string; eventArena: string; roosterA: FightRooster; roosterB: FightRooster; status: FightStatus; winnerRoosterId: string | null; winnerRoosterName: string | null }
interface FightWager { id: string; fightId: string; fightNumber: number; eventName: string; creatorName: string; creatorRoosterId: string; creatorRoosterName: string; accepterName: string | null; accepterRoosterId: string | null; accepterRoosterName: string | null; winningUserId?: string; winningName?: string; winningRoosterName?: string; amount: number; paidOut?: number; status: 'open' | 'accepted' | 'settled' | 'cancelled'; isMine?: boolean; createdAt: string; acceptedAt?: string | null; settledAt?: string | null; cancelReason?: string }

function eventStatusLabel(status: EventStatus) {
  return status === 'live' ? 'live' : status === 'upcoming' ? 'proxima' : 'finalizada'
}

function fightStatusLabel(status: FightStatus) {
  return status === 'live' ? 'live' : status === 'upcoming' ? 'proxima' : 'finalizada'
}

function formatEventDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatCOP(amount: number) {
  return `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(amount)}`
}

function BalanceChip({ amount }: { amount: number }) {
  return <div aria-label={`Saldo actual: ${formatCOP(amount)}`} className="flex items-center gap-2 rounded-lg border border-[#D99024]/30 bg-[#D99024]/10 px-3 py-2">
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#D99024] text-[10px] font-black text-[#111]">$</span>
    <span className="text-[9px] font-black tracking-widest text-[#A3A3A3]">SALDO</span>
    <span className="text-xs font-heading font-black text-[#D99024]">{formatCOP(amount)}</span>
  </div>
}

const chatMessages = [
  { id: 1, user: 'CarlosVP', msg: '¡Vamos Obsidiana! El favorito de esta noche 🔥', time: '8:28' },
  { id: 2, user: 'MarisolR', msg: '¿Quién se anima a aceptar el reto?', time: '8:29' },
  { id: 3, user: 'DiegoF88', msg: 'Aposte $100,000 a Obsidiana, confiado', time: '8:30' },
  { id: 4, user: 'Ana_Cock', msg: '¡Qué pelea más reñida, no hay favorito claro!', time: '8:30' },
  { id: 5, user: 'JuanGO', msg: 'Sangre Real viene de ganar 4 seguidas', time: '8:31' },
  { id: 6, user: 'Pedro_G', msg: 'La transmisión está perfecta hoy 👌', time: '8:31' },
  { id: 7, user: 'LuisaM', msg: 'Primera vez aquí, impresionante la plataforma', time: '8:32' },
]

// --- ICON COMPONENTS ---
function IconLive() {
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D71920] opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D71920]" />
      </span>
      <span className="text-[#D71920] text-xs font-bold tracking-widest font-heading">EN VIVO</span>
    </span>
  )
}

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}


// --- STATUS BADGE ---
function StatusBadge({ status }: { status: string }) {
  if (status === 'live') return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#D71920]/15 border border-[#D71920]/30">
      <span className="w-1.5 h-1.5 rounded-full bg-[#D71920] animate-pulse" />
      <span className="text-[#D71920] text-xs font-bold tracking-widest font-heading">EN VIVO</span>
    </span>
  )
  if (status === 'proxima') return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#D99024]/10 border border-[#D99024]/30">
      <span className="w-1.5 h-1.5 rounded-full bg-[#D99024]" />
      <span className="text-[#D99024] text-xs font-bold tracking-widest font-heading">PRÓXIMA</span>
    </span>
  )
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2A2A2A] border border-[#333]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#A3A3A3]" />
      <span className="text-[#A3A3A3] text-xs font-bold tracking-widest font-heading">FINALIZADA</span>
    </span>
  )
}

function PreFightRoosterCard({ side, rooster }: { side: 'A' | 'B'; rooster: FightRooster }) {
  return (
    <div className="w-[42%] max-w-[280px] rounded-xl border border-[#D99024]/40 bg-[#090B12]/85 p-3 shadow-xl backdrop-blur-md sm:w-[29%] sm:p-4">
      <p className="text-[9px] font-heading font-black tracking-[0.2em] text-[#D99024]">GALLO {side}</p>
      <h3 className="mt-1 truncate text-sm font-heading font-black text-white sm:text-lg">{rooster.name}</h3>
      <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
        <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold tracking-wider text-[#A3A3A3]">PESO</span><span className="truncate text-[10px] font-semibold text-white sm:text-xs">{rooster.weight || 'No registrado'}</span></div>
        <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold tracking-wider text-[#A3A3A3]">RAZA</span><span className="truncate text-[10px] font-semibold text-white sm:text-xs">{rooster.breed || 'No registrada'}</span></div>
      </div>
    </div>
  )
}
// --- MAIN APP ---
export default function App() {
  const [view, setView] = useState<'home' | 'fights' | 'login' | 'register' | 'about' | 'roosters' | 'rooster-directory' | 'events' | 'admin' | 'profile'>('home')
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState(chatMessages)
  const [betSelected, setBetSelected] = useState<null | 'a' | 'b'>(null)
  const [betAmount, setBetAmount] = useState('5000')
  const [openWagers, setOpenWagers] = useState<FightWager[]>([])
  const [myWagers, setMyWagers] = useState<FightWager[]>([])
  const [betError, setBetError] = useState('')
  const [betNotice, setBetNotice] = useState('')
  const [betSaving, setBetSaving] = useState(false)
  const [wagerActionId, setWagerActionId] = useState<string | null>(null)
  const [activeBetFightId, setActiveBetFightId] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const streamFrameRef = useRef<HTMLIFrameElement>(null)
  const [streamMuted, setStreamMuted] = useState(true)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [signedInUser, setSignedInUser] = useState<GallerUser | null>(null)
  const [events, setEvents] = useState<HomeEvent[]>([])
  const [fights, setFights] = useState<HomeFight[]>([])
  const [eventsError, setEventsError] = useState('')

  function toggleStreamMute() {
    const nextMuted = !streamMuted
    setStreamMuted(nextMuted)
    streamFrameRef.current?.contentWindow?.postMessage({ mute: nextMuted }, 'https://vdo.ninja')
  }

  useEffect(() => {
    if (view !== 'home' && view !== 'fights') return
    let active = true
    const refreshEvents = () => Promise.all([
      apiRequest<{ events: HomeEvent[] }>('/events'),
      apiRequest<{ fights: HomeFight[] }>('/fights'),
    ])
      .then(([eventData, fightData]) => { if (active) { setEvents(eventData.events); setFights(fightData.fights); setEventsError('') } })
      .catch((error: Error) => { if (active) setEventsError(error.message) })
    void refreshEvents()
    const interval = window.setInterval(() => { void refreshEvents() }, 3000)
    return () => { active = false; window.clearInterval(interval) }
  }, [view])

  const featuredFight = fights.find(fight => fight.status === 'live')
    || fights.find(fight => fight.status === 'upcoming')
    || [...fights].reverse().find(fight => fight.status === 'finished')
  const activeBetFight = fights.find(fight => fight.id === activeBetFightId) ?? featuredFight
  const homeWagerFight = fights.find(fight => fight.status === 'upcoming')
  const featuredEvent = (featuredFight && events.find(event => event.id === featuredFight.eventId))
    || events.find(event => event.status === 'live')
    || events.find(event => event.status === 'upcoming')
    || events[0]
  const isFightLive = featuredFight?.status === 'live'
  const isWaitingForFight = featuredFight?.status === 'upcoming' || (!featuredFight && featuredEvent?.status === 'upcoming')
  const scheduledEvents = [...events].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
  const orderedFights = [...fights].sort((a, b) => {
    const rank: Record<FightStatus, number> = { live: 0, upcoming: 1, finished: 2 }
    return rank[a.status] - rank[b.status] || b.number - a.number
  })

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (sessionStorage.getItem('gallerapp_token')) {
      apiRequest<{ user: GallerUser }>('/auth/me')
        .then(({ user }) => setSignedInUser(user))
        .catch(() => sessionStorage.removeItem('gallerapp_token'))
    }
  }, [])

  useEffect(() => {
    if (!signedInUser?.id) return
    let active = true
    apiRequest<{ profile: GallerUser }>('/auth/profile')
      .then(({ profile }) => { if (active) setSignedInUser(current => current?.id === profile.id ? { ...current, ...profile } : current) })
      .catch(() => {})
    return () => { active = false }
  }, [signedInUser?.id])

  useEffect(() => {
    if (!signedInUser || (view !== 'home' && view !== 'fights')) { setMyWagers([]); return }
    let active = true
    const refreshAccount = () => Promise.all([
      apiRequest<{ user: GallerUser }>('/auth/me'),
    ]).then(([account]) => {
      if (active) setSignedInUser(current => ({ ...account.user, profileImage: current?.profileImage }))
    }).catch(() => {})
    void refreshAccount()
    const interval = window.setInterval(() => { void refreshAccount() }, 3000)
    return () => { active = false; window.clearInterval(interval) }
  }, [signedInUser?.id, view])

  useEffect(() => {
    if (view !== 'home' && view !== 'fights') { setOpenWagers([]); return }
    let active = true
    const refreshWagers = () => apiRequest<{ wagers: FightWager[]; myWagers: FightWager[] }>('/wagers')
      .then(data => { if (active) { setOpenWagers(data.wagers); setMyWagers(data.myWagers) } })
      .catch((error: Error) => { if (active) setBetError(error.message) })
    void refreshWagers()
    const interval = window.setInterval(() => { void refreshWagers() }, 2500)
    return () => { active = false; window.clearInterval(interval) }
  }, [view, signedInUser?.id])

  if (view === 'profile') return signedInUser
    ? <Profile user={signedInUser} onBack={() => setView('home')} onUpdated={setSignedInUser} />
    : <main className="min-h-screen bg-[#0B0B0B] p-10 text-center text-white">Inicia sesión para ver tu perfil. <button className="ml-2 underline" onClick={() => setView('login')}>Entrar</button></main>

  if (view === 'login') return <Login onBack={() => setView('home')} onGoRegister={() => setView('register')} onSuccess={(user) => { setSignedInUser(user); setView('home') }} />
  if (view === 'register') return <Register onBack={() => setView('home')} onGoLogin={() => setView('login')} />
  if (view === 'admin') return signedInUser?.role === 'administrador' ? <AdminPanel onBack={() => setView('home')} /> : <main className="min-h-screen bg-[#0B0B0B] p-10 text-center text-white">Acceso restringido. <button className="ml-2 underline" onClick={() => setView('home')}>Volver</button></main>
  if (view === 'about') {
    return (
      <About
        signedInUser={signedInUser}
        onBack={() => setView('home')}
        onGoEvents={() => setView('events')}
        onGoRoosters={() => setView('roosters')}
        onGoRegisterRooster={() => setView('roosters')}
        onGoRoosterDirectory={() => setView('rooster-directory')}
        onGoAdmin={() => setView(signedInUser?.role === 'administrador' ? 'admin' : 'login')}
        onGoLogin={() => setView('login')}
        onGoRegister={() => setView('register')}
        onGoProfile={() => setView('profile')}
        onLogout={() => { sessionStorage.removeItem('gallerapp_token'); setSignedInUser(null) }}
      />
    )
  }
  if (view === 'roosters') {
    return (
      <Roosters
        signedInUser={signedInUser}
        onBack={() => setView('home')}
        onGoEvents={() => setView('events')}
        onGoRoosterDirectory={() => setView('rooster-directory')}
        onGoAbout={() => setView('about')}
        onGoAdmin={() => setView(signedInUser?.role === 'administrador' ? 'admin' : 'login')}
        onGoLogin={() => setView('login')}
        onGoRegister={() => setView('register')}
        onGoProfile={() => setView('profile')}
        onLogout={() => { sessionStorage.removeItem('gallerapp_token'); setSignedInUser(null) }}
      />
    )
  }
  if (view === 'rooster-directory') {
    return (
      <RoosterDirectory
        signedInUser={signedInUser}
        onBack={() => setView('home')}
        onGoEvents={() => setView('events')}
        onGoRegisterRooster={() => setView('roosters')}
        onGoAbout={() => setView('about')}
        onGoAdmin={() => setView(signedInUser?.role === 'administrador' ? 'admin' : 'login')}
        onGoLogin={() => setView('login')}
        onGoRegister={() => setView('register')}
        onGoProfile={() => setView('profile')}
        onLogout={() => { sessionStorage.removeItem('gallerapp_token'); setSignedInUser(null) }}
        isAdmin={signedInUser?.role === 'administrador'}
      />
    )
  }
  if (view === 'events') {
    return (
      <Events
        signedInUser={signedInUser}
        onBack={() => setView('home')}
        onGoRoosters={() => setView('rooster-directory')}
        onGoRoosterDirectory={() => setView('rooster-directory')}
        onGoRegisterRooster={() => setView('roosters')}
        onGoAbout={() => setView('about')}
        onGoAdmin={() => setView(signedInUser?.role === 'administrador' ? 'admin' : 'login')}
        onGoLogin={() => setView('login')}
        onGoRegister={() => setView('register')}
        onGoProfile={() => setView('profile')}
        onLogout={() => { sessionStorage.removeItem('gallerapp_token'); setSignedInUser(null) }}
      />
    )
  }

  function sendMessage() {
    if (!chatInput.trim()) return
    setMessages(prev => [...prev, {
      id: prev.length + 1,
      user: 'Tú',
      msg: chatInput.trim(),
      time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    }])
    setChatInput('')
  }

  async function refreshWagers() {
    const data = await apiRequest<{ wagers: FightWager[]; myWagers: FightWager[] }>('/wagers')
    setOpenWagers(data.wagers)
    setMyWagers(data.myWagers)
  }

  async function createWager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const targetFight = view === 'fights' ? activeBetFight : homeWagerFight
    if (!targetFight || !signedInUser || !betSelected) { setBetError('Inicia sesión y selecciona el gallo por el que quieres apostar.'); return }
    if (targetFight.status !== 'upcoming') { setBetError('Las apuestas se cierran cuando inicia el combate.'); return }
    const amount = Number(betAmount)
    if (!Number.isSafeInteger(amount) || amount < 1000 || amount > (signedInUser.saldo ?? 0)) { setBetError('El monto debe ser de al menos $1.000 y no superar tu saldo.'); return }
    setBetSaving(true)
    setBetError('')
    setBetNotice('')
    try {
      const roosterId = betSelected === 'a' ? targetFight.roosterA.id : targetFight.roosterB.id
      const result = await apiRequest<{ wager: FightWager; user: GallerUser }>('/wagers', { fightId: targetFight.id, roosterId, amount }, 'POST')
      setSignedInUser(result.user)
      await refreshWagers()
      setBetNotice(`Propuesta publicada por ${formatCOP(result.wager.amount)}. Ese monto queda reservado hasta que alguien la acepte o la canceles.`)
      setBetSelected(null)
    } catch (error) {
      setBetError(error instanceof Error ? error.message : 'No se pudo publicar la propuesta.')
    } finally { setBetSaving(false) }
  }

  async function acceptWager(wagerId: string) {
    setWagerActionId(wagerId)
    setBetError('')
    setBetNotice('')
    try {
      const result = await apiRequest<{ wager: FightWager; user: GallerUser }>(`/wagers/${wagerId}/accept`, {}, 'POST')
      setSignedInUser(result.user)
      await refreshWagers()
      setBetNotice(`Aceptaste la apuesta de ${formatCOP(result.wager.amount)}. Tu dinero quedó reservado hasta el resultado.`)
    } catch (error) {
      setBetError(error instanceof Error ? error.message : 'No se pudo aceptar la apuesta.')
    } finally { setWagerActionId(null) }
  }

  async function cancelWager(wagerId: string) {
    setWagerActionId(wagerId)
    setBetError('')
    setBetNotice('')
    try {
      const result = await apiRequest<{ wager: FightWager; user: GallerUser }>(`/wagers/${wagerId}`, undefined, 'DELETE')
      setSignedInUser(result.user)
      await refreshWagers()
      setBetNotice('Propuesta cancelada; el saldo reservado volvió a tu cuenta.')
    } catch (error) {
      setBetError(error instanceof Error ? error.message : 'No se pudo cancelar la propuesta.')
    } finally { setWagerActionId(null) }
  }

  if (view === 'fights') return (
    <div className="min-h-screen overflow-x-hidden bg-[#0B0B0B] font-body text-[#F5F5F5]">
      <header className="sticky top-0 z-50 border-b border-[#D71920]/20 bg-[#0B0B0B]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-6">
          <button onClick={() => setView('home')} className="flex items-center gap-3"><RoosterLogo size={36} /><span className="font-heading text-lg font-black tracking-wider">GALLER<span className="text-[#D71920]">APP</span></span></button>
          <nav aria-label="Navegación principal" className="flex items-center gap-2">
            <button onClick={() => setView('home')} className="rounded-lg border border-[#333] px-3 py-2 text-xs font-black tracking-wider text-[#A3A3A3] hover:text-white">TRANSMISIÓN</button>
            <span className="rounded-lg bg-[#D71920] px-3 py-2 text-xs font-black tracking-wider text-white">PELEAS Y APUESTAS</span>
          </nav>
          {signedInUser ? <div className="flex items-center gap-2"><BalanceChip amount={signedInUser.saldo ?? 0} /><button onClick={() => setView('profile')} className="hidden rounded-lg border border-[#333] px-3 py-2 text-xs font-bold text-[#A3A3A3] hover:text-white sm:block">MI PERFIL</button></div> : <button onClick={() => setView('login')} className="rounded-lg border border-[#333] px-3 py-2 text-xs font-bold text-[#A3A3A3] hover:text-white">ENTRAR</button>}
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
        <div className="mb-6">
          <p className="text-[10px] font-black tracking-[0.25em] text-[#D71920]">CARTELERA</p>
          <h1 className="mt-1 font-heading text-2xl font-black sm:text-3xl">Peleas, resultados y apuestas</h1>
          <p className="mt-2 text-sm text-[#A3A3A3]">Consulta el historial y apuesta en los combates programados antes de que inicien.</p>
        </div>
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl border border-[#2A2A2A] bg-[#111] p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-heading text-sm font-black tracking-widest">PELEAS Y RESULTADOS</h2><span className="text-xs text-[#888]">{orderedFights.length} registradas</span></div>
            <div className="flex flex-col gap-2.5">
              {eventsError && fights.length === 0 ? <p className="rounded-xl border border-[#D71920]/40 bg-[#D71920]/10 p-4 text-sm text-[#F58A8E]">No se pudo cargar la cartelera: {eventsError}</p> : orderedFights.length ? orderedFights.map(fight => {
                const selected = activeBetFight?.id === fight.id
                return <button type="button" key={fight.id} onClick={() => { setActiveBetFightId(fight.id); setBetSelected(null); setBetError(''); setBetNotice('') }} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors sm:gap-4 sm:p-4 ${selected ? 'border-[#D71920]/70 bg-[#D71920]/10' : 'border-[#2A2A2A] bg-[#171717] hover:border-[#555]'}`}>
                  <div className="w-12 shrink-0 text-center"><p className="font-heading text-lg font-black text-[#D71920]">#{String(fight.number).padStart(3, '0')}</p><p className="text-[10px] text-[#A3A3A3]">{fight.eventTime}</p></div><div className="h-10 w-px shrink-0 bg-[#2A2A2A]" />
                  <div className="min-w-0 flex-1"><p className="truncate font-heading text-sm font-bold">{fight.roosterA.name} <span className="text-[#D71920]">VS</span> {fight.roosterB.name}</p><p className="truncate text-xs text-[#A3A3A3]">{fight.eventName} · {formatEventDate(fight.eventDate)}</p>{fight.status === 'finished' ? <p className="mt-1 text-xs font-bold text-[#72D1A4]">Ganador: {fight.winnerRoosterName}</p> : <p className="mt-1 text-[10px] font-bold text-[#D99024]">{openWagers.filter(wager => wager.fightId === fight.id && wager.status === 'open').length} propuestas abiertas · 1 vs 1</p>}</div><StatusBadge status={fightStatusLabel(fight.status)} />
                </button>
              }) : <p className="rounded-xl border border-dashed border-[#333] p-6 text-center text-sm text-[#A3A3A3]">No hay peleas programadas todavía.</p>}
            </div>
          </section>
          <aside className="space-y-4">
            <section className="rounded-2xl border border-[#2A2A2A] bg-[#111] p-5">
              <h2 className="font-heading text-sm font-black tracking-widest">APUESTAS 1 VS 1</h2>
              {activeBetFight ? <>
                <p className="mt-2 text-xs text-[#A3A3A3]">Pelea #{String(activeBetFight.number).padStart(3, '0')} · {activeBetFight.eventName}</p>
                {activeBetFight.status === 'live' ? <div className="mt-4 rounded-xl border border-[#D71920]/40 bg-[#D71920]/10 p-4"><p className="text-xs font-black tracking-wider text-[#F58A8E]">APUESTAS CERRADAS</p><p className="mt-2 text-xs text-[#A3A3A3]">El combate ya inició. Las propuestas sin aceptar fueron devueltas.</p></div>
                  : activeBetFight.status === 'finished' ? <div className="mt-4 rounded-xl border border-[#176B45]/40 bg-[#176B45]/10 p-4"><p className="text-xs font-black tracking-wider text-[#72D1A4]">COMBATE FINALIZADO</p><p className="mt-2 text-sm font-bold">Ganador: {activeBetFight.winnerRoosterName}</p></div>
                  : signedInUser ? <form onSubmit={createWager} className="mt-4 space-y-3 rounded-xl border border-[#2A2A2A] bg-[#0B0B0B] p-4">
                    <p className="text-xs text-[#A3A3A3]">Publica un reto: otra persona acepta con el mismo monto y el gallo contrario. Puedes crear varias propuestas.</p>
                    <p className="text-xs text-[#888]">Saldo disponible: {formatCOP(signedInUser.saldo ?? 0)} · mínimo {formatCOP(1000)}</p>
                    <div className="grid grid-cols-2 gap-2">{[activeBetFight.roosterA, activeBetFight.roosterB].map((rooster, index) => { const side = index === 0 ? 'a' : 'b'; const selected = betSelected === side; return <button key={rooster.id} type="button" onClick={() => { setBetSelected(side); setBetError(''); setBetNotice('') }} aria-pressed={selected} className={`rounded-lg border p-3 text-left ${selected ? 'border-[#D71920] bg-[#D71920]/15' : 'border-[#333] bg-[#111]'}`}><span className="block text-[9px] font-black tracking-widest text-[#888]">APUESTAS POR GALLO {index === 0 ? 'A' : 'B'}</span><span className="mt-1 block truncate text-xs font-bold">{rooster.name}</span></button> })}</div>
                    <label className="block text-[10px] font-bold tracking-widest text-[#A3A3A3]">MONTO APOSTADO<input type="number" min="1000" step="1000" max={signedInUser.saldo ?? 0} required value={betAmount} onChange={event => setBetAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-[#333] bg-[#111] px-3 py-2.5 text-sm text-white outline-none focus:border-[#D71920]" /></label>
                    <p className="text-[10px] text-[#888]">A quien acepte le corresponderá el mismo monto. Pozo total: {formatCOP(Math.max(0, Number(betAmount) || 0) * 2)}.</p>
                    {betError && <p role="alert" className="text-xs text-[#F58A8E]">{betError}</p>}{betNotice && <p role="status" className="text-xs text-[#72D1A4]">{betNotice}</p>}
                    <button type="submit" disabled={betSaving || !betSelected || Number(betAmount) < 1000 || Number(betAmount) > (signedInUser.saldo ?? 0)} className="w-full rounded-lg bg-[#D71920] px-3 py-3 text-[10px] font-black tracking-widest text-white disabled:opacity-50">{betSaving ? 'PUBLICANDO…' : 'PUBLICAR PROPUESTA'}</button>
                  </form> : <button onClick={() => setView('login')} className="mt-4 w-full rounded-xl border border-[#D71920]/40 bg-[#171717] p-4 text-left text-xs font-bold text-white">Inicia sesión para proponer o aceptar apuestas.</button>}
              </> : <p className="mt-3 text-sm text-[#A3A3A3]">No hay una pelea seleccionada.</p>}

              {activeBetFight && activeBetFight.status !== 'finished' && <div className="mt-5 border-t border-[#2A2A2A] pt-4">
                <div className="mb-3 flex items-center justify-between"><h3 className="text-[10px] font-black tracking-widest text-[#A3A3A3]">PROPUESTAS DE ESTA PELEA</h3><span className="text-[10px] text-[#888]">{openWagers.filter(wager => wager.fightId === activeBetFight.id).length}</span></div>
                <div className="space-y-2">{openWagers.filter(wager => wager.fightId === activeBetFight.id).map(wager => <article key={wager.id} className="rounded-xl border border-[#2A2A2A] bg-[#0B0B0B] p-3">
                  <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[10px] text-[#888]">{wager.status === 'open' ? 'RETO ABIERTO' : 'APUESTA ACEPTADA'}</p><p className="mt-1 text-xs font-bold"><span className="text-white">{wager.creatorName}</span> · {wager.creatorRoosterName}</p>{wager.status === 'accepted' && <p className="mt-1 text-xs font-bold"><span className="text-white">{wager.accepterName}</span> · {wager.accepterRoosterName}</p>}</div><span className="shrink-0 text-xs font-black text-[#D99024]">{formatCOP(wager.amount)} c/u</span></div>
                  {wager.status === 'open' && activeBetFight.status === 'upcoming' && signedInUser && (wager.isMine
                    ? <button type="button" onClick={() => void cancelWager(wager.id)} disabled={wagerActionId === wager.id} className="mt-3 w-full rounded-lg border border-[#555] px-3 py-2 text-[10px] font-black tracking-wider text-[#A3A3A3] disabled:opacity-50">{wagerActionId === wager.id ? 'PROCESANDO…' : 'CANCELAR MI PROPUESTA'}</button>
                    : <button type="button" onClick={() => void acceptWager(wager.id)} disabled={wagerActionId === wager.id} className="mt-3 w-full rounded-lg bg-[#176B45] px-3 py-2.5 text-[10px] font-black tracking-wider text-white disabled:opacity-50">{wagerActionId === wager.id ? 'PROCESANDO…' : `ACEPTAR POR ${formatCOP(wager.amount)}`}</button>)}
                </article>)}{openWagers.filter(wager => wager.fightId === activeBetFight.id).length === 0 && <p className="rounded-lg border border-dashed border-[#333] p-3 text-center text-xs text-[#777]">Todavía no hay retos. Publica el primero.</p>}</div>
                {betError && <p role="alert" className="mt-3 text-xs text-[#F58A8E]">{betError}</p>}{betNotice && <p role="status" className="mt-3 text-xs text-[#72D1A4]">{betNotice}</p>}
              </div>}
            </section>

            <section className="rounded-2xl border border-[#2A2A2A] bg-[#111] p-5"><h2 className="font-heading text-xs font-black tracking-widest">MIS APUESTAS</h2>{signedInUser && myWagers.length ? <div className="mt-3 max-h-[420px] space-y-3 overflow-y-auto">{[...myWagers].reverse().map(wager => <div key={wager.id} className="border-t border-[#292929] pt-3 first:border-0 first:pt-0"><p className="text-xs font-bold">Pelea #{String(wager.fightNumber).padStart(3, '0')} · {wager.eventName}</p><p className="mt-1 text-[10px] text-[#A3A3A3]">{wager.creatorRoosterName} · {formatCOP(wager.amount)} por persona</p><p className={`mt-1 text-[10px] font-black ${wager.status === 'settled' ? wager.winningUserId === signedInUser.id ? 'text-[#72D1A4]' : 'text-[#F58A8E]' : wager.status === 'cancelled' ? 'text-[#888]' : 'text-[#D99024]'}`}>{wager.status === 'open' ? 'RETO ABIERTO · monto reservado' : wager.status === 'accepted' ? `ACEPTADA · ${wager.accepterName} tomó el otro lado` : wager.status === 'settled' ? wager.winningUserId === signedInUser.id ? `GANASTE · premio ${formatCOP(wager.paidOut ?? wager.amount * 2)}` : `PERDISTE · ganó ${wager.winningName || 'la otra persona'}` : `CANCELADA${wager.cancelReason === 'fight_started' ? ' · monto devuelto al iniciar' : wager.cancelReason === 'fight_cancelled' ? ' · monto devuelto al cancelar la pelea' : wager.cancelReason === 'fight_finished_without_acceptance' ? ' · monto devuelto, no fue aceptada' : wager.cancelReason === 'event_cancelled' ? ' · monto devuelto al cancelar el evento' : ''}`}</p></div>)}</div> : <p className="mt-3 text-xs text-[#888]">{signedInUser ? 'Todavía no tienes propuestas ni apuestas.' : 'Inicia sesión para consultar tus apuestas.'}</p>}</section>
          </aside>
        </div>
      </main>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F5F5F5] font-body overflow-x-hidden">

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 bg-[#0B0B0B] border-b border-[#D71920]/20 backdrop-blur-sm">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-6">

          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <RoosterLogo size={38} />
            <span className="font-heading font-black text-xl tracking-wider text-[#F5F5F5]">
              GALLER<span className="text-[#D71920]">APP</span>
            </span>
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {['PELEAS', 'EVENTOS', 'INSCRIBE TU GALLO', 'GALLOS', 'QUIÉNES SOMOS'].map((item, i) => (
              <button key={item} onClick={() => {
                if (item === 'PELEAS') setView('fights')
                if (item === 'QUIÉNES SOMOS') setView('about')
                if (item === 'INSCRIBE TU GALLO') setView('roosters')
                if (item === 'GALLOS') setView('rooster-directory')
                if (item === 'EVENTOS') setView('events')
              }}
                className={`px-4 py-2 text-xs font-heading font-semibold tracking-widest transition-colors duration-200 rounded
                  ${i === 0 ? 'text-[#F5F5F5] bg-[#171717]' : 'text-[#A3A3A3] hover:text-[#F5F5F5] hover:bg-[#171717]'}`}>
                {item}
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {signedInUser ? (
              <>
                <BalanceChip amount={signedInUser.saldo ?? 0} />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#171717] border border-[#2A2A2A]">
                  <div className="w-6 h-6 overflow-hidden rounded-full bg-gradient-to-br from-[#D71920] to-[#A01218] flex items-center justify-center text-[10px] font-bold font-heading">{signedInUser.profileImage ? <img src={signedInUser.profileImage} alt="" className="h-full w-full object-cover" /> : signedInUser.nombre.slice(0, 1).toUpperCase()}</div>
                  <span className="text-[#F5F5F5] text-sm font-semibold font-heading">{signedInUser.nombre}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${signedInUser.role === 'administrador' ? 'bg-[#D71920]/20 text-[#F58A8E]' : 'bg-[#2A2A2A] text-[#A3A3A3]'}`}>{signedInUser.role === 'administrador' ? 'ADMIN' : 'USUARIO'}</span>
                </div>
                <button onClick={() => setView('profile')} className="px-3 py-2 text-xs font-heading font-bold tracking-widest text-[#A3A3A3] hover:text-[#F5F5F5] border border-[#2A2A2A] rounded transition-all hover:border-[#444]">MI PERFIL</button>
                {signedInUser.role === 'administrador' && <button onClick={() => setView('admin')} className="px-3 py-2 text-xs font-heading font-bold tracking-widest text-[#F5F5F5] bg-[#D71920] hover:bg-[#A01218] rounded">PANEL ADMIN</button>}
                <button onClick={() => { sessionStorage.removeItem('gallerapp_token'); setSignedInUser(null) }} className="px-3 py-2 text-xs font-heading font-bold tracking-widest text-[#A3A3A3] hover:text-[#F5F5F5] border border-[#2A2A2A] rounded transition-all hover:border-[#444]">
                  SALIR
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setView('login')} className="hidden md:block px-4 py-2 text-xs font-heading font-bold tracking-widest text-[#A3A3A3] hover:text-[#F5F5F5] border border-[#2A2A2A] rounded transition-all hover:border-[#444]">
                  ENTRAR
                </button>
                <button onClick={() => setView('register')} className="px-4 py-2 text-xs font-heading font-bold tracking-widest text-[#F5F5F5] bg-[#D71920] hover:bg-[#A01218] rounded transition-all duration-200 shadow-lg shadow-[#D71920]/20">
                  REGISTRARSE
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <main className="max-w-[1440px] mx-auto px-6 py-6">

        {/* ─── LIVE SECTION: Player + Betting ─── */}
        <div className="flex gap-5 mb-5" style={{ minHeight: '480px' }}>

          {/* VIDEO PLAYER — 65% */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="relative rounded-xl overflow-hidden bg-[#0F0F0F] border border-[#2A2A2A] shadow-2xl shadow-black/60 flex flex-col" style={{ height: '460px' }}>

              {/* Video area */}
              <div className="relative flex-1 bg-[#080808] overflow-hidden">
                {isFightLive ? (
                  <>
                    <iframe
                      ref={streamFrameRef}
                      src="https://vdo.ninja/?view=TwHCPPY&cleanoutput&mutespeaker"
                      title="Transmisión en vivo"
                      className="absolute inset-0 h-full w-full border-0"
                      allow="autoplay; camera; microphone; fullscreen; picture-in-picture"
                      allowFullScreen
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />
                    <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-4 pointer-events-none">
                      <div className="flex flex-col gap-2">
                        <IconLive />
                        <div>
                          <p className="text-[#A3A3A3] text-[10px] font-heading font-semibold tracking-widest">{featuredFight.eventName}</p>
                          <p className="text-[#F5F5F5] text-sm font-heading font-bold tracking-wide">PELEA #{String(featuredFight.number).padStart(3, '0')}</p>
                        </div>
                      </div>
                    </div>
                    <div className="absolute bottom-5 left-0 right-0 flex items-end justify-between px-6 pointer-events-none">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-heading font-semibold tracking-widest text-[#A3A3A3]">GALLO A · {featuredFight.roosterA.code}</span>
                        <span className="text-xl font-heading font-black tracking-wide text-[#F5F5F5] drop-shadow-lg">{featuredFight.roosterA.name}</span>
                      </div>
                      <span className="text-[#D71920] text-xs font-heading font-black tracking-widest px-2 py-0.5 border border-[#D71920]/40 rounded">VS</span>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-heading font-semibold tracking-widest text-[#A3A3A3]">GALLO B · {featuredFight.roosterB.code}</span>
                        <span className="text-xl font-heading font-black tracking-wide text-[#F5F5F5] drop-shadow-lg">{featuredFight.roosterB.name}</span>
                      </div>
                    </div>
                  </>
                ) : isWaitingForFight ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#080B14]">
                    <img src="/stream-starting-soon.jpg" alt="La transmisión comenzará pronto" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl" />
                    <img src="/stream-starting-soon.jpg" alt="" aria-hidden="true" className="relative z-10 h-full w-full object-contain" />
                    {featuredFight && <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-between gap-2 px-3 pb-3 pt-16 sm:px-5">
                      <PreFightRoosterCard side="A" rooster={featuredFight.roosterA} />
                      <PreFightRoosterCard side="B" rooster={featuredFight.roosterB} />
                    </div>}
                    <div className="absolute left-4 top-4 z-30 rounded-full border border-[#D99024]/40 bg-black/70 px-3 py-1.5 text-[10px] font-heading font-black tracking-widest text-[#D99024]">PRÓXIMO COMBATE · {featuredFight?.eventName ?? featuredEvent?.name ?? 'PRÓXIMO EVENTO'}</div>
                  </div>
                ) : featuredFight?.status === 'finished' ? (
                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#080808]">
                    <img src="/stream-finished.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl" />
                    <img src="/stream-finished.jpg" alt="Transmisión finalizada. Gracias por acompañarnos." className="relative z-10 h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#080808] text-center">
                    <span className="text-xs font-heading font-black tracking-[0.25em] text-[#888]">PRÓXIMO COMBATE</span>
                    <span className="text-sm text-[#666]">Esperando la programación del próximo combate.</span>
                  </div>
                )}
              </div>

              {/* Live stream status bar */}
              <div className="flex items-center justify-between gap-4 px-5 py-3 bg-[#0F0F0F] border-t border-[#1F1F1F]">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${isFightLive ? 'animate-pulse bg-[#D71920]' : isWaitingForFight ? 'bg-[#D99024]' : 'bg-[#777]'}`} />
                  <span className={`text-xs font-heading font-black tracking-widest ${isFightLive ? 'text-[#D71920]' : isWaitingForFight ? 'text-[#D99024]' : 'text-[#888]'}`}>{isFightLive ? 'EN VIVO' : isWaitingForFight ? 'PRÓXIMAMENTE' : featuredFight ? 'FINALIZADA' : 'EN ESPERA'}</span>
                  <span className="hidden sm:inline text-xs text-[#A3A3A3]">{isFightLive ? 'Transmisión en directo' : isWaitingForFight ? 'El administrador iniciará la señal al comenzar el combate' : featuredFight ? 'La transmisión terminó' : 'Esperando el próximo combate'}</span>
                </div>
                {isFightLive && <div className="flex items-center gap-3">
                  <span className="hidden md:inline text-[10px] font-heading font-semibold tracking-wider text-[#777]">OBS + VDO.NINJA</span>
                  <button type="button" onClick={toggleStreamMute} aria-pressed={streamMuted} aria-label={streamMuted ? "Activar sonido" : "Silenciar transmisión"} title={streamMuted ? "Activar sonido" : "Silenciar transmisión"} className="inline-flex items-center gap-2 rounded-lg border border-[#333] px-3 py-2 text-xs font-bold text-[#D0D0D0] transition hover:border-[#D71920] hover:text-white">
                    <span aria-hidden="true">{streamMuted ? "🔇" : "🔊"}</span>
                    {streamMuted ? "ACTIVAR SONIDO" : "SILENCIAR"}
                  </button>
                </div>}
              </div>
            </div>
          </div>

          <button type="button" onClick={() => setView('fights')} className="flex min-h-40 w-72 shrink-0 flex-col items-start justify-center gap-3 rounded-xl border border-[#D99024]/30 bg-[#171717] p-5 text-left transition hover:border-[#D71920] xl:w-80">
            <span className="text-[10px] font-black tracking-[0.2em] text-[#D99024]">CARTELERA Y APUESTAS</span>
            <span className="font-heading text-lg font-black">{orderedFights.length} peleas registradas</span>
            <span className="text-xs text-[#A3A3A3]">Consulta resultados y apuesta antes de que inicie cada combate.</span>
            <span className="text-xs font-black tracking-wider text-[#D71920]">IR A PELEAS Y APUESTAS →</span>
          </button>
        </div>
        {/* ─── FIGHT INFO ─── */}
        <div className="mb-5 p-5 bg-[#171717] rounded-xl border border-[#2A2A2A] flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-3"><span className="font-heading font-black text-2xl text-[#D71920]">{featuredFight ? `#${String(featuredFight.number).padStart(3, '0')}` : '—'}</span></div>
          <div className="w-px h-10 bg-[#2A2A2A] hidden sm:block" />
          <div className="flex-1 min-w-48"><p className="text-[10px] font-heading font-semibold tracking-widest text-[#A3A3A3]">{featuredFight ? 'ENFRENTAMIENTO' : 'EVENTO DESTACADO'}</p><p className="font-heading font-black text-[#F5F5F5] text-lg">{featuredFight ? `${featuredFight.roosterA.name} VS ${featuredFight.roosterB.name}` : featuredEvent?.name ?? 'No hay eventos publicados'}</p>{featuredFight?.status === 'finished' && <p className="text-sm font-bold text-[#72D1A4]">Ganador oficial: {featuredFight.winnerRoosterName}</p>}{!featuredFight && featuredEvent && <p className="text-xs text-[#A3A3A3]">{featuredEvent.fights} peleas · {formatEventDate(featuredEvent.date)}</p>}</div>
          {(featuredFight || featuredEvent) && <div className="flex items-center gap-6 text-sm flex-wrap">
            <div><p className="text-[10px] font-heading font-semibold tracking-widest text-[#A3A3A3] mb-1">ESTADO</p><StatusBadge status={featuredFight ? fightStatusLabel(featuredFight.status) : eventStatusLabel(featuredEvent!.status)} /></div>
            <div><p className="text-[10px] font-heading font-semibold tracking-widest text-[#A3A3A3] mb-1">EVENTO</p><p className="font-heading font-semibold text-[#F5F5F5] text-sm">{featuredFight?.eventName ?? featuredEvent?.name}</p></div>
            <div><p className="text-[10px] font-heading font-semibold tracking-widest text-[#A3A3A3] mb-1">LUGAR</p><p className="font-heading font-semibold text-[#F5F5F5] text-sm">{featuredFight?.eventArena ?? featuredEvent?.arena}</p></div>
            <div><p className="text-[10px] font-heading font-semibold tracking-widest text-[#A3A3A3] mb-1">HORA</p><p className="font-heading font-semibold text-[#D99024] text-sm">{featuredFight?.eventTime ?? featuredEvent?.time}</p></div>
          </div>}
        </div>

        {/* ─── BOTTOM GRID: Upcoming Fights + Chat ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px] gap-5">

          <section className="rounded-xl border border-[#2A2A2A] bg-[#171717] p-5" aria-label="Apuestas uno contra uno">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-[10px] font-black tracking-[0.2em] text-[#D99024]">APUESTAS ENTRE USUARIOS</p><h2 className="mt-1 font-heading text-xl font-black">Reto 1 vs 1</h2></div>
              <button type="button" onClick={() => setView('fights')} className="text-[10px] font-black tracking-wider text-[#D71920] hover:text-white">CARTELERA E HISTORIAL →</button>
            </div>
            {homeWagerFight ? <>
              <p className="mt-3 text-xs text-[#A3A3A3]">Pelea #{String(homeWagerFight.number).padStart(3, '0')} · {homeWagerFight.eventName}: {homeWagerFight.roosterA.name} vs {homeWagerFight.roosterB.name}</p>
              {signedInUser ? <form onSubmit={createWager} className="mt-3 space-y-3 rounded-lg border border-[#2A2A2A] bg-[#0B0B0B] p-3">
                <p className="text-[11px] text-[#A3A3A3]">Elige un gallo y el monto. Otro usuario puede aceptar con el mismo monto por el rival.</p>
                <div className="grid grid-cols-2 gap-2">{[homeWagerFight.roosterA, homeWagerFight.roosterB].map((rooster, index) => { const side = index === 0 ? 'a' : 'b'; const selected = betSelected === side; return <button key={rooster.id} type="button" onClick={() => { setBetSelected(side); setBetError(''); setBetNotice('') }} aria-pressed={selected} className={`rounded-lg border p-2.5 text-left ${selected ? 'border-[#D71920] bg-[#D71920]/15' : 'border-[#333] bg-[#111]'}`}><span className="block text-[9px] font-black tracking-widest text-[#888]">GALLO {index === 0 ? 'A' : 'B'}</span><span className="mt-1 block truncate text-xs font-bold">{rooster.name}</span></button> })}</div>
                <div className="flex flex-wrap items-end gap-2"><label className="min-w-36 flex-1 text-[9px] font-bold tracking-widest text-[#A3A3A3]">MONTO<input type="number" min="1000" step="1000" max={signedInUser.saldo ?? 0} required value={betAmount} onChange={event => setBetAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-[#333] bg-[#111] px-3 py-2 text-sm text-white outline-none focus:border-[#D71920]" /></label><button type="submit" disabled={betSaving || !betSelected || Number(betAmount) < 1000 || Number(betAmount) > (signedInUser.saldo ?? 0)} className="rounded-lg bg-[#D71920] px-4 py-2.5 text-[10px] font-black tracking-wider text-white disabled:opacity-50">{betSaving ? 'PUBLICANDO…' : 'PUBLICAR RETO'}</button></div>
                <p className="text-[10px] text-[#777]">Saldo: {formatCOP(signedInUser.saldo ?? 0)} · Tu monto se reserva; pozo total si aceptan: {formatCOP(Math.max(0, Number(betAmount) || 0) * 2)}.</p>
                {betError && <p role="alert" className="text-xs text-[#F58A8E]">{betError}</p>}{betNotice && <p role="status" className="text-xs text-[#72D1A4]">{betNotice}</p>}
              </form> : <button type="button" onClick={() => setView('login')} className="mt-3 w-full rounded-lg border border-[#333] bg-[#0B0B0B] p-3 text-left text-xs font-bold">Inicia sesión para publicar o aceptar un reto.</button>}
              <div className="mt-4 space-y-2"><p className="text-[9px] font-black tracking-widest text-[#A3A3A3]">RETOS ABIERTOS · {openWagers.filter(wager => wager.fightId === homeWagerFight.id && wager.status === 'open').length}</p>
                {openWagers.filter(wager => wager.fightId === homeWagerFight.id).length ? openWagers.filter(wager => wager.fightId === homeWagerFight.id).map(wager => <article key={wager.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#2A2A2A] bg-[#0B0B0B] p-3"><div><p className="text-xs font-bold">{wager.creatorName} apuesta por {wager.creatorRoosterName}</p><p className="mt-1 text-[10px] text-[#888]">{wager.status === 'open' ? 'Abierta · monto igual para aceptar' : `${wager.accepterName} aceptó por ${wager.accepterRoosterName}`} · {formatCOP(wager.amount)} por persona</p></div>{wager.status === 'open' && signedInUser && (wager.isMine ? <button type="button" onClick={() => void cancelWager(wager.id)} disabled={wagerActionId === wager.id} className="rounded-lg border border-[#444] px-3 py-2 text-[9px] font-black text-[#AAA] disabled:opacity-50">{wagerActionId === wager.id ? '…' : 'CANCELAR'}</button> : <button type="button" onClick={() => void acceptWager(wager.id)} disabled={wagerActionId === wager.id} className="rounded-lg bg-[#176B45] px-3 py-2 text-[9px] font-black text-white disabled:opacity-50">{wagerActionId === wager.id ? '…' : `ACEPTAR · ${formatCOP(wager.amount)}`}</button>)}</article>) : <p className="rounded-lg border border-dashed border-[#333] p-3 text-xs text-[#777]">Aún no hay retos para esta pelea.</p>}
              </div>
            </> : <p className="mt-3 rounded-lg border border-dashed border-[#333] p-4 text-xs text-[#888]">No hay una pelea programada con apuestas abiertas.</p>}
          </section>
          {/* LIVE CHAT */}
          <div className="flex flex-col bg-[#171717] rounded-xl border border-[#2A2A2A] overflow-hidden" style={{ maxHeight: '380px' }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2A2A2A] flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#176B45] animate-pulse" />
              <span className="font-heading font-black text-sm tracking-widest text-[#F5F5F5]">CHAT EN VIVO</span>
              <span className="ml-auto text-[10px] font-heading text-[#A3A3A3]">2,847 online</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0">
              {messages.map(msg => (
                <div key={msg.id} className="flex gap-2 group">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#D71920] to-[#7A3E20] flex items-center justify-center text-[9px] font-heading font-black flex-shrink-0 mt-0.5">
                    {msg.user[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className={`text-xs font-heading font-bold ${msg.user === 'Tú' ? 'text-[#D71920]' : 'text-[#D99024]'}`}>
                        {msg.user}
                      </span>
                      <span className="text-[10px] text-[#A3A3A3] font-mono">{msg.time}</span>
                    </div>
                    <p className="text-xs text-[#D1D1D1] leading-relaxed mt-0.5">{msg.msg}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t border-[#2A2A2A] flex gap-2 flex-shrink-0">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-[#0F0F0F] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs text-[#F5F5F5] placeholder:text-[#555] outline-none focus:border-[#D71920] transition-colors font-body"
              />
              <button onClick={sendMessage}
                className="w-8 h-8 rounded-lg bg-[#D71920] hover:bg-[#A01218] flex items-center justify-center transition-all duration-200 text-[#F5F5F5] flex-shrink-0 shadow-lg shadow-[#D71920]/20">
                <IconSend />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="mt-12 border-t border-[#1F1F1F] py-6 px-6">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <RoosterLogo size={24} />
            <span className="font-heading font-black text-sm tracking-wider text-[#A3A3A3]">
              GALLER<span className="text-[#D71920]">APP</span>
            </span>
            <span className="text-[#2A2A2A] text-xs">|</span>
            <span className="text-xs text-[#555] font-heading">Plataforma de transmisión deportiva</span>
          </div>
          <div className="flex items-center gap-6 text-[10px] font-heading tracking-widest text-[#555]">
            <button className="hover:text-[#A3A3A3] transition-colors">TÉRMINOS</button>
            <button className="hover:text-[#A3A3A3] transition-colors">PRIVACIDAD</button>
            <button className="hover:text-[#A3A3A3] transition-colors">CONTACTO</button>
            <span>© 2026 GallerApp</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
