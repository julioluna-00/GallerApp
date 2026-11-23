import { useEffect, useState, type FormEvent } from 'react'
import { RoosterLogo } from '../components/RoosterLogo'
import { apiRequest, type GallerUser } from '../lib/api'

interface ProfileData extends GallerUser { fecha: string; documento: string; profileImage: string }
interface ProfileProps { user: GallerUser; onBack: () => void; onUpdated: (profile: ProfileData) => void }
interface DemoPackage { id: string; title: string; creditAmount: number; priceCop: number }
interface DemoPayment { id: string; packageId: string; creditAmount: number; priceCop: number; status: string; createdAt: string; approvedAt?: string | null; creditedAt?: string | null }

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
  const [paymentConfig, setPaymentConfig] = useState<{ enabled: boolean; provider: string; packages: DemoPackage[] } | null>(null)
  const [demoPayments, setDemoPayments] = useState<DemoPayment[]>([])
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [checkingPaymentId, setCheckingPaymentId] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [paymentNotice, setPaymentNotice] = useState('')

  useEffect(() => {
    let active = true
    async function loadProfile() {
      try {
        const [config, profileResult, history] = await Promise.all([
          apiRequest<{ enabled: boolean; provider: string; packages: DemoPackage[] }>('/payments/demo/config'),
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
              <p className="mt-2 text-xs font-normal normal-case tracking-normal text-[#888]">Son créditos ficticios sin valor monetario y no se pueden canjear ni retirar. La opción de abajo simula el checkout con Sandbox y medios de pago de prueba.</p>
            </div>
          </div>

          {error && <p role="alert" className="rounded-xl border border-[#D71920]/40 bg-[#D71920]/10 px-4 py-3 text-sm text-[#F5A0A3]">{error}</p>}
          {notice && <p role="status" className="rounded-xl border border-[#176B45]/40 bg-[#176B45]/10 px-4 py-3 text-sm text-[#72D1A4]">{notice}</p>}
          <div className="flex flex-wrap justify-end gap-3 border-t border-[#2A2A2A] pt-5">
            <button type="button" onClick={onBack} className="rounded-lg border border-[#444] px-5 py-3 text-xs font-black tracking-widest text-[#AAA]">CANCELAR</button>
            <button disabled={saving} className="rounded-lg bg-[#D71920] px-6 py-3 text-xs font-black tracking-widest text-white disabled:opacity-50">{saving ? 'GUARDANDO…' : 'GUARDAR CAMBIOS'}</button>
          </div>
        </form>

        <section className="overflow-hidden rounded-2xl border border-[#D99024]/30 bg-[#151515] shadow-xl shadow-black/20">
          <div className="border-b border-[#2A2A2A] p-6 sm:p-8">
            <p className="text-[10px] font-black tracking-[0.22em] text-[#D99024]">CHECKOUT · SANDBOX</p>
            <h2 className="mt-2 font-heading text-2xl font-black">Recarga créditos demo</h2>
            <p className="mt-2 text-sm text-[#A3A3A3]">{paymentConfig?.provider || 'Mercado Pago · modo de prueba'}. Usa la cuenta compradora y las tarjetas de prueba que ofrece Mercado Pago.</p>
            <p className="mt-4 rounded-xl border border-[#D99024]/30 bg-[#D99024]/10 p-3 text-xs leading-relaxed text-[#E7C58E]">Demostración académica: los valores mostrados no se cobran como dinero real. Solo se aceptan pagos Sandbox y, si el proveedor confirma la prueba, se acreditan créditos ficticios sin valor de retiro.</p>
          </div>

          <div className="space-y-4 p-6 sm:p-8">
            {!paymentConfig?.enabled && <p role="status" className="rounded-xl border border-[#D99024]/30 bg-[#D99024]/10 px-4 py-3 text-sm text-[#E7C58E]">Falta configurar en Render las variables secretas MP_TEST_ACCESS_TOKEN y MP_TEST_WEBHOOK_SECRET. El checkout permanecerá desactivado hasta configurar credenciales y webhook de prueba.</p>}
            {paymentError && <p role="alert" className="rounded-xl border border-[#D71920]/40 bg-[#D71920]/10 px-4 py-3 text-sm text-[#F5A0A3]">{paymentError}</p>}
            {paymentNotice && <p role="status" className="rounded-xl border border-[#176B45]/40 bg-[#176B45]/10 px-4 py-3 text-sm text-[#72D1A4]">{paymentNotice}</p>}

            <div className="grid gap-3 sm:grid-cols-2">
              {(paymentConfig?.packages || []).map(item => <article key={item.id} className="rounded-xl border border-[#333] bg-[#101010] p-4">
                <p className="font-heading text-sm font-black">{item.title}</p>
                <p className="mt-2 text-lg font-black text-[#D99024]">{new Intl.NumberFormat('es-CO').format(item.creditAmount)} créditos demo</p>
                <p className="mt-1 text-xs text-[#888]">Valor ilustrativo de prueba: COP ${new Intl.NumberFormat('es-CO').format(item.priceCop)}</p>
                <button type="button" disabled={!paymentConfig?.enabled || paymentBusy} onClick={() => void startDemoCheckout(item.id)} className="mt-4 w-full rounded-lg bg-[#D71920] px-4 py-3 text-xs font-black tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-40">{paymentBusy ? 'ABRIENDO CHECKOUT…' : 'PROBAR PAGO SANDBOX'}</button>
              </article>)}
            </div>

            {demoPayments.length > 0 && <div className="border-t border-[#2A2A2A] pt-4">
              <h3 className="font-heading text-xs font-black tracking-widest">PAGOS DE PRUEBA RECIENTES</h3>
              <div className="mt-3 space-y-2">{demoPayments.map(payment => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#2A2A2A] bg-[#101010] p-3">
                <div>
                  <p className="text-xs font-bold">{new Intl.NumberFormat('es-CO').format(payment.creditAmount)} créditos demo · COP ${new Intl.NumberFormat('es-CO').format(payment.priceCop)}</p>
                  <p className="mt-1 text-[10px] text-[#888]">{payment.creditedAt ? 'APROBADO · CRÉDITOS DEMO AÑADIDOS' : payment.status === 'pending' ? 'PENDIENTE DE CONFIRMACIÓN' : payment.status.toUpperCase()} · {new Date(payment.createdAt).toLocaleString('es-CO')}</p>
                </div>
                {payment.status === 'pending' && <button type="button" onClick={() => void refreshDemoPayment(payment)} disabled={checkingPaymentId === payment.id} className="rounded-lg border border-[#555] px-3 py-2 text-[10px] font-black tracking-wider text-[#DDD] disabled:opacity-50">{checkingPaymentId === payment.id ? 'CONSULTANDO…' : 'VERIFICAR'}</button>}
              </div>)}</div>
            </div>}
          </div>
        </section>
        </>}
      </section>
    </div>
  </main>
}
