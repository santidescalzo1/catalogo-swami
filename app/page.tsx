'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase/client'

const SUPABASE_STORAGE_URL = 'https://rhdxfpkrxeuymihhkyxo.supabase.co/storage/v1/object/public/repuestos'

interface Articulo {
  id: number;
  codigo: string;
  descripcion: string;
  codigo_proveedor?: string;
  precio_1: number;
  marcas?: { descripcion: string } | null;
  rubros?: { descripcion: string } | null;
  imagen_url?: string; 
}

interface ItemCarrito extends Articulo {
  cantidad: number;
}

interface Categoria {
  id: number;
  descripcion: string;
}

export default function CatalogoPublico() {
  const [repuestos, setRepuestos] = useState<Articulo[]>([])
  const [marcas, setMarcas] = useState<Categoria[]>([])
  const [rubros, setRubros] = useState<Categoria[]>([])
  
  const [busqueda, setBusqueda] = useState('')
  const [marcaFiltro, setMarcaFiltro] = useState<string>('')
  const [rubroFiltro, setRubroFiltro] = useState<string>('')
  const [cargando, setCargando] = useState(true)

  const [paginaActual, setPaginaActual] = useState(1)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [errorCarga, setErrorCarga] = useState(false)
  const porPagina = 24

  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [mostrarCarrito, setMostrarCarrito] = useState(false)
  const primerRenderCarrito = useRef(true)

  const [articuloSeleccionado, setArticuloSeleccionado] = useState<Articulo | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const guardado = localStorage.getItem('swami_carrito')
    if (guardado) {
      try {
        // localStorage no existe en el servidor, así que esta lectura tiene
        // que pasar por un efecto (no por un initializer de useState) para
        // no romper la hidratación con un valor distinto al del server.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCarrito(JSON.parse(guardado))
      } catch {
        // carrito guardado corrupto, se ignora
      }
    }
  }, [])

  useEffect(() => {
    if (primerRenderCarrito.current) {
      primerRenderCarrito.current = false
      return
    }
    localStorage.setItem('swami_carrito', JSON.stringify(carrito))
  }, [carrito])

  const aplicarFiltros = useCallback(async (termino: string, idMarca: string, idRubro: string, pagina: number) => {
    setCargando(true)
    setErrorCarga(false)

    let query = supabase
      .from('articulos')
      .select('id, codigo, descripcion, codigo_proveedor, precio_1, marcas(descripcion), rubros(descripcion)', { count: 'exact' })
      .gt('precio_1', 0)

    const limpio = termino.trim()
    if (limpio.length >= 2) {
      const palabras = limpio.split(/\s+/)

      if (palabras.length === 1) {
        // Una sola palabra: además de buscarla tal cual, la comparamos sin
        // espacios/signos contra una columna normalizada. Cubre el caso
        // "cubrevolantes" (pegado) contra un artículo cargado como
        // "CUBRE VOLANTE" (separado). Va todo en un único or() para que sean
        // alternativas entre sí, no condiciones que se exijan todas juntas.
        const normalizado = limpio.toLowerCase().replace(/[^a-z0-9áéíóúñ]/gi, '')
        const alternativas = [
          `descripcion.ilike.%${limpio}%`,
          `codigo.ilike.%${limpio}%`,
          `codigo_proveedor.ilike.%${limpio}%`,
        ]
        if (normalizado.length >= 2) {
          alternativas.push(`descripcion_normalizada.ilike.%${normalizado}%`)
        }
        query = query.or(alternativas.join(','))
      } else {
        palabras.forEach(palabra => {
          query = query.or(`descripcion.ilike.%${palabra}%,codigo.ilike.%${palabra}%,codigo_proveedor.ilike.%${palabra}%`)
        })
      }
    }

    if (idMarca) query = query.eq('id_marca', idMarca)
    if (idRubro) query = query.eq('id_rubro', idRubro)

    const desde = (pagina - 1) * porPagina
    const hasta = desde + porPagina - 1

    const { data, count, error } = await query.range(desde, hasta)

    if (error) {
      setErrorCarga(true)
      setRepuestos([])
      setTotalRegistros(0)
    } else {
      setRepuestos((data ?? []) as unknown as Articulo[])
      setTotalRegistros(count || 0)
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    const inicializarCatalogo = async () => {
      const { data: dataMarcas } = await supabase.from('marcas').select('*').order('descripcion')
      const { data: dataRubros } = await supabase.from('rubros').select('*').order('descripcion')
      
      if (dataMarcas) setMarcas(dataMarcas)
      if (dataRubros) setRubros(dataRubros)

      aplicarFiltros('', '', '', 1)
    }

    inicializarCatalogo()
  }, [aplicarFiltros])

  const handleBusqueda = (val: string) => {
    setBusqueda(val)
    setPaginaActual(1)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (val.length >= 2 || val.length === 0) {
        aplicarFiltros(val, marcaFiltro, rubroFiltro, 1)
      }
    }, 400)
  }

  const handleMarca = (val: string) => {
    setMarcaFiltro(val)
    setPaginaActual(1)
    aplicarFiltros(busqueda, val, rubroFiltro, 1)
  }

  const handleRubro = (val: string) => {
    setRubroFiltro(val)
    setPaginaActual(1)
    aplicarFiltros(busqueda, marcaFiltro, val, 1)
  }

  const cambiarPagina = (nuevaPagina: number) => {
    setPaginaActual(nuevaPagina)
    aplicarFiltros(busqueda, marcaFiltro, rubroFiltro, nuevaPagina)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const agregarAlCarrito = (item: Articulo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); 
    setCarrito(prev => {
      const existe = prev.find(p => p.id === item.id)
      if (existe) {
        return prev.map(p => p.id === item.id ? { ...p, cantidad: p.cantidad + 1 } : p)
      }
      return [...prev, { ...item, cantidad: 1 }]
    })
    setMostrarCarrito(true)
    setArticuloSeleccionado(null) 
  }

  const removerDelCarrito = (id: number) => {
    setCarrito(prev => prev.filter(p => p.id !== id))
  }

  const cambiarCantidad = (id: number, delta: number) => {
    setCarrito(prev => prev.map(p => {
      if (p.id === id) {
        const nuevaCantidad = p.cantidad + delta
        return { ...p, cantidad: nuevaCantidad > 0 ? nuevaCantidad : 1 }
      }
      return p
    }))
  }

  const totalCarrito = carrito.reduce((acc, item) => acc + (item.precio_1 * item.cantidad), 0)

  const enviarWhatsApp = () => {
    const numeroWhatsApp = "5493513646356" 
    let texto = "Hola *Swami Distribuidora*!%0AQuería solicitar una cotización por los siguientes repuestos:%0A%0A"
    
    carrito.forEach(item => {
      texto += `🔹 *[${item.codigo}]* ${item.descripcion} (x${item.cantidad})%0A`
    })
    
    texto += `%0A*Total estimado:* $${totalCarrito.toLocaleString('es-AR')}`
    window.open(`https://wa.me/${numeroWhatsApp}?text=${texto}`, '_blank')
  }

  const totalPaginas = Math.ceil(totalRegistros / porPagina)

  return (
    <main className="min-h-screen bg-black text-zinc-300 font-sans selection:bg-orange-500/30 overflow-x-hidden">
      
      {/* HEADER */}
      <header className="border-b border-zinc-900 bg-black/90 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
            
            {/* Título y Logo */}
            <div className="flex items-center justify-between w-full md:w-auto gap-4">
              <div className="flex items-center gap-4">
                <Image src="/logo.png" alt="Swami Logo" width={500} height={500} priority className="h-14 w-auto object-contain drop-shadow-[0_0_15px_rgba(249,115,22,0.1)]" />
                <div className="hidden md:flex flex-col justify-center">
                  <h1 className="text-xl font-light tracking-[0.2em] text-white uppercase leading-tight">
                    Swami
                  </h1>
                  <span className="text-[10px] text-orange-500 tracking-[0.3em] uppercase opacity-80">
                    Distribuidora Mayorista
                  </span>
                </div>
              </div>
              
              <button 
                onClick={() => setMostrarCarrito(true)}
                className="md:hidden relative p-2 text-zinc-400 hover:text-orange-500 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                {carrito.length > 0 && (
                  <span className="absolute top-0 right-0 bg-orange-500 text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {carrito.reduce((acc, item) => acc + item.cantidad, 0)}
                  </span>
                )}
              </button>
            </div>
            
            {/* Buscador y Carrito Desktop */}
            <div className="w-full md:w-[32rem] flex gap-4 items-center">
              <div className="relative w-full">
                <input 
                  type="text" 
                  placeholder="Buscar código, proveedor o descripción..." 
                  value={busqueda}
                  onChange={(e) => handleBusqueda(e.target.value)}
                  className="w-full bg-zinc-900/30 border border-zinc-800 rounded-sm px-5 py-3 pl-10 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 focus:bg-zinc-900/80 transition-all"
                />
                <svg className="w-4 h-4 text-zinc-600 absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              
              <button 
                onClick={() => setMostrarCarrito(true)}
                className="hidden md:flex relative items-center justify-center bg-zinc-900 border border-zinc-800 p-3 rounded-sm hover:border-orange-500/50 hover:text-orange-500 transition-all group min-w-[46px]"
              >
                <svg className="w-5 h-5 text-zinc-400 group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                {carrito.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(249,115,22,0.3)]">
                    {carrito.reduce((acc, item) => acc + item.cantidad, 0)}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 border-t border-zinc-900 pt-6">
            <select 
              value={marcaFiltro}
              onChange={(e) => handleMarca(e.target.value)}
              className="bg-black border border-zinc-800 text-zinc-400 text-sm px-4 py-2.5 rounded-sm focus:outline-none focus:border-orange-500/50 appearance-none cursor-pointer flex-1 transition-all uppercase tracking-wider text-[11px]"
            >
              <option value="">Todas las Marcas</option>
              {marcas.filter(m => m.id !== 0).map(m => (
                <option key={m.id} value={m.id}>{m.descripcion}</option>
              ))}
            </select>

            <select 
              value={rubroFiltro}
              onChange={(e) => handleRubro(e.target.value)}
              className="bg-black border border-zinc-800 text-zinc-400 text-sm px-4 py-2.5 rounded-sm focus:outline-none focus:border-orange-500/50 appearance-none cursor-pointer flex-1 transition-all uppercase tracking-wider text-[11px]"
            >
              <option value="">Todos los Rubros</option>
              {rubros.filter(r => r.id !== 0).map(r => (
                <option key={r.id} value={r.id}>{r.descripcion}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* GRILLA DE PRODUCTOS */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8 text-[10px] text-zinc-500 uppercase tracking-[0.2em]">
          <span>Inventario Swami</span>
          <span>{totalRegistros} repuestos</span>
        </div>

        {cargando ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: porPagina }).map((_, i) => (
              <div key={i} className="border border-zinc-900 bg-zinc-950/30 p-5 animate-pulse">
                <div className="aspect-square w-full bg-zinc-900/60 mb-5" />
                <div className="h-2 w-1/3 bg-zinc-900/60 mb-3" />
                <div className="h-3 w-full bg-zinc-900/60 mb-2" />
                <div className="h-3 w-2/3 bg-zinc-900/60 mb-4" />
                <div className="h-5 w-1/2 bg-zinc-900/60" />
              </div>
            ))}
          </div>
        ) : errorCarga ? (
          <div className="text-center py-32 text-zinc-600 font-light tracking-wide">
            No pudimos cargar el catálogo. Revisá tu conexión y volvé a intentar.
          </div>
        ) : repuestos.length === 0 ? (
          <div className="text-center py-32 text-zinc-600 font-light tracking-wide">No se encontraron resultados para tu búsqueda.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {repuestos.map((item) => (
                <article 
                  key={item.id} 
                  onClick={() => setArticuloSeleccionado(item)}
                  className="group relative border border-zinc-900 bg-zinc-950/30 p-5 hover:bg-zinc-900/50 hover:border-orange-500/30 transition-all duration-500 flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    {/* Contenedor de Imagen con URL Dinámica Supabase */}
                    <div className="relative aspect-square w-full bg-black border border-zinc-900 mb-5 flex items-center justify-center overflow-hidden group-hover:border-orange-500/20 transition-colors">
                      <Image
                        src={`${SUPABASE_STORAGE_URL}/${item.codigo}.jpg`}
                        alt={item.descripcion}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          e.currentTarget.nextElementSibling?.classList.add('flex');
                        }}
                      />
                      <div className="hidden text-center flex-col items-center gap-4 w-full h-full justify-center">
                        <svg className="w-8 h-8 text-zinc-800 group-hover:text-orange-500/20 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    </div>

                    <div className="flex justify-between items-start gap-2 mb-3">
                      <span className="text-[10px] text-orange-500/80 font-mono tracking-wider">
                        {item.codigo}
                      </span>
                      <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 truncate max-w-[100px]">
                        {item.marcas?.descripcion !== 'Sin Marca' ? item.marcas?.descripcion : ''}
                      </span>
                    </div>

                    <h2 className="text-sm font-light text-zinc-300 leading-relaxed mb-2 line-clamp-2 group-hover:text-white transition-colors">
                      {item.descripcion}
                    </h2>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-zinc-900 pt-4 mt-4">
                    <span className="text-lg font-light text-white tracking-wide group-hover:text-orange-400 transition-colors">
                      ${item.precio_1.toLocaleString('es-AR')}
                    </span>
                    <button 
                      onClick={(e) => agregarAlCarrito(item, e)}
                      className="text-[9px] uppercase tracking-[0.2em] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-orange-500 hover:text-black hover:border-orange-500 px-4 py-2 transition-all shrink-0"
                    >
                      Sumar
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {/* CONTROLES DE PAGINACIÓN */}
            {totalPaginas > 1 && (
              <div className="flex justify-center items-center gap-6 mt-16 pt-8 border-t border-zinc-900">
                <button 
                  onClick={() => cambiarPagina(paginaActual - 1)}
                  disabled={paginaActual === 1}
                  className="px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] bg-transparent border border-zinc-800 text-zinc-400 hover:border-orange-500/50 hover:text-orange-400 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                >
                  Anterior
                </button>
                
                <span className="text-[10px] font-mono tracking-widest text-zinc-600">
                  <strong className="text-zinc-300 font-normal">{paginaActual}</strong> / {totalPaginas}
                </span>

                <button 
                  onClick={() => cambiarPagina(paginaActual + 1)}
                  disabled={paginaActual === totalPaginas}
                  className="px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] bg-transparent border border-zinc-800 text-zinc-400 hover:border-orange-500/50 hover:text-orange-400 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* MODAL DE PRODUCTO (VISTA AMPLIADA) */}
      {articuloSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity" 
            onClick={() => setArticuloSeleccionado(null)} 
          />
          <div className="relative bg-zinc-950 border border-zinc-800 w-full max-w-4xl flex flex-col md:flex-row shadow-[0_0_50px_rgba(249,115,22,0.05)] max-h-[90vh] overflow-hidden">
            
            {/* Mitad Imagen */}
            <div className="w-full md:w-1/2 bg-black border-b md:border-b-0 md:border-r border-zinc-900 aspect-square md:aspect-auto flex items-center justify-center relative p-8">
              <Image
                src={`${SUPABASE_STORAGE_URL}/${articuloSeleccionado.codigo}.jpg`}
                alt={articuloSeleccionado.descripcion}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  e.currentTarget.nextElementSibling?.classList.add('flex');
                }}
              />
              <div className="hidden text-center flex-col items-center gap-4">
                <svg className="w-16 h-16 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-[10px] text-zinc-700 tracking-[0.2em] uppercase">Imagen no disponible</span>
              </div>
            </div>

            {/* Mitad Info */}
            <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col overflow-y-auto">
              <button 
                onClick={() => setArticuloSeleccionado(null)} 
                className="absolute top-4 right-4 text-zinc-500 hover:text-orange-500 transition-colors p-2"
              >
                ✕
              </button>
              
              <div className="mb-8 mt-4 md:mt-0">
                <div className="flex gap-4 mb-6">
                  <span className="px-3 py-1 bg-orange-500/10 border border-orange-500/20 text-[10px] font-mono text-orange-400 tracking-wider">
                    CÓD: {articuloSeleccionado.codigo}
                  </span>
                  {articuloSeleccionado.codigo_proveedor && (
                    <span className="px-3 py-1 bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-500 tracking-wider">
                      REF: {articuloSeleccionado.codigo_proveedor}
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-light text-white leading-snug mb-4">
                  {articuloSeleccionado.descripcion}
                </h2>

                <div className="flex flex-col gap-2 text-xs text-zinc-500 uppercase tracking-widest mt-6">
                  {articuloSeleccionado.marcas?.descripcion && (
                    <p>Marca: <span className="text-zinc-300">{articuloSeleccionado.marcas.descripcion}</span></p>
                  )}
                  {articuloSeleccionado.rubros?.descripcion && (
                    <p>Rubro: <span className="text-zinc-300">{articuloSeleccionado.rubros.descripcion}</span></p>
                  )}
                </div>
              </div>

              <div className="mt-auto pt-8 border-t border-zinc-900 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] text-orange-500/70 uppercase tracking-widest mb-1">Precio Mayorista</span>
                  <span className="text-3xl font-light text-white tracking-wide">
                    ${articuloSeleccionado.precio_1.toLocaleString('es-AR')}
                  </span>
                </div>
                
                <button 
                  onClick={() => agregarAlCarrito(articuloSeleccionado)}
                  className="bg-white hover:bg-orange-500 text-black px-8 py-4 text-xs uppercase tracking-[0.2em] font-medium transition-colors"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANEL LATERAL DEL CARRITO */}
      {mostrarCarrito && (
        <>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity" onClick={() => setMostrarCarrito(false)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-zinc-950 border-l border-zinc-900 z-50 flex flex-col shadow-2xl">
            <div className="p-8 border-b border-zinc-900 flex justify-between items-center bg-black/50">
              <h2 className="text-sm font-light tracking-[0.3em] text-white uppercase">Tu Cotización</h2>
              <button onClick={() => setMostrarCarrito(false)} className="text-zinc-600 hover:text-orange-500 transition-colors p-2">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {carrito.length === 0 ? (
                <div className="text-center text-zinc-600 text-[10px] mt-10 uppercase tracking-[0.2em]">La lista está vacía</div>
              ) : (
                carrito.map(item => (
                  <div key={item.id} className="flex flex-col gap-4 p-5 bg-black border border-zinc-900 hover:border-orange-500/30 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="pr-4">
                        <span className="text-[10px] text-orange-500/80 font-mono block mb-2">{item.codigo}</span>
                        <p className="text-sm font-light text-zinc-300 leading-relaxed">{item.descripcion}</p>
                      </div>
                      <button onClick={() => removerDelCarrito(item.id)} className="text-zinc-700 hover:text-red-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                    
                    <div className="flex justify-between items-center mt-2 pt-4 border-t border-zinc-900">
                      <div className="flex items-center gap-4 border border-zinc-800 p-1">
                        <button onClick={() => cambiarCantidad(item.id, -1)} className="px-3 text-zinc-500 hover:text-orange-500 transition-colors">-</button>
                        <span className="text-xs font-mono w-4 text-center text-zinc-300">{item.cantidad}</span>
                        <button onClick={() => cambiarCantidad(item.id, 1)} className="px-3 text-zinc-500 hover:text-orange-500 transition-colors">+</button>
                      </div>
                      <span className="text-sm font-light text-white tracking-wide">${(item.precio_1 * item.cantidad).toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-8 bg-black border-t border-zinc-900">
              <div className="flex justify-between items-end mb-8">
                <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em]">Total Estimado</span>
                <span className="text-2xl font-light text-orange-500 tracking-wide">${totalCarrito.toLocaleString('es-AR')}</span>
              </div>
              
              <button 
                onClick={enviarWhatsApp}
                disabled={carrito.length === 0}
                className="w-full bg-white hover:bg-orange-500 text-black text-xs font-medium uppercase tracking-[0.2em] py-5 transition-colors flex items-center justify-center gap-2 disabled:bg-zinc-900 disabled:text-zinc-700 disabled:cursor-not-allowed"
              >
                Solicitar Cotización
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}