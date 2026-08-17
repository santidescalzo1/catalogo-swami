'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type EstadoArchivo = 'pendiente' | 'subiendo' | 'ok' | 'error'

interface ItemSubida {
  archivo: File;
  codigo: string;
  estado: EstadoArchivo;
  error?: string;
}

// El nombre del archivo (sin extensión) tiene que ser el código del
// artículo — misma convención que ya usa el bucket ({codigo}.jpg).
const codigoDesdeNombre = (nombreArchivo: string) => nombreArchivo.replace(/\.[^/.]+$/, '').trim()

export default function SubirFotos() {
  const router = useRouter()
  const [items, setItems] = useState<ItemSubida[]>([])
  const [subiendo, setSubiendo] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  const handleArchivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files ?? [])
    setItems(archivos.map(archivo => ({
      archivo,
      codigo: codigoDesdeNombre(archivo.name),
      estado: 'pendiente',
    })))
  }

  const subirTodo = async () => {
    setSubiendo(true)

    for (let i = 0; i < items.length; i++) {
      setItems(prev => prev.map((it, idx) => idx === i ? { ...it, estado: 'subiendo' } : it))

      const formData = new FormData()
      formData.append('archivo', items[i].archivo)
      formData.append('codigo', items[i].codigo)

      try {
        const res = await fetch('/api/admin/subir-foto', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error desconocido')
        setItems(prev => prev.map((it, idx) => idx === i ? { ...it, estado: 'ok' } : it))
      } catch (error) {
        const err = error as { message?: string }
        setItems(prev => prev.map((it, idx) => idx === i ? { ...it, estado: 'error', error: err.message } : it))
      }
    }

    setSubiendo(false)
  }

  const pendientes = items.filter(it => it.estado === 'pendiente').length
  const exitosos = items.filter(it => it.estado === 'ok').length
  const errores = items.filter(it => it.estado === 'error').length

  return (
    <main className="min-h-screen bg-black text-zinc-300 font-sans p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-light tracking-tight text-white">Swami Autopartes</h1>
            <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Subir fotos de artículos</p>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-xs text-zinc-500 hover:text-orange-500 uppercase tracking-widest transition-colors">
              ← Sincronización masiva
            </Link>
            <Link href="/admin/articulos" className="text-xs text-zinc-500 hover:text-orange-500 uppercase tracking-widest transition-colors">
              Editar artículos
            </Link>
            <Link href="/" className="text-xs text-zinc-500 hover:text-orange-500 uppercase tracking-widest transition-colors">
              Ver catálogo
            </Link>
            <button onClick={handleLogout} className="text-xs text-zinc-600 hover:text-orange-500 uppercase tracking-widest transition-colors">
              Cerrar sesión
            </button>
          </div>
        </div>

        <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
          Elegí una o varias fotos. El nombre de cada archivo (sin la extensión) tiene que ser el código del artículo — por ejemplo <span className="text-zinc-400 font-mono">10016.jpg</span> para el artículo 10016. Si ya existe una foto con ese código, se reemplaza.
        </p>

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleArchivos}
          disabled={subiendo}
          className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-medium file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700 file:cursor-pointer cursor-pointer mb-6 disabled:opacity-50"
        />

        {items.length > 0 && (
          <>
            <button
              onClick={subirTodo}
              disabled={subiendo || pendientes === 0}
              className="w-full bg-white hover:bg-orange-500 text-black py-3 text-xs uppercase tracking-widest font-medium transition-colors disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed mb-6"
            >
              {subiendo ? `Subiendo... (${exitosos + errores}/${items.length})` : `Subir ${items.length} foto${items.length === 1 ? '' : 's'}`}
            </button>

            <div className="border border-zinc-900 divide-y divide-zinc-900">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="flex flex-col">
                    <span className="text-zinc-300 font-mono text-xs">{it.codigo || '(sin código)'}</span>
                    <span className="text-zinc-600 text-[11px]">{it.archivo.name}</span>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest ${
                    it.estado === 'ok' ? 'text-orange-400' :
                    it.estado === 'error' ? 'text-red-500' :
                    it.estado === 'subiendo' ? 'text-zinc-400 animate-pulse' :
                    'text-zinc-600'
                  }`}>
                    {it.estado === 'ok' ? 'Subida' :
                     it.estado === 'error' ? (it.error || 'Error') :
                     it.estado === 'subiendo' ? 'Subiendo...' :
                     'Pendiente'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
