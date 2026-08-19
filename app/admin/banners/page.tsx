'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

const BANNERS_STORAGE_URL = 'https://rhdxfpkrxeuymihhkyxo.supabase.co/storage/v1/object/public/banners'

interface Banner {
  id: number;
  titulo: string;
  texto: string | null;
  imagen_path: string;
  link_url: string | null;
  activo: boolean;
  orden: number;
}

// Borrador vacío para "nuevo banner". id null distingue alta de edición.
const bannerVacio = (): Omit<Banner, 'id'> & { id: null } => ({
  id: null,
  titulo: '',
  texto: '',
  imagen_path: '',
  link_url: '',
  activo: true,
  orden: 0,
})

export default function AdminBanners() {
  const router = useRouter()
  const [banners, setBanners] = useState<Banner[]>([])
  const [cargando, setCargando] = useState(true)
  const [formulario, setFormulario] = useState<Banner | (Omit<Banner, 'id'> & { id: null }) | null>(null)
  const [archivoImagen, setArchivoImagen] = useState<File | null>(null)
  const [previewImagen, setPreviewImagen] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const cargarBanners = async () => {
    setCargando(true)
    const { data } = await supabase.from('banners').select('*').order('orden').order('id')
    setBanners(data ?? [])
    setCargando(false)
  }

  useEffect(() => {
    cargarBanners()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const abrirNuevo = () => {
    setFormulario(bannerVacio())
    setArchivoImagen(null)
    setPreviewImagen(null)
    setMensaje(null)
  }

  const abrirEdicion = (banner: Banner) => {
    setFormulario(banner)
    setArchivoImagen(null)
    setPreviewImagen(null)
    setMensaje(null)
  }

  const cerrarFormulario = () => {
    setFormulario(null)
    setArchivoImagen(null)
    setPreviewImagen(null)
    setMensaje(null)
  }

  const handleArchivoImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setArchivoImagen(f)
    setPreviewImagen(URL.createObjectURL(f))
  }

  const toggleActivo = async (banner: Banner) => {
    const { error } = await supabase.from('banners').update({ activo: !banner.activo }).eq('id', banner.id)
    if (!error) {
      setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, activo: !b.activo } : b))
    }
  }

  const eliminarBanner = async (banner: Banner) => {
    if (!window.confirm(`¿Eliminar el banner "${banner.titulo}"? No se puede deshacer.`)) return
    const { error } = await supabase.from('banners').delete().eq('id', banner.id)
    if (!error) {
      setBanners(prev => prev.filter(b => b.id !== banner.id))
    }
  }

  const guardarBanner = async () => {
    if (!formulario) return
    setGuardando(true)
    setMensaje(null)

    try {
      let imagenPath = formulario.imagen_path

      if (archivoImagen) {
        const formData = new FormData()
        formData.append('archivo', archivoImagen)
        const res = await fetch('/api/admin/subir-banner', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'No se pudo subir la imagen.')
        imagenPath = data.path
      }

      if (!imagenPath) throw new Error('Elegí una imagen para el banner.')

      const payload = {
        titulo: formulario.titulo.trim(),
        texto: formulario.texto?.trim() || null,
        imagen_path: imagenPath,
        link_url: formulario.link_url?.trim() || null,
        activo: formulario.activo,
        orden: formulario.orden,
      }

      if (formulario.id === null) {
        const { error } = await supabase.from('banners').insert(payload)
        if (error) throw error
      } else {
        const { error } = await supabase.from('banners').update(payload).eq('id', formulario.id)
        if (error) throw error
      }

      setMensaje({ tipo: 'ok', texto: 'Guardado correctamente.' })
      await cargarBanners()
      setTimeout(() => cerrarFormulario(), 600)
    } catch (error) {
      const err = error as { message?: string }
      setMensaje({ tipo: 'error', texto: err.message || 'No se pudo guardar. Intentá de nuevo.' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <main className="min-h-screen bg-black text-zinc-300 font-sans p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-light tracking-tight text-white">Swami Autopartes</h1>
            <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Banner de ofertas</p>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-xs text-zinc-500 hover:text-orange-500 uppercase tracking-widest transition-colors">
              ← Sincronización masiva
            </Link>
            <Link href="/admin/articulos" className="text-xs text-zinc-500 hover:text-orange-500 uppercase tracking-widest transition-colors">
              Editar artículos
            </Link>
            <Link href="/admin/fotos" className="text-xs text-zinc-500 hover:text-orange-500 uppercase tracking-widest transition-colors">
              Subir fotos
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
          Los banners activos aparecen como popup al entrar al catálogo (una vez por visita) y después quedan como carrusel fijo arriba. El orden determina en qué posición aparecen.
        </p>

        <button
          onClick={abrirNuevo}
          className="w-full bg-white hover:bg-orange-500 text-black py-3 text-xs uppercase tracking-widest font-medium transition-colors mb-6"
        >
          + Nuevo banner
        </button>

        {cargando ? (
          <div className="text-center py-16 text-xs text-orange-500/70 uppercase tracking-[0.2em] animate-pulse">Cargando...</div>
        ) : banners.length === 0 ? (
          <div className="text-center py-16 text-zinc-600 font-light">Todavía no hay banners cargados.</div>
        ) : (
          <div className="border border-zinc-900 divide-y divide-zinc-900">
            {banners.map(banner => (
              <div key={banner.id} className="flex items-center gap-4 px-4 py-3">
                <div className="relative w-16 h-16 bg-zinc-950 border border-zinc-900 shrink-0 overflow-hidden">
                  <Image
                    src={`${BANNERS_STORAGE_URL}/${banner.imagen_path}`}
                    alt={banner.titulo}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{banner.titulo}</p>
                  <p className="text-[11px] text-zinc-600 truncate">{banner.texto}</p>
                </div>
                <span className="text-[10px] font-mono text-zinc-600 shrink-0">#{banner.orden}</span>
                <button
                  onClick={() => toggleActivo(banner)}
                  className={`text-[9px] uppercase tracking-[0.2em] font-medium px-3 py-2 border transition-all shrink-0 ${
                    banner.activo
                      ? 'text-orange-400 border-orange-500/40 bg-orange-500/10'
                      : 'text-zinc-600 border-zinc-800 bg-zinc-900'
                  }`}
                >
                  {banner.activo ? 'Activo' : 'Inactivo'}
                </button>
                <button
                  onClick={() => abrirEdicion(banner)}
                  className="text-[9px] uppercase tracking-[0.2em] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-3 py-2 transition-all shrink-0"
                >
                  Editar
                </button>
                <button
                  onClick={() => eliminarBanner(banner)}
                  className="text-[9px] uppercase tracking-[0.2em] font-medium text-red-500/80 bg-zinc-900 border border-zinc-800 hover:bg-red-500/10 hover:border-red-500/40 px-3 py-2 transition-all shrink-0"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE ALTA/EDICIÓN */}
      {formulario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={cerrarFormulario} />
          <div className="relative bg-zinc-950 border border-zinc-800 w-full max-w-lg max-h-[90vh] overflow-y-auto p-8">
            <button onClick={cerrarFormulario} className="absolute top-4 right-4 text-zinc-500 hover:text-orange-500 transition-colors p-2">
              ✕
            </button>

            <h2 className="text-lg font-light text-white mb-6">
              {formulario.id === null ? 'Nuevo banner' : 'Editar banner'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Imagen</label>
                <div className="flex items-center gap-4">
                  <div className="relative w-24 h-24 bg-black border border-zinc-900 shrink-0 overflow-hidden flex items-center justify-center">
                    {(previewImagen || formulario.imagen_path) ? (
                      <Image
                        key={previewImagen ?? formulario.imagen_path}
                        src={previewImagen ?? `${BANNERS_STORAGE_URL}/${formulario.imagen_path}`}
                        alt="Preview"
                        fill
                        sizes="96px"
                        className="object-cover"
                        unoptimized={!!previewImagen}
                      />
                    ) : (
                      <span className="text-[9px] text-zinc-700 text-center px-2">Sin imagen</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleArchivoImagen}
                    className="block flex-1 text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-sm file:border-0 file:text-xs file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700 file:cursor-pointer cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Título</label>
                <input
                  type="text"
                  value={formulario.titulo}
                  onChange={(e) => setFormulario({ ...formulario, titulo: e.target.value })}
                  placeholder="Ej: Descuentos en radiadores"
                  className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50 placeholder:text-zinc-700"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Texto (opcional)</label>
                <textarea
                  value={formulario.texto ?? ''}
                  onChange={(e) => setFormulario({ ...formulario, texto: e.target.value })}
                  rows={2}
                  placeholder="Detalle breve de la oferta."
                  className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50 resize-none placeholder:text-zinc-700"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Link (opcional)</label>
                <input
                  type="text"
                  value={formulario.link_url ?? ''}
                  onChange={(e) => setFormulario({ ...formulario, link_url: e.target.value })}
                  placeholder="https://wa.me/... o /radiacor"
                  className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50 placeholder:text-zinc-700"
                />
              </div>

              <div className="flex items-end gap-6">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Orden</label>
                  <input
                    type="number"
                    value={formulario.orden}
                    onChange={(e) => setFormulario({ ...formulario, orden: Number(e.target.value) })}
                    className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <label className="flex items-center gap-2 pb-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formulario.activo}
                    onChange={(e) => setFormulario({ ...formulario, activo: e.target.checked })}
                    className="w-4 h-4 accent-orange-500 cursor-pointer"
                  />
                  <span className="text-[10px] uppercase tracking-widest text-zinc-400">Activo</span>
                </label>
              </div>
            </div>

            {mensaje && (
              <p className={`mt-4 text-sm ${mensaje.tipo === 'ok' ? 'text-orange-400' : 'text-red-500'}`}>{mensaje.texto}</p>
            )}

            <div className="flex gap-4 mt-6">
              <button
                onClick={cerrarFormulario}
                className="flex-1 border border-zinc-800 text-zinc-400 py-3 text-xs uppercase tracking-widest hover:border-zinc-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardarBanner}
                disabled={guardando || !formulario.titulo.trim()}
                className="flex-1 bg-white hover:bg-orange-500 text-black py-3 text-xs uppercase tracking-widest font-medium transition-colors disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
