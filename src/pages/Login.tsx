import { useState, type FormEvent } from 'react'
import { RoosterLogo } from '../components/RoosterLogo'
import { apiRequest, type GallerUser } from '../lib/api'

interface LoginProps {
  onBack: () => void
  onGoRegister: () => void
  onSuccess: (user: GallerUser) => void
}

type LoginMode = 'login' | 'forgot' | 'reset'

const inputClass = 'w-full rounded-xl border border-[#2A2A2A] bg-[#0F0F0F] px-4 py-3 text-sm text-[#F5F5F5] outline-none transition-colors placeholder:text-[#555] focus:border-[#D71920]'
const labelClass = 'text-[10px] font-heading font-bold tracking-widest text-[#A3A3A3]'

export default function Login({ onBack, onGoRegister, onSuccess }: LoginProps) {
  const [mode, setMode] = useState<LoginMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [developmentCode, setDevelopmentCode] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest<{ token: string; user: GallerUser }>('/auth/login', { email, password })
      sessionStorage.setItem('gallerapp_token', result.token)
      onSuccess(result.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión.')
    } finally { setLoading(false) }
  }

  async function handleForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    setDevelopmentCode('')
    try {
      const result = await apiRequest<{ message: string; developmentCode?: string }>('/auth/forgot-password', { email })
      setNotice(result.message)
      setDevelopmentCode(result.developmentCode || '')
      setResetCode('')
      setNewPassword('')
      setConfirmPassword('')
      setMode('reset')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible generar el código de recuperación.')
    } finally { setLoading(false) }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (newPassword !== confirmPassword) { setError('Las contraseñas no coinciden.'); return }
    setLoading(true)
    try {
      const result = await apiRequest<{ message: string }>('/auth/reset-password', { email, code: resetCode, password: newPassword })
      setMode('login')
      setPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setResetCode('')
      setDevelopmentCode('')
      setNotice(result.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cambiar la contraseña.')
    } finally { setLoading(false) }
  }

  function openForgotPassword() {
    setMode('forgot')
    setError('')
    setNotice('')
    setDevelopmentCode('')
  }

  function backToLogin() {
    setMode('login')
    setError('')
    setNotice('')
    setDevelopmentCode('')
  }

  const heading = mode === 'login' ? 'BIENVENIDO' : mode === 'forgot' ? 'RECUPERAR ACCESO' : 'NUEVA CONTRASEÑA'
  const description = mode === 'login'
    ? 'Ingresa a tu cuenta de GallerApp'
    : mode === 'forgot'
      ? 'Escribe el correo asociado a tu cuenta y generaremos un código.'
      : 'Ingresa el código y elige una contraseña nueva.'

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex flex-col">
      <header className="border-b border-[#D71920]/20 px-6 h-16 flex items-center">
        <button onClick={onBack} className="flex items-center gap-3 group">
          <RoosterLogo size={32} />
          <span className="font-heading font-black text-lg tracking-wider text-[#F5F5F5] group-hover:text-[#D71920] transition-colors">GALLER<span className="text-[#D71920] group-hover:text-[#F5F5F5]">APP</span></span>
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-[#171717] border border-[#2A2A2A] rounded-2xl p-8 shadow-2xl shadow-black/60">
            <div className="mb-8 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#D71920]/10 border border-[#D71920]/20 mb-5"><RoosterLogo size={30} /></div>
              <h1 className="font-heading font-black text-2xl tracking-wider text-[#F5F5F5] mb-1">{heading}</h1>
              <p className="text-sm text-[#A3A3A3]">{description}</p>
            </div>

            {mode === 'login' && <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <label className={labelClass}>CORREO ELECTRÓNICO
                <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="tucorreo@ejemplo.com" required autoComplete="email" className={`${inputClass} mt-1.5`} />
              </label>
              <label className={labelClass}>CONTRASEÑA
                <span className="relative mt-1.5 block">
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••" required autoComplete="current-password" className={`${inputClass} pr-20`} />
                  <button type="button" onClick={() => setShowPass(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-heading font-bold tracking-wider text-[#777] hover:text-white">{showPass ? 'OCULTAR' : 'VER'}</button>
                </span>
              </label>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" className="w-3.5 h-3.5 accent-[#D71920] cursor-pointer" /><span className="text-xs text-[#A3A3A3] group-hover:text-white">Recordarme</span></label>
                <button type="button" onClick={openForgotPassword} className="text-xs text-[#D71920] hover:text-white transition-colors font-heading font-semibold">¿Olvidaste tu contraseña?</button>
              </div>
              {notice && <p role="status" className="rounded-xl border border-[#176B45]/40 bg-[#176B45]/10 px-4 py-3 text-sm text-[#72D1A4]">{notice}</p>}
              {error && <p role="alert" className="rounded-xl border border-[#D71920]/40 bg-[#D71920]/10 px-4 py-3 text-sm text-[#F5A0A3]">{error}</p>}
              <button type="submit" disabled={loading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#D71920] py-3.5 font-heading text-sm font-black tracking-widest text-white shadow-lg shadow-[#D71920]/20 transition-all hover:bg-[#A01218] disabled:opacity-60">
                {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> INGRESANDO...</> : 'ENTRAR'}
              </button>
            </form>}

            {mode === 'forgot' && <form onSubmit={handleForgot} className="flex flex-col gap-4">
              <label className={labelClass}>CORREO ELECTRÓNICO
                <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="tucorreo@ejemplo.com" required autoComplete="email" className={`${inputClass} mt-1.5`} />
              </label>
              <p className="rounded-lg border border-[#D99024]/30 bg-[#D99024]/10 p-3 text-xs leading-5 text-[#D0B27A]">Este servidor de prueba no tiene correo saliente configurado. Si la cuenta existe, el código temporal se mostrará aquí.</p>
              {error && <p role="alert" className="rounded-xl border border-[#D71920]/40 bg-[#D71920]/10 px-4 py-3 text-sm text-[#F5A0A3]">{error}</p>}
              <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#D71920] py-3.5 font-heading text-sm font-black tracking-widest text-white hover:bg-[#A01218] disabled:opacity-60">{loading ? 'GENERANDO CÓDIGO…' : 'GENERAR CÓDIGO'}</button>
              <button type="button" onClick={backToLogin} className="text-xs font-heading font-semibold text-[#A3A3A3] hover:text-white">← Volver a iniciar sesión</button>
            </form>}

            {mode === 'reset' && <form onSubmit={handleReset} className="flex flex-col gap-4">
              {notice && <p role="status" className="rounded-xl border border-[#176B45]/40 bg-[#176B45]/10 px-4 py-3 text-sm text-[#72D1A4]">{notice}</p>}
              {developmentCode && <div className="rounded-xl border border-[#D99024]/40 bg-[#D99024]/10 p-4"><p className="text-[10px] font-black tracking-widest text-[#D99024]">CÓDIGO DE PRUEBA · VENCE EN 15 MINUTOS</p><p className="mt-2 select-all font-mono text-2xl font-black tracking-[0.3em] text-white">{developmentCode}</p></div>}
              <label className={labelClass}>CORREO ELECTRÓNICO
                <input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" className={`${inputClass} mt-1.5`} />
              </label>
              <label className={labelClass}>CÓDIGO DE RECUPERACIÓN
                <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={resetCode} onChange={event => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" required autoComplete="one-time-code" className={`${inputClass} mt-1.5 font-mono tracking-[0.3em]`} />
              </label>
              <label className={labelClass}>NUEVA CONTRASEÑA
                <input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={8} required autoComplete="new-password" className={`${inputClass} mt-1.5`} />
              </label>
              <label className={labelClass}>CONFIRMAR CONTRASEÑA
                <input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={8} required autoComplete="new-password" className={`${inputClass} mt-1.5`} />
              </label>
              {error && <p role="alert" className="rounded-xl border border-[#D71920]/40 bg-[#D71920]/10 px-4 py-3 text-sm text-[#F5A0A3]">{error}</p>}
              <button type="submit" disabled={loading || resetCode.length !== 6} className="w-full rounded-xl bg-[#D71920] py-3.5 font-heading text-sm font-black tracking-widest text-white hover:bg-[#A01218] disabled:opacity-60">{loading ? 'ACTUALIZANDO…' : 'CAMBIAR CONTRASEÑA'}</button>
              <button type="button" onClick={openForgotPassword} className="text-xs font-heading font-semibold text-[#A3A3A3] hover:text-white">Solicitar otro código</button>
              <button type="button" onClick={backToLogin} className="text-xs font-heading font-semibold text-[#A3A3A3] hover:text-white">← Volver a iniciar sesión</button>
            </form>}

            {mode === 'login' && <>
              <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-[#2A2A2A]" /><span className="text-[10px] font-heading tracking-widest text-[#555]">O CONTINÚA CON</span><div className="h-px flex-1 bg-[#2A2A2A]" /></div>
              <div className="grid grid-cols-2 gap-3">{['Google', 'Facebook'].map(provider => <button key={provider} type="button" className="flex items-center justify-center gap-2 rounded-xl border border-[#2A2A2A] bg-[#0F0F0F] py-2.5 text-xs font-heading font-bold text-[#A3A3A3] transition-all hover:border-[#444] hover:text-white">{provider}</button>)}</div>
              <p className="mt-6 text-center text-sm text-[#A3A3A3]">¿No tienes cuenta? <button onClick={onGoRegister} className="font-heading font-bold text-[#D71920] transition-colors hover:text-white">REGÍSTRATE</button></p>
            </>}
          </div>
          <button onClick={onBack} className="mt-5 w-full text-center text-xs font-heading tracking-wider text-[#555] transition-colors hover:text-[#A3A3A3]">← VOLVER A GALLERAPP</button>
        </div>
      </div>
    </div>
  )
}
