import { useEffect, useState, type FormEvent } from 'react'
import { RoosterLogo } from '../components/RoosterLogo'
import { apiRequest, type GallerUser } from '../lib/api'

interface ProfileData extends GallerUser { fecha: string; documento: string; profileImage: string }
interface ProfileProps { user: GallerUser; onBack: () => void; onUpdated: (profile: ProfileData) => void }
interface DemoPackage { id: string; title: string; creditAmount: number; priceCop: number }
interface DemoPayment { id: string; packageId: string; creditAmount: number; priceCop: number; status: string; provider?: string; createdAt: string; approvedAt?: string | null; creditedAt?: string | null }

const fieldClass = 'w-full rounded-xl border border-[#2A2A2A] bg-[#0F0F0F] px-4 py-3 text-sm text-[#F5F5F5] outline-none transition-colors focus:border-[#D71920]'

async function prepareImage(file: File) {
  if (file.type !== 'image/jpeg') throw new Error('La foto de perfil debe estar en formato JPG.')
  if (file.size > 8 * 1024 * 1024) throw new Error('La imagen original debe pesar menos de 8 MB.')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo procesar la imagen.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const result = canvas.toDataURL('image/jpeg', 0.86)
  if (Math.floor((result.split(',')[1] || '').length * 0.75) > 1_500_000) throw new Error('La imagen optimizada supera 1.5 MB.')
  return result
}

export default function Profile({ user, onBack, onUpdated }: ProfileProps) {
  const [profile, setProfile] = useState<ProfileData>({ ...user, fecha: user.fecha || '', documento: user.documento || '', profileImage: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [paymentConfig, setPaymentConfig] = useState<{ enabled: boolean; mode: 'sandbox' | 'simulator'; provider: string; packages: DemoPackage[] } | null>(null)
  const [demoPayments, setDemoPayments] = useState<DemoPayment[]>([])
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [selectedDemoPackage, setSelectedDemoPackage] = useState<DemoPackage | null>(null)
  const [demoOutcome, setDemoOutcome] = useState<'approved' | 'rejected'>('approved')
  const [checkingPaymentId, setCheckingPaymentId] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [paymentNotice, setPaymentNotice] = useState('')

  useEffect(() => {
    let active = true
    async function loadProfile() {
      try {
        const [config, profileResult, history] = await Promise.all([
          apiRequest<{ enabled: boolean; mode: 'sandbox' | 'simulator'; provider: string; packages: DemoPackage[] }>('/payments/demo/config'),
          apiRequest<{ profile: ProfileData }>('/auth/profile'),
          apiRequest<{ payments: DemoPayment[] }>('/payments/demo/history'),
        ])
        if (!active) return
        setPaymentConfig(config)
        setProfile(profileResult.profile)
        setDemoPayments(history.payments)

        const query = new URLSearchParams(window.location.search)
        const returnedPaymentId = query.get('demo_payment')
        if (returnedPaymentId) {
          try {
            const paymentId = query.get('payment_id') || query.get('collection_id') || ''
            const result = await apiRequest<{ payment: DemoPayment; profile: ProfileData | null }>(`/payments/demo/${encodeURIComponent(returnedPaymentId)}/sync`, { paymentId }, 'POST')
            if (!active) return
            if (result.profile) {
              setProfile(result.profile)
              onUpdated(result.profile)
            }
            setDemoPayments(current => [result.payment, ...current.filter(item => item.id !== result.payment.id)])
            setPaymentNotice(result.payment.creditedAt
              ? 'Pago de prueba aprobado. Se añadieron créditos demo a tu saldo.'
              : result.payment.status === 'pending'
                ? 'El pago de prueba sigue pendiente. Puedes verificarlo de nuevo en unos segundos.'
                : 'Checkout de prueba procesado. Consulta el estado en el historial.')
          } catch (err) {
            if (active) setPaymentError(err instanceof Error ? err.message : 'No se pudo verificar el pago de prueba.')
          } finally {
            window.history.replaceState({}, '', window.location.pathname)
          }
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar tu perfil.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadProfile()
    return () => { active = false }
  }, [onUpdated])

  function set<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setProfile(current => ({ ...current, [key]: value }))
  }

  async function chooseImage(file?: File) {
    if (!file) return
    setError('')
    setNotice('')
    try { set('profileImage', await prepareImage(file)) }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo cargar la foto.') }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest<{ profile: ProfileData }>('/auth/profile', profile, 'PUT')
      setProfile(result.profile)
      onUpdated(result.profile)
      setNotice('Tus datos se guardaron correctamente.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el perfil.')
    } finally { setSaving(false) }
  }

  async function startDemoCheckout(packageId: string) {
    if (paymentConfig?.mode === 'simulator') {
      const selectedPackage = paymentConfig.packages.find(item => item.id === packageId)
      if (selectedPackage) {
        setPaymentError('')
        setPaymentNotice('')
        setDemoOutcome('approved')
        setSelectedDemoPackage(selectedPackage)
      }
      return
    }
    setPaymentBusy(true)
    setPaymentError('')
    setPaymentNotice('')
    try {
      const result = await apiRequest<{ checkoutUrl: string }>('/payments/demo/checkout', { packageId }, 'POST')
      window.location.assign(result.checkoutUrl)
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'No se pudo abrir el checkout de prueba.')
      setPaymentBusy(false)
    }
  }

  async function simulateDemoPayment(outcome: 'approved' | 'rejected') {
    if (!selectedDemoPackage) return
    setPaymentBusy(true)
    setPaymentError('')
    setPaymentNotice('')
    try {
      const result = await apiRequest<{ payment: DemoPayment; profile: ProfileData }>('/payments/demo/simulate', {
        packageId: selectedDemoPackage.id,
        outcome,
      }, 'POST')
      setDemoPayments(current => [result.payment, ...current.filter(item => item.id !== result.payment.id)].slice(0, 10))
      setProfile(result.profile)
      onUpdated(result.profile)
      setPaymentNotice(outcome === 'approved'
        ? `Pago simulado aprobado. Se añadieron ${new Intl.NumberFormat('es-CO').format(result.payment.creditAmount)} créditos ficticios a tu saldo.`
        : 'Pago simulado rechazado. No se añadieron créditos.')
      setSelectedDemoPackage(null)
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'No se pudo completar la simulación.')
    } finally {
      setPaymentBusy(false)
    }
  }

  async function refreshDemoPayment(payment: DemoPayment) {
    setCheckingPaymentId(payment.id)
    setPaymentError('')
    setPaymentNotice('')
    try {
      const result = await apiRequest<{ payment: DemoPayment; profile: ProfileData | null }>(`/payments/demo/${encodeURIComponent(payment.id)}/sync`, {}, 'POST')
      setDemoPayments(current => current.map(item => item.id === payment.id ? result.payment : item))
      if (result.profile) {
        setProfile(result.profile)
        onUpdated(result.profile)
      }
      setPaymentNotice(result.payment.creditedAt ? 'Pago aprobado; los créditos demo están en tu saldo.' : 'El proveedor aún no confirma un pago aprobado.')
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'No se pudo consultar el pago de prueba.')
    } finally { setCheckingPaymentId('') }
  }

  return <main className="min-h-screen bg-[#0B0B0B] px-4 py-8 text-[#F5F5F5] sm:px-6">
    <div className="mx-auto max-w-3xl">
      <header className="mb-8 flex items-center justify-between border-b border-[#D71920]/20 pb-5">
        <div className="flex items-center gap-3"><RoosterLogo size={38} /><span className="font-heading text-xl font-black tracking-wider">GALLER<span className="text-[#D71920]">APP</span></span></div>
        <button onClick={onBack} className="rounded-lg border border-[#333] px-4 py-2 text-xs font-bold tracking-widest text-[#AAA] hover:text-white">VOLVER</button>
      </header>

      <section className="overflow-hidden rounded-2xl border border-[#2A2A2A] bg-[#151515] shadow-2xl shadow-black/30">
        <div className="border-b border-[#2A2A2A] p-6 sm:p-8">
          <p className="text-[10px] font-black tracking-[0.22em] text-[#D71920]">MI CUENTA</p>
          <h1 className="mt-2 font-heading text-3xl font-black">Mi perfil</h1>
          <p className="mt-2 text-sm text-[#A3A3A3]">Consulta y actualiza tus datos personales y foto de perfil.</p>
        </div>

        {loading ? <p className="p-8 text-sm text-[#A3A3A3]">Cargando tu información…</p> : <>
        <form onSubmit={saveProfile} className="space-y-6 p-6 sm:p-8">
          <div className="flex flex-col items-center gap-4 rounded-xl border border-[#2A2A2A] bg-[#101010] p-5 sm:flex-row">
            <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#D71920]/60 bg-[#231415] text-3xl font-black text-white">
              {profile.profileImage ? <img src={profile.profileImage} alt="Foto de perfil" className="h-full w-full object-cover" /> : profile.nombre.slice(0, 1).toUpperCase()}
            </div>
            <div className="text-center sm:text-left">
              <p className="font-heading text-sm font-black tracking-widest">FOTO DE PERFIL</p>
              <p className="mt-1 text-xs text-[#888]">Solo JPG · imagen optimizada automáticamente · máximo 1.5 MB</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <label className="cursor-pointer rounded-lg bg-[#D71920] px-3 py-2 text-[10px] font-black tracking-wider text-white hover:bg-[#A01218]">SUBIR FOTO
                  <input type="file" accept="image/jpeg" className="hidden" onChange={event => { void chooseImage(event.target.files?.[0]); event.target.value = '' }} />
                </label>
                {profile.profileImage && <button type="button" onClick={() => set('profileImage', '')} className="rounded-lg border border-[#444] px-3 py-2 text-[10px] font-bold tracking-wider text-[#AAA]">QUITAR FOTO</button>}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-[10px] font-bold tracking-widest text-[#A3A3A3]">NOMBRE
              <input required maxLength={80} value={profile.nombre} onChange={event => set('nombre', event.target.value)} className={`${fieldClass} mt-1.5`} />
            </label>
            <label className="text-[10px] font-bold tracking-widest text-[#A3A3A3]">APELLIDO
              <input required maxLength={80} value={profile.apellido} onChange={event => set('apellido', event.target.value)} className={`${fieldClass} mt-1.5`} />
            </label>
            <label className="text-[10px] font-bold tracking-widest text-[#A3A3A3] sm:col-span-2">CORREO ELECTRÓNICO
              <input required type="email" maxLength={254} value={profile.email} onChange={event => set('email', event.target.value)} className={`${fieldClass} mt-1.5`} />
            </label>
            <label className="text-[10px] font-bold tracking-widest text-[#A3A3A3]">TELÉFONO
              <input required type="tel" maxLength={30} value={profile.telefono} onChange={event => set('telefono', event.target.value)} className={`${fieldClass} mt-1.5`} />
            </label>
            <label className="text-[10px] font-bold tracking-widest text-[#A3A3A3]">PAÍS
              <input required maxLength={80} value={profile.pais} onChange={event => set('pais', event.target.value)} className={`${fieldClass} mt-1.5`} />
            </label>
            <label className="text-[10px] font-bold tracking-widest text-[#A3A3A3]">FECHA DE NACIMIENTO
              <input type="date" value={profile.fecha} onChange={event => set('fecha', event.target.value)} className={`${fieldClass} mt-1.5`} />
            </label>
            <label className="text-[10px] font-bold tracking-widest text-[#A3A3A3]">DOCUMENTO DE IDENTIDAD
              <input required maxLength={40} value={profile.documento} onChange={event => set('documento', event.target.value)} className={`${fieldClass} mt-1.5`} />
            </label>
            <div className="text-[10px] font-bold tracking-widest text-[#A3A3A3]">SALDO DEMO
              <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-xl border border-[#2A2A2A] bg-[#0F0F0F] p-2">
                <p className="px-2 py-2 text-base font-black text-[#D99024]">{new Intl.NumberFormat('es-CO').format(profile.saldo ?? 0)} créditos demo</p>
              </div>
              <p className="mt-2 text-xs font-normal normal-case tracking-normal text-[#888]">Son créditos ficticios sin valor monetario y no se pueden canjear ni retirar. La opción de abajo {paymentConfig?.mode === 'simulator' ? 'simula el checkout sin cobrar' : 'usa el checkout Sandbox de prueba'}.</p>
            </div>
          </div>

          {error && <p role="alert" className="rounded-xl border border-[#D71920]/40 bg-[#D71920]/10 px-4 py-3 text-sm text-[#F5A0A3]">{error}</p>}
          {notice && <p role="status" className="rounded-xl border border-[#176B45]/40 bg-[#176B45]/10 px-4 py-3 text-sm text-[#72D1A4]">{notice}</p>}
          <div className="flex flex-wrap justify-end gap-3 border-t border-[#2A2A2A] pt-5">
            <button type="button" onClick={onBack} className="rounded-lg border border-[#444] px-5 py-3 text-xs font-black tracking-widest text-[#AAA]">CANCELAR</button>
            <button disabled={saving} className="rounded-lg bg-[#D71920] px-6 py-3 text-xs font-black tracking-widest text-white disabled:opacity-50">{saving ? 'GUARDANDO…' : 'GUARDAR CAMBIOS'}</button>
          </div>
        </form>

        <section className="overflow-hidden rounded-[26px] border border-white/10 bg-[#101014] shadow-2xl shadow-black/30">
          <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#271510] via-[#171418] to-[#101014] p-6 sm:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full bg-[#D71920]/15 blur-3xl" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D99024]/30 bg-[#D99024]/10 text-xl font-black text-[#E7A638]">D</div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-black tracking-[0.22em] text-[#E7A638]">GALLERAPP · WALLET DEMO</p>
                    <span className="rounded-full border border-[#176B45]/40 bg-[#176B45]/15 px-2.5 py-1 text-[9px] font-bold tracking-widest text-[#72D1A4]">SIN COBRO REAL</span>
                  </div>
                  <h2 className="mt-2 font-heading text-2xl font-black sm:text-3xl">Recarga créditos demo</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#B8B4B2]">{paymentConfig?.mode === 'simulator' ? 'Prueba el flujo de pago de GallerApp sin cuentas externas ni credenciales.' : 'Prueba el checkout de Mercado Pago con su entorno Sandbox.'}</p>
                </div>
              </div>
              <div className="min-w-[170px] rounded-2xl border border-white/10 bg-black/20 px-4 py-3 sm:text-right">
                <p className="text-[9px] font-bold tracking-[0.18em] text-[#A3A3A3]">SALDO ACTUAL</p>
                <p className="mt-1 font-heading text-lg font-black text-[#E7A638]">{new Intl.NumberFormat('es-CO').format(profile.saldo ?? 0)} <span className="text-xs font-semibold text-[#AAA]">créditos</span></p>
              </div>
            </div>
            <div className="relative mt-6 flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-black text-[#E7A638]">i</span>
              <p className="text-xs leading-relaxed text-[#C5C0BD]">Este checkout es solo para la entrega académica. No ingresa datos bancarios ni cobra; los créditos son ficticios y no se pueden retirar.</p>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-8">
            {!paymentConfig?.enabled && <p role="status" className="rounded-xl border border-[#D99024]/20 bg-[#D99024]/[0.06] px-4 py-3 text-sm text-[#E7C58E]">El checkout no está disponible temporalmente.</p>}
            {paymentError && <p role="alert" className="rounded-xl border border-[#D71920]/30 bg-[#D71920]/[0.08] px-4 py-3 text-sm text-[#F5A0A3]">{paymentError}</p>}
            {paymentNotice && <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${paymentNotice.toLowerCase().includes('rechazado') ? 'border-[#D99024]/30 bg-[#D99024]/[0.08] text-[#E7C58E]' : 'border-[#176B45]/30 bg-[#176B45]/[0.08] text-[#72D1A4]'}`}>{paymentNotice}</p>}

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[9px] font-black tracking-[0.2em] text-[#888]">RECARGAS DISPONIBLES</p>
                <h3 className="mt-1 font-heading text-lg font-black">Elige tu paquete</h3>
              </div>
              <p className="text-xs text-[#777]">{paymentConfig?.mode === 'simulator' ? 'Simulación instantánea' : 'Pago de prueba Sandbox'}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {(paymentConfig?.packages || []).map((item, index) => <article key={item.id} className={`relative overflow-hidden rounded-2xl border p-5 transition-colors ${index === 1 ? 'border-[#D99024]/35 bg-gradient-to-br from-[#211912] to-[#121212]' : 'border-white/10 bg-[#141416]'}`}>
                {index === 1 && <span className="absolute right-4 top-4 rounded-full bg-[#D99024]/15 px-2.5 py-1 text-[9px] font-black tracking-wider text-[#E7A638]">MÁS CRÉDITOS</span>}
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-sm font-black text-[#E7A638]">{index + 1}</span>
                  <div>
                    <p className="font-heading text-sm font-black">{item.title}</p>
                    <p className="mt-0.5 text-[10px] tracking-wide text-[#888]">RECARGA DE DEMOSTRACIÓN</p>
                  </div>
                </div>
                <div className="mt-5 border-b border-white/10 pb-4">
                  <p className="font-heading text-2xl font-black tracking-tight text-[#E7A638]">{new Intl.NumberFormat('es-CO').format(item.creditAmount)}</p>
                  <p className="mt-1 text-xs text-[#A3A3A3]">créditos demo</p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold tracking-wider text-[#777]">VALOR ILUSTRATIVO</p>
                    <p className="mt-1 text-sm font-bold text-[#DDD]">COP ${new Intl.NumberFormat('es-CO').format(item.priceCop)}</p>
                  </div>
                  <span className="rounded-lg border border-[#176B45]/30 bg-[#176B45]/10 px-2.5 py-1.5 text-[9px] font-bold tracking-wider text-[#72D1A4]">$0 COBRADO</span>
                </div>
                <button type="button" disabled={!paymentConfig?.enabled || paymentBusy} onClick={() => void startDemoCheckout(item.id)} className="mt-5 w-full rounded-xl bg-[#D71920] px-4 py-3 text-[10px] font-black tracking-[0.14em] text-white shadow-lg shadow-[#D71920]/10 transition hover:bg-[#EB2028] disabled:cursor-not-allowed disabled:opacity-40">{paymentBusy ? 'PROCESANDO…' : paymentConfig?.mode === 'simulator' ? 'ELEGIR ESTE PAQUETE' : 'ABRIR PAGO SANDBOX'}</button>
              </article>)}
            </div>

            {demoPayments.length > 0 && <div className="border-t border-white/10 pt-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div><p className="text-[9px] font-black tracking-[0.18em] text-[#888]">ACTIVIDAD</p><h3 className="mt-1 font-heading text-sm font-black">Últimas simulaciones</h3></div>
                <span className="text-[10px] text-[#777]">{demoPayments.length} recientes</span>
              </div>
              <div className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-black/15 px-4">
                {demoPayments.map(payment => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div><p className="text-xs font-semibold text-[#DDD]">{new Intl.NumberFormat('es-CO').format(payment.creditAmount)} créditos demo</p><p className="mt-1 text-[10px] text-[#777]">{new Date(payment.createdAt).toLocaleString('es-CO')}</p></div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-black tracking-wider ${payment.creditedAt ? 'bg-[#176B45]/15 text-[#72D1A4]' : payment.status === 'rejected' ? 'bg-[#D99024]/10 text-[#E7C58E]' : 'bg-white/10 text-[#AAA]'}`}>{payment.creditedAt ? 'APROBADO' : payment.status === 'rejected' ? 'RECHAZADO' : payment.status.toUpperCase()}</span>
                    {payment.status === 'pending' && <button type="button" onClick={() => void refreshDemoPayment(payment)} disabled={checkingPaymentId === payment.id} className="rounded-lg border border-white/10 px-3 py-1.5 text-[9px] font-bold text-[#DDD] disabled:opacity-50">{checkingPaymentId === payment.id ? 'CONSULTANDO…' : 'VERIFICAR'}</button>}
                  </div>
                </div>)}
              </div>
            </div>}
          </div>
        </section>
        {selectedDemoPackage && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !paymentBusy) setSelectedDemoPackage(null) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="demo-checkout-title" className="w-full max-w-md overflow-hidden rounded-[24px] border border-white/10 bg-[#141416] shadow-2xl shadow-black/70">
            <div className="border-b border-white/10 bg-gradient-to-br from-[#251611] to-[#141416] p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D99024]/30 bg-[#D99024]/10 text-sm font-black text-[#E7A638]">D</div>
                <span className="rounded-full border border-[#176B45]/30 bg-[#176B45]/10 px-3 py-1.5 text-[9px] font-black tracking-wider text-[#72D1A4]">SIMULACIÓN · $0</span>
              </div>
              <p className="mt-5 text-[9px] font-black tracking-[0.2em] text-[#E7A638]">CHECKOUT ACADÉMICO</p>
              <h2 id="demo-checkout-title" className="mt-1 font-heading text-2xl font-black">Confirma tu paquete</h2>
            </div>
            <div className="space-y-5 p-6">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-[#DDD]">{selectedDemoPackage.title}</p><p className="mt-1 text-[11px] text-[#888]">Créditos ficticios para la demostración</p></div><p className="text-right font-heading text-lg font-black text-[#E7A638]">{new Intl.NumberFormat('es-CO').format(selectedDemoPackage.creditAmount)}</p></div>
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs"><span className="text-[#888]">Importe ilustrativo</span><span className="font-semibold text-[#CCC]">COP ${new Intl.NumberFormat('es-CO').format(selectedDemoPackage.priceCop)} · no se cobra</span></div>
              </div>
              {paymentError && <p role="alert" className="rounded-xl border border-[#D71920]/30 bg-[#D71920]/[0.08] px-4 py-3 text-xs text-[#F5A0A3]">{paymentError}</p>}
              <div>
                <p className="mb-2 text-[9px] font-black tracking-[0.18em] text-[#888]">RESULTADO PARA LA PRESENTACIÓN</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" aria-pressed={demoOutcome === 'approved'} disabled={paymentBusy} onClick={() => setDemoOutcome('approved')} className={`rounded-xl border p-3 text-left transition ${demoOutcome === 'approved' ? 'border-[#176B45]/60 bg-[#176B45]/10' : 'border-white/10 bg-black/10 hover:border-white/20'}`}><span className={`text-xs font-bold ${demoOutcome === 'approved' ? 'text-[#72D1A4]' : 'text-[#BBB]'}`}>Aprobado</span><span className="mt-1 block text-[10px] leading-relaxed text-[#777]">Acredita los créditos demo</span></button>
                  <button type="button" aria-pressed={demoOutcome === 'rejected'} disabled={paymentBusy} onClick={() => setDemoOutcome('rejected')} className={`rounded-xl border p-3 text-left transition ${demoOutcome === 'rejected' ? 'border-[#D99024]/50 bg-[#D99024]/[0.08]' : 'border-white/10 bg-black/10 hover:border-white/20'}`}><span className={`text-xs font-bold ${demoOutcome === 'rejected' ? 'text-[#E7C58E]' : 'text-[#BBB]'}`}>Rechazado</span><span className="mt-1 block text-[10px] leading-relaxed text-[#777]">No cambia tu saldo demo</span></button>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" disabled={paymentBusy} onClick={() => setSelectedDemoPackage(null)} className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-[10px] font-bold tracking-wider text-[#AAA] hover:text-white disabled:opacity-50">VOLVER</button>
                <button type="button" disabled={paymentBusy} onClick={() => void simulateDemoPayment(demoOutcome)} className="flex-[1.4] rounded-xl bg-[#D71920] px-4 py-3 text-[10px] font-black tracking-wider text-white shadow-lg shadow-[#D71920]/15 hover:bg-[#EB2028] disabled:opacity-50">{paymentBusy ? 'PROCESANDO…' : 'SIMULAR PAGO'}</button>
              </div>
              <p className="text-center text-[10px] leading-relaxed text-[#666]">No se solicitan tarjetas, cuentas ni datos de pago.</p>
            </div>
          </section>
        </div>}
        </>}
      </section>
    </div>
  </main>
}
