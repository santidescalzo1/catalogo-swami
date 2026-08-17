'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

const SUPABASE_STORAGE_URL = 'https://rhdxfpkrxeuymihhkyxo.supabase.co/storage/v1/object/public/repuestos'

interface Articulo {
  id: number;
  codigo: string;
  descripcion: string;
  descripcion_estandarizada?: string | null;
  codigo_proveedor?: string;
  precio_1: number;
  marcas?: { descripcion: string } | null;
  rubros?: { descripcion: string } | null;
  imagen_url?: string;
}

// La descripción estandarizada (cargada a mano desde /admin/articulos) no se
// pisa al re-importar el Excel del sistema de facturación, a diferencia de
// "descripcion". Se muestra siempre que esté cargada.
const descripcionMostrada = (a: Articulo) => a.descripcion_estandarizada || a.descripcion

interface ItemCarrito extends Articulo {
  cantidad: number;
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

export default function CatalogoPublico() {
  const [repuestos, setRepuestos] = useState<Articulo[]>([])
  const [marcas, setMarcas] = useState<Categoria[]>([])
  const [rubros, setRubros] = useState<Rubro[]>([])
  const [categoriasGenerales, setCategoriasGenerales] = useState<Categoria[]>([])
  const rubrosRef = useRef<Rubro[]>([])

  const [marcasAuto, setMarcasAuto] = useState<Categoria[]>([])
  const [modelosAuto, setModelosAuto] = useState<ModeloAuto[]>([])

  const [busqueda, setBusqueda] = useState('')
  const [marcaFiltro, setMarcaFiltro] = useState<string>('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')
  const [rubroFiltro, setRubroFiltro] = useState<string>('')
  const [vehiculoFiltro, setVehiculoFiltro] = useState<string>('')
  const [modeloAutoFiltro, setModeloAutoFiltro] = useState<string>('')
  const [ofertaFiltro, setOfertaFiltro] = useState(false)
  const [cargando, setCargando] = useState(true)

  const catalogoRef = useRef<HTMLElement>(null)

  const [paginaActual, setPaginaActual] = useState(1)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [errorCarga, setErrorCarga] = useState(false)
  const porPagina = 24

  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [mostrarCarrito, setMostrarCarrito] = useState(false)
  const primerRenderCarrito = useRef(true)

  const [articuloSeleccionado, setArticuloSeleccionado] = useState<Articulo | null>(null)
  const [vistaLista, setVistaLista] = useState(true)

  const router = useRouter()
  const [mostrarLogin, setMostrarLogin] = useState(false)
  const [emailLogin, setEmailLogin] = useState('')
  const [passwordLogin, setPasswordLogin] = useState('')
  const [errorLogin, setErrorLogin] = useState('')
  const [cargandoLogin, setCargandoLogin] = useState(false)
  const [clienteSesion, setClienteSesion] = useState<{ nombre: string; descuento_pct: number } | null>(null)
  const [adminSesion, setAdminSesion] = useState(false)

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

  useEffect(() => {
    const restaurarSesion = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: cliente } = await supabase
        .from('clientes')
        .select('nombre, descuento_pct')
        .eq('id', session.user.id)
        .maybeSingle()
      if (cliente) {
        setClienteSesion(cliente)
        return
      }

      // No es cliente: puede ser el admin volviendo desde /admin via
      // "Ver catálogo" (esa navegación mantiene la sesión a propósito).
      const { data: esAdmin } = await supabase.from('admins').select('id').eq('id', session.user.id).maybeSingle()
      if (esAdmin) setAdminSesion(true)
    }
    restaurarSesion()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorLogin('')
    setCargandoLogin(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email: emailLogin, password: passwordLogin })
    if (error || !data.user) {
      setErrorLogin('Usuario o contraseña incorrectos.')
      setCargandoLogin(false)
      return
    }

    const { data: cliente } = await supabase
      .from('clientes')
      .select('nombre, descuento_pct')
      .eq('id', data.user.id)
      .maybeSingle()

    if (cliente) {
      setClienteSesion(cliente)
      setMostrarLogin(false)
      setEmailLogin('')
      setPasswordLogin('')
      setCargandoLogin(false)
      return
    }

    const { data: esAdmin } = await supabase.from('admins').select('id').eq('id', data.user.id).maybeSingle()
    if (esAdmin) {
      router.push('/admin')
      return
    }

    // Cuenta valida pero sin perfil de cliente ni de admin: no deberia
    // pasar en el uso normal, pero si pasa no la dejamos "logueada" a
    // medias.
    setErrorLogin('Esta cuenta no está habilitada. Contactá al administrador.')
    await supabase.auth.signOut()
    setCargandoLogin(false)
  }

  const handleLogoutSesion = async () => {
    await supabase.auth.signOut()
    setClienteSesion(null)
    setAdminSesion(false)
  }

  const aplicarFiltros = useCallback(async (termino: string, idMarca: string, idCategoria: string, idRubro: string, idVehiculo: string, idModeloAuto: string, soloOferta: boolean, pagina: number) => {
    setCargando(true)
    setErrorCarga(false)

    // El join a articulos_modelos_auto solo hace falta (y solo se pide con
    // !inner, para no traer artículos sin ningún vehículo asociado) cuando
    // hay un filtro de marca/modelo de auto activo.
    const necesitaVehiculo = !!(idVehiculo || idModeloAuto)
    const seleccionVehiculo = necesitaVehiculo
      ? ', articulos_modelos_auto!inner(modelos_auto!inner(id_marca_auto))'
      : ''

    let query = supabase
      .from('articulos')
      .select(`id, codigo, descripcion, descripcion_estandarizada, codigo_proveedor, precio_1, marcas(descripcion), rubros(descripcion)${seleccionVehiculo}`, { count: 'exact' })
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
          `descripcion_estandarizada.ilike.%${limpio}%`,
          `codigo.ilike.%${limpio}%`,
          `codigo_proveedor.ilike.%${limpio}%`,
        ]
        if (normalizado.length >= 2) {
          alternativas.push(`descripcion_normalizada.ilike.%${normalizado}%`)
        }
        query = query.or(alternativas.join(','))
      } else {
        palabras.forEach(palabra => {
          query = query.or(`descripcion.ilike.%${palabra}%,descripcion_estandarizada.ilike.%${palabra}%,codigo.ilike.%${palabra}%,codigo_proveedor.ilike.%${palabra}%`)
        })
      }
    }

    if (soloOferta) query = query.eq('oferta', true)

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
      const { data: dataCategorias } = await supabase.from('categorias_generales').select('*').order('descripcion')
      // Vistas que solo devuelven marcas/modelos con al menos un artículo
      // asociado (ver supabase/marca-modelo-auto-vistas-filtradas.sql) —
      // así el filtro no muestra marcas vacías, y se actualiza solo si se
      // cargan artículos nuevos de una marca que hoy no tiene ninguno.
      const { data: dataMarcasAuto } = await supabase.from('marcas_auto_con_datos').select('*').order('descripcion')
      const { data: dataModelosAuto } = await supabase.from('modelos_auto_con_datos').select('*').order('descripcion')

      if (dataMarcas) setMarcas(dataMarcas)
      if (dataRubros) {
        setRubros(dataRubros)
        rubrosRef.current = dataRubros
      }
      if (dataCategorias) setCategoriasGenerales(dataCategorias)
      if (dataMarcasAuto) setMarcasAuto(dataMarcasAuto)
      if (dataModelosAuto) setModelosAuto(dataModelosAuto)

      aplicarFiltros('', '', '', '', '', '', false, 1)
    }

    inicializarCatalogo()
  }, [aplicarFiltros])

  const handleBusqueda = (val: string) => {
    setBusqueda(val)
    setPaginaActual(1)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (val.length >= 2 || val.length === 0) {
        aplicarFiltros(val, marcaFiltro, categoriaFiltro, rubroFiltro, vehiculoFiltro, modeloAutoFiltro, ofertaFiltro, 1)
      }
    }, 400)
  }

  const handleMarca = (val: string) => {
    setMarcaFiltro(val)
    setPaginaActual(1)
    aplicarFiltros(busqueda, val, categoriaFiltro, rubroFiltro, vehiculoFiltro, modeloAutoFiltro, ofertaFiltro, 1)
  }

  const handleCategoria = (val: string) => {
    setCategoriaFiltro(val)
    setRubroFiltro('')
    setPaginaActual(1)
    aplicarFiltros(busqueda, marcaFiltro, val, '', vehiculoFiltro, modeloAutoFiltro, ofertaFiltro, 1)
  }

  const handleRubro = (val: string) => {
    setRubroFiltro(val)
    setPaginaActual(1)
    aplicarFiltros(busqueda, marcaFiltro, categoriaFiltro, val, vehiculoFiltro, modeloAutoFiltro, ofertaFiltro, 1)
  }

  const handleVehiculo = (val: string) => {
    setVehiculoFiltro(val)
    setModeloAutoFiltro('')
    setPaginaActual(1)
    aplicarFiltros(busqueda, marcaFiltro, categoriaFiltro, rubroFiltro, val, '', ofertaFiltro, 1)
  }

  const handleModeloAuto = (val: string) => {
    setModeloAutoFiltro(val)
    setPaginaActual(1)
    aplicarFiltros(busqueda, marcaFiltro, categoriaFiltro, rubroFiltro, vehiculoFiltro, val, ofertaFiltro, 1)
  }

  const irAInicio = () => {
    limpiarFiltros()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const irACatalogo = () => {
    catalogoRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const irAOfertas = () => {
    setOfertaFiltro(true)
    setPaginaActual(1)
    aplicarFiltros(busqueda, marcaFiltro, categoriaFiltro, rubroFiltro, vehiculoFiltro, modeloAutoFiltro, true, 1)
    catalogoRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const limpiarFiltros = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setBusqueda('')
    setMarcaFiltro('')
    setCategoriaFiltro('')
    setRubroFiltro('')
    setVehiculoFiltro('')
    setModeloAutoFiltro('')
    setOfertaFiltro(false)
    setPaginaActual(1)
    aplicarFiltros('', '', '', '', '', '', false, 1)
  }

  const hayFiltrosActivos = busqueda !== '' || marcaFiltro !== '' || categoriaFiltro !== '' || rubroFiltro !== '' || vehiculoFiltro !== '' || modeloAutoFiltro !== '' || ofertaFiltro

  const cambiarPagina = (nuevaPagina: number) => {
    setPaginaActual(nuevaPagina)
    aplicarFiltros(busqueda, marcaFiltro, categoriaFiltro, rubroFiltro, vehiculoFiltro, modeloAutoFiltro, ofertaFiltro, nuevaPagina)
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
      texto += `🔹 *[${item.codigo}]* ${descripcionMostrada(item)} (x${item.cantidad})%0A`
    })
    
    texto += `%0A*Total estimado:* $${totalCarrito.toLocaleString('es-AR')}`
    window.open(`https://wa.me/${numeroWhatsApp}?text=${texto}`, '_blank')
  }

  const totalPaginas = Math.ceil(totalRegistros / porPagina)

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-orange-500/30 overflow-x-hidden">

      {/* BARRA DE ANUNCIOS */}
      <div className="bg-gradient-to-r from-zinc-950 via-orange-950/40 to-zinc-950 border-b border-zinc-900">
        <p className="max-w-7xl mx-auto px-6 py-2 text-center text-[10px] sm:text-[11px] text-orange-200/80 tracking-wide">
          Envíos a todo Córdoba <span className="text-zinc-700 mx-2">·</span> Cotización directa por WhatsApp
        </p>
      </div>

      {/* HEADER */}
      <header className="border-b border-zinc-800/50 bg-zinc-950/90 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">

            {/* Título y Logo */}
            <div className="flex items-center justify-between w-full md:w-auto gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setMostrarLogin(true)}
                  aria-label={clienteSesion ? `Mi cuenta: ${clienteSesion.nombre}` : adminSesion ? 'Sesión de administrador' : 'Ingresar'}
                  className="relative p-2 -ml-2 text-zinc-400 hover:text-orange-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
                  {(clienteSesion || adminSesion) && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-orange-500" />
                  )}
                </button>
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

            {/* Navegación */}
            <nav className="hidden md:flex items-center gap-8">
              <button onClick={irAInicio} className="text-[11px] uppercase tracking-[0.15em] text-zinc-400 hover:text-orange-400 transition-colors">
                Inicio
              </button>
              <button onClick={irACatalogo} className="text-[11px] uppercase tracking-[0.15em] text-zinc-400 hover:text-orange-400 transition-colors">
                Catálogo
              </button>
              <button
                onClick={irAOfertas}
                className={`text-[11px] uppercase tracking-[0.15em] transition-colors ${ofertaFiltro ? 'text-orange-400' : 'text-zinc-400 hover:text-orange-400'}`}
              >
                Ofertas
              </button>
            </nav>

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

          <div className="flex flex-col md:flex-row md:flex-wrap gap-4 border-t border-zinc-900 pt-6">
            <div className="flex-1 min-w-[140px] flex flex-col gap-1.5">
              <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 px-0.5">Marca</span>
              <select
                value={marcaFiltro}
                onChange={(e) => handleMarca(e.target.value)}
                className="bg-zinc-950 border border-zinc-800/70 text-zinc-400 text-sm px-4 py-2.5 rounded-sm focus:outline-none focus:border-orange-500/50 appearance-none cursor-pointer w-full transition-all uppercase tracking-wider text-[11px]"
              >
                <option value="">Todos</option>
                {marcas.filter(m => m.id !== 0).map(m => (
                  <option key={m.id} value={m.id}>{m.descripcion}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[140px] flex flex-col gap-1.5">
              <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 px-0.5">Rubro</span>
              <select
                value={categoriaFiltro}
                onChange={(e) => handleCategoria(e.target.value)}
                className="bg-zinc-950 border border-zinc-800/70 text-zinc-400 text-sm px-4 py-2.5 rounded-sm focus:outline-none focus:border-orange-500/50 appearance-none cursor-pointer w-full transition-all uppercase tracking-wider text-[11px]"
              >
                <option value="">Todos</option>
                {categoriasGenerales.map(c => (
                  <option key={c.id} value={c.id}>{c.descripcion}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[140px] flex flex-col gap-1.5">
              <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 px-0.5">Subrubro</span>
              <select
                value={rubroFiltro}
                onChange={(e) => handleRubro(e.target.value)}
                className="bg-zinc-950 border border-zinc-800/70 text-zinc-400 text-sm px-4 py-2.5 rounded-sm focus:outline-none focus:border-orange-500/50 appearance-none cursor-pointer w-full transition-all uppercase tracking-wider text-[11px]"
              >
                <option value="">Todos</option>
                {rubros
                  .filter(r => r.id !== 0)
                  .filter(r => !categoriaFiltro || String(r.id_categoria_general) === categoriaFiltro)
                  .map(r => (
                    <option key={r.id} value={r.id}>{r.descripcion}</option>
                  ))}
              </select>
            </div>

            <div className="flex-1 min-w-[140px] flex flex-col gap-1.5">
              <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 px-0.5">Vehículo</span>
              <select
                value={vehiculoFiltro}
                onChange={(e) => handleVehiculo(e.target.value)}
                className="bg-zinc-950 border border-zinc-800/70 text-zinc-400 text-sm px-4 py-2.5 rounded-sm focus:outline-none focus:border-orange-500/50 appearance-none cursor-pointer w-full transition-all uppercase tracking-wider text-[11px]"
              >
                <option value="">Todos</option>
                {marcasAuto.map(m => (
                  <option key={m.id} value={m.id}>{m.descripcion}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[140px] flex flex-col gap-1.5">
              <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 px-0.5">Modelo</span>
              <select
                value={modeloAutoFiltro}
                onChange={(e) => handleModeloAuto(e.target.value)}
                disabled={!vehiculoFiltro}
                className="bg-zinc-950 border border-zinc-800/70 text-zinc-400 text-sm px-4 py-2.5 rounded-sm focus:outline-none focus:border-orange-500/50 appearance-none cursor-pointer w-full transition-all uppercase tracking-wider text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">Todos</option>
                {modelosAuto
                  .filter(m => !vehiculoFiltro || String(m.id_marca_auto) === vehiculoFiltro)
                  .map(m => (
                    <option key={m.id} value={m.id}>{m.descripcion}</option>
                  ))}
              </select>
            </div>

            <button
              onClick={limpiarFiltros}
              disabled={!hayFiltrosActivos}
              className="text-[11px] uppercase tracking-wider text-zinc-500 border border-zinc-800 px-4 py-2.5 hover:border-orange-500/50 hover:text-orange-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-zinc-800 disabled:hover:text-zinc-500 shrink-0 self-end"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </header>

      {/* FRANJA DE CONFIANZA */}
      <div className="border-b border-zinc-800/50 bg-zinc-900/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-2 text-[10px] uppercase tracking-[0.15em] text-zinc-500">
          <span className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-orange-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Envíos a todo Córdoba
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-orange-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            Cotización directa por WhatsApp
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-orange-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            Stock real, actualizado
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-orange-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Atención directa, sin intermediarios
          </span>
        </div>
      </div>

      {/* GRILLA DE PRODUCTOS */}
      <section ref={catalogoRef} className="max-w-7xl mx-auto px-6 py-12 scroll-mt-24">
        <div className="flex justify-between items-center mb-8 text-[10px] text-zinc-500 uppercase tracking-[0.2em]">
          <span>Inventario Swami</span>
          <div className="flex items-center gap-6">
            <span>{totalRegistros} repuestos</span>
            <div className="flex items-center gap-1 border border-zinc-800">
              <button
                onClick={() => setVistaLista(false)}
                aria-label="Ver en grilla"
                className={`p-2 transition-colors ${!vistaLista ? 'bg-zinc-900 text-orange-500' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" /></svg>
              </button>
              <button
                onClick={() => setVistaLista(true)}
                aria-label="Ver en lista"
                className={`p-2 transition-colors ${vistaLista ? 'bg-zinc-900 text-orange-500' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            </div>
          </div>
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
            {vistaLista ? (
            <div className="overflow-x-auto border border-zinc-900">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    <th className="text-left font-normal px-4 py-3">Código</th>
                    <th className="text-left font-normal px-4 py-3">Descripción</th>
                    <th className="text-left font-normal px-4 py-3 hidden md:table-cell">Marca</th>
                    <th className="text-left font-normal px-4 py-3 hidden md:table-cell">Rubro</th>
                    <th className="text-right font-normal px-4 py-3">Precio</th>
                    <th className="text-right font-normal px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {repuestos.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setArticuloSeleccionado(item)}
                      className="border-b border-zinc-900 last:border-b-0 hover:bg-zinc-900/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-orange-500/80 font-mono text-[11px] whitespace-nowrap">{item.codigo}</td>
                      <td className="px-4 py-3 text-zinc-300 font-light">{descripcionMostrada(item)}</td>
                      <td className="px-4 py-3 text-zinc-500 text-[11px] uppercase tracking-wider hidden md:table-cell">
                        {item.marcas?.descripcion && item.marcas.descripcion !== 'Sin Marca' ? item.marcas.descripcion : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-[11px] uppercase tracking-wider hidden md:table-cell">
                        {item.rubros?.descripcion ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-white font-light whitespace-nowrap">
                        ${item.precio_1.toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setArticuloSeleccionado(item) }}
                            aria-label="Ver detalle"
                            className="p-2 text-zinc-500 hover:text-orange-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          </button>
                          <button
                            onClick={(e) => agregarAlCarrito(item, e)}
                            className="text-[9px] uppercase tracking-[0.2em] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-orange-500 hover:text-black hover:border-orange-500 px-3 py-2 transition-all whitespace-nowrap"
                          >
                            Sumar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {repuestos.map((item) => (
                <article
                  key={item.id}
                  onClick={() => setArticuloSeleccionado(item)}
                  className="group relative border border-zinc-800/50 bg-zinc-900/40 p-5 hover:bg-zinc-900/70 hover:border-orange-500/30 hover:shadow-[0_0_40px_-12px_rgba(249,115,22,0.25)] transition-all duration-300 flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    {/* Contenedor de Imagen con URL Dinámica Supabase */}
                    <div className="relative aspect-square w-full bg-zinc-950 border border-zinc-800/50 mb-5 flex items-center justify-center overflow-hidden group-hover:border-orange-500/20 transition-colors">
                      <Image
                        src={`${SUPABASE_STORAGE_URL}/${item.codigo}.jpg`}
                        alt={descripcionMostrada(item)}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
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
                      {descripcionMostrada(item)}
                    </h2>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-zinc-800/50 pt-4 mt-4">
                    <span className="text-lg font-light text-white tracking-wide group-hover:text-orange-400 transition-colors">
                      ${item.precio_1.toLocaleString('es-AR')}
                    </span>
                    <button
                      onClick={(e) => agregarAlCarrito(item, e)}
                      className="text-[9px] uppercase tracking-[0.2em] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 group-hover:border-orange-500/50 hover:bg-orange-500 hover:text-black hover:border-orange-500 px-4 py-2 transition-all shrink-0"
                    >
                      Sumar
                    </button>
                  </div>
                </article>
              ))}
            </div>
            )}

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
                alt={descripcionMostrada(articuloSeleccionado)}
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
                  {descripcionMostrada(articuloSeleccionado)}
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

      {/* PANEL LATERAL DE INGRESO */}
      {mostrarLogin && (
        <>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity" onClick={() => setMostrarLogin(false)} />
          <div className="fixed top-0 left-0 h-full w-full max-w-sm bg-zinc-950 border-r border-zinc-900 z-50 flex flex-col shadow-2xl">
            <div className="p-8 border-b border-zinc-900 flex justify-between items-center bg-zinc-950/50">
              <h2 className="text-sm font-light tracking-[0.3em] text-white uppercase">
                {clienteSesion || adminSesion ? 'Mi cuenta' : 'Ingresar'}
              </h2>
              <button onClick={() => setMostrarLogin(false)} className="text-zinc-600 hover:text-orange-500 transition-colors p-2">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              {clienteSesion ? (
                <div className="space-y-6">
                  <p className="text-sm text-zinc-400">
                    Hola, <span className="text-white">{clienteSesion.nombre}</span>.
                  </p>
                  {clienteSesion.descuento_pct > 0 && (
                    <p className="text-xs text-orange-400 uppercase tracking-widest">
                      Descuento asignado: {clienteSesion.descuento_pct}%
                    </p>
                  )}
                  <button
                    onClick={handleLogoutSesion}
                    className="w-full border border-zinc-800 text-zinc-400 py-3 text-xs uppercase tracking-widest hover:border-orange-500/50 hover:text-orange-400 transition-colors"
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : adminSesion ? (
                <div className="space-y-6">
                  <p className="text-sm text-zinc-400">
                    Sesión de <span className="text-white">administrador</span> activa.
                  </p>
                  <Link
                    href="/admin"
                    className="block text-center w-full bg-white hover:bg-orange-500 text-black text-xs font-medium uppercase tracking-[0.2em] py-4 transition-colors"
                  >
                    Ir al panel administrador
                  </Link>
                  <button
                    onClick={handleLogoutSesion}
                    className="w-full border border-zinc-800 text-zinc-400 py-3 text-xs uppercase tracking-widest hover:border-orange-500/50 hover:text-orange-400 transition-colors"
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-5">
                  <p className="text-xs text-zinc-500 leading-relaxed mb-2">
                    Acceso para clientes con cuenta habilitada por Swami.
                  </p>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Email</label>
                    <input
                      type="email"
                      required
                      value={emailLogin}
                      onChange={(e) => setEmailLogin(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Contraseña</label>
                    <input
                      type="password"
                      required
                      value={passwordLogin}
                      onChange={(e) => setPasswordLogin(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
                    />
                  </div>
                  {errorLogin && <p className="text-xs text-red-500">{errorLogin}</p>}
                  <button
                    type="submit"
                    disabled={cargandoLogin}
                    className="w-full bg-white hover:bg-orange-500 text-black text-xs font-medium uppercase tracking-[0.2em] py-4 transition-colors disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed"
                  >
                    {cargandoLogin ? 'Ingresando...' : 'Ingresar'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </>
      )}

      {/* PANEL LATERAL DEL CARRITO */}
      {mostrarCarrito && (
        <>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity" onClick={() => setMostrarCarrito(false)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-zinc-950 border-l border-zinc-900 z-50 flex flex-col shadow-2xl">
            <div className="p-8 border-b border-zinc-900 flex justify-between items-center bg-zinc-950/50">
              <h2 className="text-sm font-light tracking-[0.3em] text-white uppercase">Tu Cotización</h2>
              <button onClick={() => setMostrarCarrito(false)} className="text-zinc-600 hover:text-orange-500 transition-colors p-2">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {carrito.length === 0 ? (
                <div className="text-center text-zinc-600 text-[10px] mt-10 uppercase tracking-[0.2em]">La lista está vacía</div>
              ) : (
                carrito.map(item => (
                  <div key={item.id} className="flex flex-col gap-4 p-5 bg-zinc-950 border border-zinc-800/50 hover:border-orange-500/30 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="pr-4">
                        <span className="text-[10px] text-orange-500/80 font-mono block mb-2">{item.codigo}</span>
                        <p className="text-sm font-light text-zinc-300 leading-relaxed">{descripcionMostrada(item)}</p>
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

            <div className="p-8 bg-zinc-950 border-t border-zinc-900">
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

      {/* FOOTER */}
      <footer className="border-t border-zinc-800/50 mt-8">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-[10px] text-zinc-700 uppercase tracking-[0.2em]">
            Swami Distribuidora Mayorista
          </span>
          <Link
            href="/admin"
            aria-label="Acceso administrador"
            className="text-zinc-800 hover:text-zinc-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15a3 3 0 100-6 3 3 0 000 6z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
          </Link>
        </div>
      </footer>
    </main>
  )
}