'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { aplicarBusquedaTexto } from '@/lib/busquedaTexto'

const SUPABASE_STORAGE_URL = 'https://rhdxfpkrxeuymihhkyxo.supabase.co/storage/v1/object/public/repuestos'

interface Articulo {
  id: number;
  codigo: string;
  descripcion: string;
  descripcion_estandarizada: string | null;
  codigo_proveedor: string | null;
  id_marca: number;
  id_rubro: number;
  id_proveedor: number;
  precio_1: number;
  oferta: boolean;
}

interface Categoria {
  id: number;
  descripcion: string;
}

interface Rubro extends Categoria {
  id_categoria_general: number | null;
}

interface ModeloAuto extends Categoria {
  id_marca_auto: number;
}

export default function EditarArticulos() {
  const router = useRouter()

  // Filtros de busqueda: mismo motor que el catalogo publico (Codigo /
  // Descripcion separados, Marca Producto, Rubro -> Subrubro, Marca Auto ->
  // Modelo) mas Proveedor, que solo existe aca — en el panel admin no hace
  // falta ocultarlo como en el catalogo publico.
  const [busquedaCodigo, setBusquedaCodigo] = useState('')
  const [busquedaDescripcion, setBusquedaDescripcion] = useState('')
  const [marcaFiltro, setMarcaFiltro] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [rubroFiltro, setRubroFiltro] = useState('')
  const [vehiculoFiltro, setVehiculoFiltro] = useState('')
  const [modeloAutoFiltro, setModeloAutoFiltro] = useState('')
  const [proveedorFiltro, setProveedorFiltro] = useState('')

  const [resultados, setResultados] = useState<Articulo[]>([])
  const [cargando, setCargando] = useState(false)
  const [paginaActual, setPaginaActual] = useState(1)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const porPagina = 50
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [marcas, setMarcas] = useState<Categoria[]>([])
  const [rubros, setRubros] = useState<Rubro[]>([])
  const rubrosRef = useRef<Rubro[]>([])
  const [categoriasGenerales, setCategoriasGenerales] = useState<Categoria[]>([])
  const [marcasAuto, setMarcasAuto] = useState<Categoria[]>([])
  const [modelosAuto, setModelosAuto] = useState<ModeloAuto[]>([])
  const [proveedores, setProveedores] = useState<Categoria[]>([])

  const [articuloEditando, setArticuloEditando] = useState<Articulo | null>(null)
  const [categoriaEdicion, setCategoriaEdicion] = useState('')
  const [archivoImagen, setArchivoImagen] = useState<File | null>(null)
  const [previewImagen, setPreviewImagen] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  // La descripcion original (la del Excel de facturacion) arranca bloqueada
  // en cada edicion: hace falta un click + confirmar para poder tocarla,
  // asi nadie la edita "sin querer" en vez de la Estandarizada.
  const [editandoOriginal, setEditandoOriginal] = useState(false)

  useEffect(() => {
    const cargarFiltros = async () => {
      const { data: dataMarcas } = await supabase.from('marcas').select('*').order('descripcion')
      const { data: dataRubros } = await supabase.from('rubros').select('*').order('descripcion')
      const { data: dataCategorias } = await supabase.from('categorias_generales').select('*').order('descripcion')
      const { data: dataMarcasAuto } = await supabase.from('marcas_auto_con_datos').select('*').order('descripcion')
      const { data: dataModelosAuto } = await supabase.from('modelos_auto_con_datos').select('*').order('descripcion')
      const { data: dataProveedores } = await supabase.from('proveedores').select('id, descripcion').neq('id', 0).order('descripcion')

      if (dataMarcas) setMarcas(dataMarcas)
      if (dataRubros) {
        setRubros(dataRubros)
        rubrosRef.current = dataRubros
      }
      if (dataCategorias) setCategoriasGenerales(dataCategorias)
      if (dataMarcasAuto) setMarcasAuto(dataMarcasAuto)
      if (dataModelosAuto) setModelosAuto(dataModelosAuto)
      if (dataProveedores) setProveedores(dataProveedores)
    }
    cargarFiltros()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const buscar = useCallback(async (
    terminoCodigo: string,
    terminoDescripcion: string,
    idMarca: string,
    idCategoria: string,
    idRubro: string,
    idVehiculo: string,
    idModeloAuto: string,
    idProveedor: string,
    pagina: number
  ) => {
    setCargando(true)

    // El join a articulos_modelos_auto solo hace falta (y solo se pide con
    // !inner, para no traer artículos sin ningún vehículo asociado) cuando
    // hay un filtro de marca/modelo de auto activo.
    const necesitaVehiculo = !!(idVehiculo || idModeloAuto)
    const seleccionVehiculo = necesitaVehiculo
      ? ', articulos_modelos_auto!inner(modelos_auto!inner(id_marca_auto))'
      : ''

    let query = supabase
      .from('articulos')
      .select(`id, codigo, descripcion, descripcion_estandarizada, codigo_proveedor, id_marca, id_rubro, id_proveedor, precio_1, oferta${seleccionVehiculo}`, { count: 'exact' })

    query = aplicarBusquedaTexto(query, terminoCodigo, ['codigo', 'codigo_proveedor'], false)
    query = aplicarBusquedaTexto(query, terminoDescripcion, ['descripcion', 'descripcion_estandarizada'], true)

    if (idMarca) query = query.eq('id_marca', idMarca)

    if (idRubro) {
      query = query.eq('id_rubro', idRubro)
    } else if (idCategoria) {
      const idsEnCategoria = rubrosRef.current
        .filter(r => String(r.id_categoria_general) === idCategoria)
        .map(r => r.id)
      query = query.in('id_rubro', idsEnCategoria.length > 0 ? idsEnCategoria : [-1])
    }

    if (idModeloAuto) {
      query = query.eq('articulos_modelos_auto.id_modelo_auto', idModeloAuto)
    } else if (idVehiculo) {
      query = query.eq('articulos_modelos_auto.modelos_auto.id_marca_auto', idVehiculo)
    }

    if (idProveedor) query = query.eq('id_proveedor', idProveedor)

    const desde = (pagina - 1) * porPagina
    const hasta = desde + porPagina - 1

    const { data, count } = await query.order('codigo').range(desde, hasta)
    setResultados((data ?? []) as unknown as Articulo[])
    setTotalRegistros(count ?? 0)
    setCargando(false)
  }, [])

  useEffect(() => {
    // Carga inicial del listado completo: tiene que pasar por un efecto
    // (no puede resolverse durante el render), y no hay ningún await previo
    // que lo corra fuera del cuerpo síncrono del efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    buscar('', '', '', '', '', '', '', '', 1)
  }, [buscar])

  const handleBusquedaCodigo = (val: string) => {
    setBusquedaCodigo(val)
    setPaginaActual(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (val.length >= 2 || val.length === 0) {
        buscar(val, busquedaDescripcion, marcaFiltro, categoriaFiltro, rubroFiltro, vehiculoFiltro, modeloAutoFiltro, proveedorFiltro, 1)
      }
    }, 400)
  }

  const handleBusquedaDescripcion = (val: string) => {
    setBusquedaDescripcion(val)
    setPaginaActual(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (val.length >= 2 || val.length === 0) {
        buscar(busquedaCodigo, val, marcaFiltro, categoriaFiltro, rubroFiltro, vehiculoFiltro, modeloAutoFiltro, proveedorFiltro, 1)
      }
    }, 400)
  }

  const handleMarca = (val: string) => {
    setMarcaFiltro(val)
    setPaginaActual(1)
    buscar(busquedaCodigo, busquedaDescripcion, val, categoriaFiltro, rubroFiltro, vehiculoFiltro, modeloAutoFiltro, proveedorFiltro, 1)
  }

  const handleCategoria = (val: string) => {
    setCategoriaFiltro(val)
    setRubroFiltro('')
    setPaginaActual(1)
    buscar(busquedaCodigo, busquedaDescripcion, marcaFiltro, val, '', vehiculoFiltro, modeloAutoFiltro, proveedorFiltro, 1)
  }

  const handleRubro = (val: string) => {
    setRubroFiltro(val)
    setPaginaActual(1)
    buscar(busquedaCodigo, busquedaDescripcion, marcaFiltro, categoriaFiltro, val, vehiculoFiltro, modeloAutoFiltro, proveedorFiltro, 1)
  }

  const handleVehiculo = (val: string) => {
    setVehiculoFiltro(val)
    setModeloAutoFiltro('')
    setPaginaActual(1)
    buscar(busquedaCodigo, busquedaDescripcion, marcaFiltro, categoriaFiltro, rubroFiltro, val, '', proveedorFiltro, 1)
  }

  const handleModeloAuto = (val: string) => {
    setModeloAutoFiltro(val)
    setPaginaActual(1)
    buscar(busquedaCodigo, busquedaDescripcion, marcaFiltro, categoriaFiltro, rubroFiltro, vehiculoFiltro, val, proveedorFiltro, 1)
  }

  const handleProveedor = (val: string) => {
    setProveedorFiltro(val)
    setPaginaActual(1)
    buscar(busquedaCodigo, busquedaDescripcion, marcaFiltro, categoriaFiltro, rubroFiltro, vehiculoFiltro, modeloAutoFiltro, val, 1)
  }

  const limpiarFiltros = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setBusquedaCodigo('')
    setBusquedaDescripcion('')
    setMarcaFiltro('')
    setCategoriaFiltro('')
    setRubroFiltro('')
    setVehiculoFiltro('')
    setModeloAutoFiltro('')
    setProveedorFiltro('')
    setPaginaActual(1)
    buscar('', '', '', '', '', '', '', '', 1)
  }

  const hayFiltrosActivos = busquedaCodigo !== '' || busquedaDescripcion !== '' || marcaFiltro !== '' || categoriaFiltro !== '' || rubroFiltro !== '' || vehiculoFiltro !== '' || modeloAutoFiltro !== '' || proveedorFiltro !== ''

  const cambiarPagina = (nuevaPagina: number) => {
    setPaginaActual(nuevaPagina)
    buscar(busquedaCodigo, busquedaDescripcion, marcaFiltro, categoriaFiltro, rubroFiltro, vehiculoFiltro, modeloAutoFiltro, proveedorFiltro, nuevaPagina)
  }

  const abrirEdicion = (item: Articulo) => {
    // un puñado de articulos historicos tienen id_marca/id_rubro en null
    // en vez del 0 ("Sin Marca"/"Sin Rubro") que usa el resto de la app.
    setArticuloEditando({ ...item, id_marca: item.id_marca ?? 0, id_rubro: item.id_rubro ?? 0, oferta: item.oferta ?? false })
    const rubroActual = rubros.find(r => r.id === item.id_rubro)
    setCategoriaEdicion(rubroActual ? String(rubroActual.id_categoria_general ?? '') : '')
    setArchivoImagen(null)
    setPreviewImagen(null)
    setMensaje(null)
    setEditandoOriginal(false)
  }

  const cerrarEdicion = () => {
    setArticuloEditando(null)
    setArchivoImagen(null)
    setPreviewImagen(null)
    setMensaje(null)
    setEditandoOriginal(false)
  }

  const pedirEdicionOriginal = () => {
    const confirmado = window.confirm(
      'Esta es la descripción que trae el Excel del sistema de facturación, no la que ve el cliente en el catálogo.\n\n' +
      'Normalmente alcanza con editar la Descripción Estandarizada de arriba. Si volvés a importar precios, esta descripción se pisa igual.\n\n' +
      '¿Seguro que querés editarla de todas formas?'
    )
    if (confirmado) setEditandoOriginal(true)
  }

  const handleArchivoImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setArchivoImagen(f)
    setPreviewImagen(URL.createObjectURL(f))
  }

  const guardarEdicion = async () => {
    if (!articuloEditando) return
    setGuardando(true)
    setMensaje(null)

    try {
      const codigoOriginal = resultados.find(r => r.id === articuloEditando.id)?.codigo ?? articuloEditando.codigo
      const codigoNuevo = articuloEditando.codigo.trim()

      if (archivoImagen) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('No hay sesión activa. Volvé a loguearte e intentá de nuevo.')

        const { error: errorSubida } = await supabase.storage
          .from('repuestos')
          .upload(`${codigoNuevo}.jpg`, archivoImagen, {
            upsert: true,
            contentType: archivoImagen.type || 'image/jpeg',
            // Fuerza el token de sesión en vez de confiar en que el cliente
            // de Storage lo agregue solo: descarta de raíz que el 403 de RLS
            // sea por mandar la anon key en vez del JWT del usuario logueado.
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
        if (errorSubida) throw errorSubida
      } else if (codigoNuevo !== codigoOriginal) {
        // Si cambió el código y no se subió una foto nueva, movemos la foto
        // existente para que no quede huérfana. Si no existía, no pasa nada.
        await supabase.storage.from('repuestos').move(`${codigoOriginal}.jpg`, `${codigoNuevo}.jpg`)
      }

      const { error: errorUpdate } = await supabase
        .from('articulos')
        .update({
          codigo: codigoNuevo,
          descripcion: articuloEditando.descripcion.trim(),
          descripcion_estandarizada: articuloEditando.descripcion_estandarizada?.trim() || null,
          codigo_proveedor: articuloEditando.codigo_proveedor?.trim() || null,
          id_marca: articuloEditando.id_marca,
          id_rubro: articuloEditando.id_rubro,
          precio_1: articuloEditando.precio_1,
          oferta: articuloEditando.oferta,
        })
        .eq('id', articuloEditando.id)

      if (errorUpdate) throw errorUpdate

      setResultados(prev => prev.map(r => (r.id === articuloEditando.id ? { ...articuloEditando, codigo: codigoNuevo } : r)))
      setMensaje({ tipo: 'ok', texto: 'Guardado correctamente.' })
      setTimeout(() => cerrarEdicion(), 800)
    } catch (error) {
      const err = error as { message?: string }
      setMensaje({ tipo: 'error', texto: err.message || 'No se pudo guardar. Intentá de nuevo.' })
    } finally {
      setGuardando(false)
    }
  }

  const subrubrosEdicion = rubros
    .filter(r => r.id !== 0)
    .filter(r => !categoriaEdicion || String(r.id_categoria_general) === categoriaEdicion)

  const subrubrosFiltro = rubros
    .filter(r => r.id !== 0)
    .filter(r => !categoriaFiltro || String(r.id_categoria_general) === categoriaFiltro)

  const modelosAutoFiltrados = modelosAuto.filter(m => !vehiculoFiltro || String(m.id_marca_auto) === vehiculoFiltro)

  const totalPaginas = Math.ceil(totalRegistros / porPagina)

  const estiloSelect = "w-full bg-zinc-900/30 border border-zinc-800 rounded-sm px-3 py-2.5 text-[11px] text-zinc-300 focus:outline-none focus:border-orange-500/50 appearance-none cursor-pointer uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"

  return (
    <main className="min-h-screen bg-black text-zinc-300 font-sans p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-light tracking-tight text-white">Swami Autopartes</h1>
            <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Editar artículos individuales</p>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-xs text-zinc-500 hover:text-orange-500 uppercase tracking-widest transition-colors">
              ← Sincronización masiva
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

        <div className="space-y-3 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Código (propio o de proveedor)..."
              value={busquedaCodigo}
              onChange={(e) => handleBusquedaCodigo(e.target.value)}
              className="w-full bg-zinc-900/30 border border-zinc-800 rounded-sm px-5 py-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
            />
            <input
              type="text"
              placeholder="Descripción..."
              value={busquedaDescripcion}
              onChange={(e) => handleBusquedaDescripcion(e.target.value)}
              className="w-full bg-zinc-900/30 border border-zinc-800 rounded-sm px-5 py-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-[9px] uppercase tracking-[0.2em] text-zinc-600 mb-1.5">Marca Producto</label>
              <select value={marcaFiltro} onChange={(e) => handleMarca(e.target.value)} className={estiloSelect}>
                <option value="">Todas</option>
                {marcas.filter(m => m.id !== 0).map(m => (
                  <option key={m.id} value={m.id}>{m.descripcion}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-[0.2em] text-zinc-600 mb-1.5">Rubro</label>
              <select value={categoriaFiltro} onChange={(e) => handleCategoria(e.target.value)} className={estiloSelect}>
                <option value="">Todos</option>
                {categoriasGenerales.map(c => (
                  <option key={c.id} value={c.id}>{c.descripcion}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-[0.2em] text-zinc-600 mb-1.5">Subrubro</label>
              <select value={rubroFiltro} onChange={(e) => handleRubro(e.target.value)} disabled={!categoriaFiltro} className={estiloSelect}>
                <option value="">Todos</option>
                {subrubrosFiltro.map(r => (
                  <option key={r.id} value={r.id}>{r.descripcion}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-[0.2em] text-zinc-600 mb-1.5">Marca Auto</label>
              <select value={vehiculoFiltro} onChange={(e) => handleVehiculo(e.target.value)} className={estiloSelect}>
                <option value="">Todas</option>
                {marcasAuto.map(m => (
                  <option key={m.id} value={m.id}>{m.descripcion}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-[0.2em] text-zinc-600 mb-1.5">Modelo</label>
              <select value={modeloAutoFiltro} onChange={(e) => handleModeloAuto(e.target.value)} disabled={!vehiculoFiltro} className={estiloSelect}>
                <option value="">Todos</option>
                {modelosAutoFiltrados.map(m => (
                  <option key={m.id} value={m.id}>{m.descripcion}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-[0.2em] text-zinc-600 mb-1.5">Proveedor</label>
              <select value={proveedorFiltro} onChange={(e) => handleProveedor(e.target.value)} className={estiloSelect}>
                <option value="">Todos</option>
                {proveedores.map(p => (
                  <option key={p.id} value={p.id}>{p.descripcion}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={limpiarFiltros}
              disabled={!hayFiltrosActivos}
              className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 hover:text-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        {cargando ? (
          <div className="text-center py-16 text-xs text-orange-500/70 uppercase tracking-[0.2em] animate-pulse">Cargando...</div>
        ) : resultados.length === 0 ? (
          <div className="text-center py-16 text-zinc-600 font-light">No se encontraron artículos.</div>
        ) : (
          <div className="overflow-x-auto border border-zinc-900">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                  <th className="text-left font-normal px-4 py-3">Código Original</th>
                  <th className="text-left font-normal px-4 py-3">Código Interno</th>
                  <th className="text-left font-normal px-4 py-3">Descripción</th>
                  <th className="text-right font-normal px-4 py-3">Precio</th>
                  <th className="text-right font-normal px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {resultados.map(item => (
                  <tr key={item.id} className="border-b border-zinc-900 last:border-b-0 hover:bg-zinc-900/50 transition-colors">
                    <td className="px-4 py-3 text-orange-500/80 font-mono text-[11px] whitespace-nowrap">{item.codigo_proveedor || '—'}</td>
                    <td className="px-4 py-3 text-zinc-500 font-mono text-[11px] whitespace-nowrap">{item.codigo}</td>
                    <td className="px-4 py-3 text-zinc-300 font-light">
                      {item.descripcion}
                      {item.descripcion_estandarizada && (
                        <span className="ml-2 text-[9px] uppercase tracking-widest text-orange-500/70">· estandarizada</span>
                      )}
                      {item.oferta && (
                        <span className="ml-2 text-[9px] uppercase tracking-widest text-orange-400">· oferta</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-light whitespace-nowrap">${item.precio_1.toLocaleString('es-AR')}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => abrirEdicion(item)}
                        className="text-[9px] uppercase tracking-[0.2em] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-orange-500 hover:text-black hover:border-orange-500 px-3 py-2 transition-all"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-900">
              <span className="text-[10px] text-zinc-600 uppercase tracking-widest">
                {totalRegistros} artículo{totalRegistros === 1 ? '' : 's'}
              </span>
              {totalPaginas > 1 && (
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => cambiarPagina(paginaActual - 1)}
                    disabled={paginaActual === 1}
                    className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 hover:text-orange-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  >
                    Anterior
                  </button>
                  <span className="text-[10px] font-mono tracking-widest text-zinc-600">
                    {paginaActual} / {totalPaginas}
                  </span>
                  <button
                    onClick={() => cambiarPagina(paginaActual + 1)}
                    disabled={paginaActual === totalPaginas}
                    className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 hover:text-orange-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE EDICIÓN */}
      {articuloEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={cerrarEdicion} />
          <div className="relative bg-zinc-950 border border-zinc-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8">
            <button onClick={cerrarEdicion} className="absolute top-4 right-4 text-zinc-500 hover:text-orange-500 transition-colors p-2">
              ✕
            </button>

            <h2 className="text-lg font-light text-white mb-6">Editar artículo</h2>

            <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-6 mb-6">
              <div className="relative aspect-square w-full bg-black border border-zinc-900 flex items-center justify-center overflow-hidden">
                <Image
                  key={previewImagen ?? articuloEditando.codigo}
                  src={previewImagen ?? `${SUPABASE_STORAGE_URL}/${articuloEditando.codigo}.jpg`}
                  alt={articuloEditando.descripcion}
                  fill
                  sizes="140px"
                  className="object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                  unoptimized={!!previewImagen}
                />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Código</label>
                  <input
                    type="text"
                    value={articuloEditando.codigo}
                    onChange={(e) => setArticuloEditando({ ...articuloEditando, codigo: e.target.value })}
                    className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Reemplazar imagen</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleArchivoImagen}
                    className="block w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-sm file:border-0 file:text-xs file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700 file:cursor-pointer cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* La Estandarizada es la que efectivamente ve el cliente en el
                  catalogo publico: se destaca con borde y fondo naranja
                  suave para que sea la primera que se edite. */}
              <div className="border-l-2 border-orange-500 bg-orange-500/[0.06] pl-4 pr-3 py-3 -mx-px">
                <label className="flex flex-wrap items-baseline gap-x-2 text-[10px] uppercase tracking-widest text-orange-400 mb-2">
                  Descripción estandarizada
                  <span className="normal-case tracking-normal text-orange-300/60 text-[11px]">— esta es la que ve el cliente</span>
                </label>
                <textarea
                  value={articuloEditando.descripcion_estandarizada ?? ''}
                  onChange={(e) => setArticuloEditando({ ...articuloEditando, descripcion_estandarizada: e.target.value })}
                  rows={2}
                  placeholder="Si se completa, esta es la que se muestra en el catálogo público. No se pisa al re-importar el Excel."
                  className="w-full bg-black border border-orange-500/30 rounded-sm px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500 resize-none placeholder:text-zinc-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-600">
                    🔒 Descripción original (sistema de facturación)
                  </label>
                  {!editandoOriginal && (
                    <button
                      type="button"
                      onClick={pedirEdicionOriginal}
                      className="text-[9px] uppercase tracking-widest text-zinc-500 hover:text-orange-500 transition-colors shrink-0"
                    >
                      Editar de todas formas
                    </button>
                  )}
                </div>
                <textarea
                  value={articuloEditando.descripcion}
                  onChange={(e) => setArticuloEditando({ ...articuloEditando, descripcion: e.target.value })}
                  rows={2}
                  disabled={!editandoOriginal}
                  className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2 text-sm text-zinc-500 focus:outline-none focus:border-orange-500/50 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Código proveedor</label>
                <input
                  type="text"
                  value={articuloEditando.codigo_proveedor ?? ''}
                  onChange={(e) => setArticuloEditando({ ...articuloEditando, codigo_proveedor: e.target.value })}
                  className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Marca</label>
                  <select
                    value={articuloEditando.id_marca}
                    onChange={(e) => setArticuloEditando({ ...articuloEditando, id_marca: Number(e.target.value) })}
                    className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-orange-500/50 uppercase"
                  >
                    <option value={0}>Sin marca</option>
                    {marcas.filter(m => m.id !== 0).map(m => (
                      <option key={m.id} value={m.id}>{m.descripcion}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Rubro</label>
                  <select
                    value={categoriaEdicion}
                    onChange={(e) => {
                      setCategoriaEdicion(e.target.value)
                      setArticuloEditando({ ...articuloEditando, id_rubro: 0 })
                    }}
                    className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-orange-500/50 uppercase"
                  >
                    <option value="">Sin rubro</option>
                    {categoriasGenerales.map(c => (
                      <option key={c.id} value={c.id}>{c.descripcion}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Subrubro</label>
                  <select
                    value={articuloEditando.id_rubro}
                    onChange={(e) => setArticuloEditando({ ...articuloEditando, id_rubro: Number(e.target.value) })}
                    disabled={!categoriaEdicion}
                    className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-orange-500/50 uppercase disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <option value={0}>Sin subrubro</option>
                    {subrubrosEdicion.map(r => (
                      <option key={r.id} value={r.id}>{r.descripcion}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-end gap-6">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Precio</label>
                  <input
                    type="number"
                    step="0.01"
                    value={articuloEditando.precio_1}
                    onChange={(e) => setArticuloEditando({ ...articuloEditando, precio_1: Number(e.target.value) })}
                    className="w-full bg-black border border-zinc-800 rounded-sm px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <label className="flex items-center gap-2 pb-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={articuloEditando.oferta}
                    onChange={(e) => setArticuloEditando({ ...articuloEditando, oferta: e.target.checked })}
                    className="w-4 h-4 accent-orange-500 cursor-pointer"
                  />
                  <span className="text-[10px] uppercase tracking-widest text-zinc-400">En oferta</span>
                </label>
              </div>
            </div>

            {mensaje && (
              <p className={`mt-4 text-sm ${mensaje.tipo === 'ok' ? 'text-orange-400' : 'text-red-500'}`}>{mensaje.texto}</p>
            )}

            <div className="flex gap-4 mt-6">
              <button
                onClick={cerrarEdicion}
                className="flex-1 border border-zinc-800 text-zinc-400 py-3 text-xs uppercase tracking-widest hover:border-zinc-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEdicion}
                disabled={guardando || !articuloEditando.codigo.trim() || !articuloEditando.descripcion.trim()}
                className="flex-1 bg-white hover:bg-orange-500 text-black py-3 text-xs uppercase tracking-widest font-medium transition-colors disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed"
              >
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
