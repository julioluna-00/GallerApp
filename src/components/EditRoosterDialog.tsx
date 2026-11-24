import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { apiRequest } from '../lib/api'

type RoosterProfile = {
  id: string
  name: string
  code: string
  breed: string
  weight: string
  age: string
  arena: string
  owner: string
  image: string
}

const fields = [
  { key: 'name', label: 'Nombre' },
  { key: 'code', label: 'Anillo o placa' },
  { key: 'breed', label: 'Raza' },
  { key: 'arena', label: 'Gallera' },
  { key: 'weight', label: 'Peso (kg)', min: 0.01, step: 0.01 },
  { key: 'age', label: 'Edad (meses)', min: 1, step: 1 },
  { key: 'owner', label: 'Propietario' },
] as const

const inputClass = 'block w-full rounded-lg border border-[#444] bg-[#101010] px-3 py-2 text-sm text-white focus:border-[#D99024] focus:outline-none'

export function EditRoosterDialog({ rooster, onClose, onSaved }: { rooster: RoosterProfile; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const initialForm = {
    name: rooster.name,
    code: rooster.code,
    breed: rooster.breed,
    arena: rooster.arena,
    weight: String(Number.parseFloat(rooster.weight)),
    age: String(Number.parseInt(rooster.age, 10)),
    owner: rooster.owner ?? '',
  }
  const [form, setForm] = useState(initialForm)
  const [photo, setPhoto] = useState<string>()
  const [readingPhoto, setReadingPhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const disabled = saving || readingPhoto
  const changedFields = fields.filter(({ key }) => form[key] !== initialForm[key])
  const hasChanges = changedFields.length > 0 || photo !== undefined

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    setPhoto(undefined)
    setError('')
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1_500_000) {
      input.value = ''
      setError('La foto debe ser JPG, PNG o WEBP y pesar máximo 1.5 MB.')
      return
    }
    const reader = new FileReader()
    setReadingPhoto(true)
    reader.onload = () => setPhoto(String(reader.result))
    reader.onerror = () => {
      input.value = ''
      setError('No se pudo leer la foto.')
    }
    reader.onloadend = () => setReadingPhoto(false)
    reader.readAsDataURL(file)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled || !hasChanges) return
    setSaving(true)
    setError('')
    try {
      const changes = Object.fromEntries(changedFields.map(({ key }) => [key, form[key]]))
      await apiRequest(`/admin/roosters/${rooster.id}`, { ...changes, image: photo }, 'PUT')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la ficha.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="rooster-edit-title" onClose={onClose} onCancel={event => { if (disabled) event.preventDefault() }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-[#444] bg-[#171717] p-5 text-white backdrop:bg-black/75 sm:p-6">
      <h2 id="rooster-edit-title" className="mb-4 font-heading text-xl font-black">Editar ficha de {rooster.name}</h2>
      <form onSubmit={save}>
        <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2">
          {fields.map(field => (
            <label key={field.key} className="grid gap-1.5 text-sm text-[#D0D0D0]">
              {field.label}
              <input
                className={inputClass}
                value={form[field.key]}
                required
                {...('min' in field ? { type: 'number', min: field.min, step: field.step } : { type: 'text' })}
                onChange={event => setForm(current => ({ ...current, [field.key]: event.target.value }))}
              />
            </label>
          ))}
          <div className="flex items-center gap-3 sm:col-span-2">
            {(photo || rooster.image) && <img src={photo || rooster.image} alt="Foto del gallo" className="size-16 shrink-0 rounded-lg object-cover" />}
            <label className="grid min-w-0 flex-1 gap-1.5 text-sm text-[#D0D0D0]">
              Cambiar foto
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} className={inputClass} />
            </label>
          </div>
        </fieldset>
        {error && <p role="alert" className="mt-3 text-sm text-[#F5A0A3]">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" disabled={disabled} onClick={() => dialog.current?.close()} className="rounded-lg border border-[#555] px-4 py-2 text-sm disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={disabled || !hasChanges} className="rounded-lg bg-[#D71920] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form>
    </dialog>
  )
}
