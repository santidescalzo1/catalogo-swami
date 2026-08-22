'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import MotorExplosivo from '@/components/MotorExplosivo'
import { aplicarBusquedaTexto } from '@/lib/busquedaTexto'

const SUPABASE_STORAGE_URL = 'https://rhdxfpkrxeuymihhkyxo.supabase.co/storage/v1/object/public/repuestos'
const BANNERS_STORAGE_URL = 'https://rhdxfpkrxeuymihhkyxo.supabase.co/storage/v1/object/public/banners'

// Subrubro "RADIADORES" (dentro de la categoria general REFRIGERACION).
// El catalogo Radiacor es, ni mas ni menos, el catalogo general filtrado
// a este subrubro — no es un set de datos aparte.
const RUBRO_RADIADORES = 25

export type Modo = 'swami' | 'radiacor'

interface Articulo {
  id: number;
  codigo: string;
  descripcion: string;
  descripcion_estandarizada?: string | null;
  codigo_proveedor?: string;
  id_proveedor?: number;
  precio_1: number;
  marcas?: { descripcion: string } | null;
  rubros?: { descripcion: string; categorias_generales?: { descripcion: string } | null } | null;
  imagen_url?: string;
}

interface VehiculoCompatible {
  marca: string;
  modelo: string;
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

interface Banner {
  id: number;
  titulo: string;
  texto: string | null;
  imagen_path: string;
  link_url: string | null;
  orden: number;
}

export default function Catalogo({ modo }: { modo: Modo }) {
  const [repuestos, setRepuestos] = useState<Articulo[]>([])
  const [marcas, setMarcas] = useState<Categoria[]>([])
  const [rubros, setRubros] = useState<Rubro[]>([])
  const [categoriasGenerales, setCategoriasGenerales] = useState<Categoria[]>([])
  const rubrosRef = useRef<Rubro[]>([])
  const [proveedoresSinRef, setProveedoresSinRef] = useState<number[]>([])

  const [marcasAuto, setMarcasAuto] = useState<Categoria[]>([])
  const [modelosAuto, setModelosAuto] = useState<ModeloAuto[]>([])

  const [busquedaCodigo, setBusquedaCodigo] = useState('')
  const [busquedaDescripcion, setBusquedaDescripcion] = useState('')
  const [marcaFiltro, setMarcaFiltro] = useState<string>('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')
  const [rubroFiltro, setRubroFiltro] = useState<string>('')
  const [vehiculoFiltro, setVehiculoFiltro] = useState<string>('')
  const [modeloAutoFiltro, setModeloAutoFiltro] = useState<string>('')
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
  const [vehiculosCompatibles, setVehiculosCompatibles] = useState<VehiculoCompatible[]>([])
  const [vistaLista, setVistaLista] = useState(true)

  const router = useRouter()
  const [mostrarLogin, setMostrarLogin] = useState(false)
  const [emailLogin, setEmailLogin] = useState('')
  const [passwordLogin, setPasswordLogin] = useState('')
  const [errorLogin, setErrorLogin] = useState('')
  const [cargandoLogin, setCargandoLogin] = useState(false)
  const [clienteSesion, setClienteSesion] = useState<{ nombre: string; descuento_pct: number } | null>(null)
  const [adminSesion, setAdminSesion] = useState(false)

  // Selector grande de marca (Swami / Radiacor): aparece la primera vez
  // que alguien entra al sitio, se recuerda en localStorage. Solo aplica
  // al modo swami — llegar directo a /radiacor ya es una eleccion.
  const [mostrarSelector, setMostrarSelector] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (modo === 'radiacor') {
      if (!localStorage.getItem('swami_marca_elegida')) {
        localStorage.setItem('swami_marca_elegida', 'radiacor')
      }
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!localStorage.getItem('swami_marca_elegida')) setMostrarSelector(true)
  }, [modo])

  const elegirMarca = (elegido: Modo) => {
    localStorage.setItem('swami_marca_elegida', elegido)
    setMostrarSelector(false)
    if (elegido === 'radiacor') router.push('/radiacor')
  }

  // Banners de ofertas: aparecen como popup al entrar (una vez por sesion
  // de navegador) y, al cerrarlos, quedan como carrusel fijo arriba del
  // catalogo hasta que se cierra tambien. La "firma" (ids de los banners
  // activos concatenados) hace que si el admin agrega/saca un banner, el
  // popup vuelva a aparecer aunque ya se haya visto esta sesion.
  const [banners, setBanners] = useState<Banner[]>([])
  const [mostrarPopupBanners, setMostrarPopupBanners] = useState(false)
  const [mostrarCarruselBanners, setMostrarCarruselBanners] = useState(false)
  const [indiceBanner, setIndiceBanner] = useState(0)
  // Controlan la animacion de entrada (fade + zoom Ken Burns en el popup,
  // slide-in en la tarjeta flotante): arrancan en false para que el primer
  // render pinte el estado "antes" de la transicion, y un frame despues
  // pasan a true disparando la transicion CSS hacia el estado final.
  const [entradaPopup, setEntradaPopup] = useState(false)
  const [entradaCarrusel, setEntradaCarrusel] = useState(false)

  useEffect(() => {
    if (!mostrarPopupBanners) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntradaPopup(false)
    const raf = requestAnimationFrame(() => setEntradaPopup(true))
    return () => cancelAnimationFrame(raf)
  }, [mostrarPopupBanners])

  useEffect(() => {
    if (!mostrarCarruselBanners) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntradaCarrusel(false)
    const raf = requestAnimationFrame(() => setEntradaCarrusel(true))
    return () => cancelAnimationFrame(raf)
  }, [mostrarCarruselBanners])

  useEffect(() => {
    if (banners.length === 0 || mostrarSelector) return
    const firma = banners.map(b => b.id).join(',')
    const vistos = sessionStorage.getItem('swami_banners_vistos')
    if (vistos !== firma) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMostrarPopupBanners(true)
    } else if (sessionStorage.getItem('swami_carrusel_cerrado') !== firma) {
      setMostrarCarruselBanners(true)
    }
  }, [banners, mostrarSelector])

  useEffect(() => {
    if (banners.length < 2 || (!mostrarPopupBanners && !mostrarCarruselBanners)) return
    const intervalo = setInterval(() => {
      setIndiceBanner(i => (i + 1) % banners.length)
    }, 5000)
    return () => clearInterval(intervalo)
  }, [banners.length, mostrarPopupBanners, mostrarCarruselBanners])

  const cerrarPopupBanners = () => {
    sessionStorage.setItem('swami_banners_vistos', banners.map(b => b.id).join(','))
    setMostrarPopupBanners(false)
    setMostrarCarruselBanners(true)
  }

  const cerrarCarruselBanners = () => {
    sessionStorage.setItem('swami_carrusel_cerrado', banners.map(b => b.id).join(','))
    setMostrarCarruselBanners(false)
  }

  const irABanner = (banner: Banner) => {
    if (!banner.link_url) return
    if (banner.link_url.startsWith('http')) {
      window.open(banner.link_url, '_blank')
    } else {
      router.push(banner.link_url)
    }
  }

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

  // Compatibilidad de vehículo (marca auto / modelo) del artículo abierto en
  // el modal: es una relación muchos-a-muchos que no viaja en el listado
  // principal, así que se busca aparte solo cuando se abre el detalle.
  useEffect(() => {
    let cancelado = false
    const buscarVehiculos = async () => {
      if (!articuloSeleccionado) {
        setVehiculosCompatibles([])
        return
      }

      const { data } = await supabase
        .from('articulos_modelos_auto')
        .select('modelos_auto(descripcion, marcas_auto(descripcion))')
        .eq('id_articulo', articuloSeleccionado.id)

      if (cancelado) return

      type FilaVehiculo = { modelos_auto: { descripcion: string; marcas_auto: { descripcion: string } | null } | null }
      const vehiculos = ((data ?? []) as unknown as FilaVehiculo[])
        .map((fila) => fila.modelos_auto)
        .filter((m): m is { descripcion: string; marcas_auto: { descripcion: string } | null } => !!m)
        .map((m) => ({ marca: m.marcas_auto?.descripcion ?? '', modelo: m.descripcion }))

      setVehiculosCompatibles(vehiculos)
    }
    buscarVehiculos()

    return () => { cancelado = true }
  }, [articuloSeleccionado])

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

  const aplicarFiltros = useCallback(async (
    terminoCodigo: string,
    terminoDescripcion: string,
    idMarca: string,
    idCategoria: string,
    idRubro: string,
    idVehiculo: string,
    idModeloAuto: string,
    pagina: number
  ) => {
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
      .select(`id, codigo, descripcion, descripcion_estandarizada, codigo_proveedor, id_proveedor, precio_1, marcas(descripcion), rubros(descripcion, categorias_generales(descripcion))${seleccionVehiculo}`, { count: 'exact' })
      .gt('precio_1', 0.01)

    // Radiacor es el mismo catalogo, acotado siempre a radiadores.
    if (modo === 'radiacor') query = query.eq('id_rubro', RUBRO_RADIADORES)

    query = aplicarBusquedaTexto(query, terminoCodigo, ['codigo', 'codigo_proveedor'], false)
    query = aplicarBusquedaTexto(query, terminoDescripcion, ['descripcion', 'descripcion_estandarizada'], true)

    if (idMarca) query = query.eq('id_marca', idMarca)

    if (modo === 'swami') {
      if (idRubro) {
        query = query.eq('id_rubro', idRubro)
      } else if (idCategoria) {
        const idsEnCategoria = rubrosRef.current
          .filter(r => String(r.id_categoria_general) === idCategoria)
          .map(r => r.id)
        query = query.in('id_rubro', idsEnCategoria.length > 0 ? idsEnCategoria : [-1])
      }
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
  }, [modo])

  useEffect(() => {
    const inicializarCatalogo = async () => {
      const { data: dataCategorias } = await supabase.from('categorias_generales').select('*').order('descripcion')
      const { data: dataProveedoresSinRef } = await supabase.from('proveedores').select('id').eq('ocultar_codigo_proveedor', true)
      // Vistas que solo devuelven modelos con al menos un artículo asociado
      // (ver supabase/marca-modelo-auto-vistas-filtradas.sql) — el filtro
      // no muestra modelos vacíos, y se actualiza solo si se cargan
      // artículos nuevos.
      const { data: dataModelosAuto } = await supabase.from('modelos_auto_con_datos').select('*').order('descripcion')
      const { data: dataBanners } = await supabase.from('banners').select('id, titulo, texto, imagen_path, link_url, orden').eq('activo', true).order('orden')

      if (dataCategorias) setCategoriasGenerales(dataCategorias)
      if (dataProveedoresSinRef) setProveedoresSinRef(dataProveedoresSinRef.map(p => p.id))
      if (dataModelosAuto) setModelosAuto(dataModelosAuto)
      if (dataBanners) setBanners(dataBanners)

      if (modo === 'radiacor') {
        // Filtros propios de Radiacor: solo marcas y marcas de auto que
        // efectivamente tienen algun radiador cargado, no la lista entera.
        const { data: dataRubros } = await supabase.from('rubros').select('*').order('descripcion')
        if (dataRubros) {
          setRubros(dataRubros)
          rubrosRef.current = dataRubros
        }

        const { data: dataArticulosRadiadores } = await supabase
          .from('articulos')
          .select('id_marca, marcas(id, descripcion)')
          .eq('id_rubro', RUBRO_RADIADORES)
          .gt('precio_1', 0.01)

        type FilaMarca = { id_marca: number; marcas: { id: number; descripcion: string } | null }
        const marcasVistas = new Map<number, string>()
        ;((dataArticulosRadiadores ?? []) as unknown as FilaMarca[]).forEach((fila) => {
          if (fila.marcas && fila.id_marca !== 0) marcasVistas.set(fila.id_marca, fila.marcas.descripcion)
        })
        setMarcas(
          Array.from(marcasVistas, ([id, descripcion]) => ({ id, descripcion }))
            .sort((a, b) => a.descripcion.localeCompare(b.descripcion))
        )

        const { data: dataVehiculosRadiadores } = await supabase
          .from('articulos_modelos_auto')
          .select('articulos!inner(id_rubro, precio_1), modelos_auto!inner(marcas_auto!inner(id, descripcion))')
          .eq('articulos.id_rubro', RUBRO_RADIADORES)
          .gt('articulos.precio_1', 0.01)

        type FilaVehiculoInit = { modelos_auto: { marcas_auto: { id: number; descripcion: string } | null } | null }
        const marcasAutoVistas = new Map<number, string>()
        ;((dataVehiculosRadiadores ?? []) as unknown as FilaVehiculoInit[]).forEach((fila) => {
          const ma = fila.modelos_auto?.marcas_auto
          if (ma) marcasAutoVistas.set(ma.id, ma.descripcion)
        })
        setMarcasAuto(
          Array.from(marcasAutoVistas, ([id, descripcion]) => ({ id, descripcion }))
            .sort((a, b) => a.descripcion.localeCompare(b.descripcion))
        )
      } else {
        const { data: dataMarcas } = await supabase.from('marcas').select('*').order('descripcion')
        const { data: dataRubros } = await supabase.from('rubros').select('*').order('descripcion')
        // Vista que solo devuelve marcas de auto con al menos un artículo
        // asociado, igual que la de modelos.
        const { data: dataMarcasAuto } = await supabase.from('marcas_auto_con_datos').select('*').order('descripcion')

        if (dataMarcas) setMarcas(dataMarcas)
        if (dataRubros) {
          setRubros(dataRubros)
          rubrosRef.current = dataRubros
        }
        if (dataMarcasAuto) setMarcasAuto(dataMarcasAuto)
      }

      aplicarFiltros('', '', '', '', '', '', '', 1)
    }

    inicializarCatalogo()
  }, [aplicarFiltros, modo])

  const handleBusquedaCodigo = (val: string) => {
    setBusquedaCodigo(val)
    setPaginaActual(1)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (val.length >= 2 || val.length === 0) {
        aplicarFiltros(val, busquedaDescripcion, marcaFiltro, categoriaFiltro, rubroFiltro, vehiculoFiltro, modeloAutoFiltro, 1)
      }
    }, 400)
  }

  const handleBusquedaDescripcion = (val: string) => {
    setBusquedaDescripcion(val)
    setPaginaActual(1)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (val.length >= 2 || val.length === 0) {
        aplicarFiltros(busquedaCodigo, val, marcaFiltro, categoriaFiltro, rubroFiltro, vehiculoFiltro, modeloAutoFiltro, 1)
      }
    }, 400)
  }

  const handleMarca = (val: string) => {
    setMarcaFiltro(val)
    setPaginaActual(1)
    aplicarFiltros(busquedaCodigo, busquedaDescripcion, val, categoriaFiltro, rubroFiltro, vehiculoFiltro, modeloAutoFiltro, 1)
  }

  const handleCategoria = (val: string) => {
    setCategoriaFiltro(val)
    setRubroFiltro('')
    setPaginaActual(1)
    aplicarFiltros(busquedaCodigo, busquedaDescripcion, marcaFiltro, val, '', vehiculoFiltro, modeloAutoFiltro, 1)
  }

  const handleRubro = (val: string) => {
    setRubroFiltro(val)
    setPaginaActual(1)
    aplicarFiltros(busquedaCodigo, busquedaDescripcion, marcaFiltro, categoriaFiltro, val, vehiculoFiltro, modeloAutoFiltro, 1)
  }

  const handleVehiculo = (val: string) => {
    setVehiculoFiltro(val)
    setModeloAutoFiltro('')
    setPaginaActual(1)
    aplicarFiltros(busquedaCodigo, busquedaDescripcion, marcaFiltro, categoriaFiltro, rubroFiltro, val, '', 1)
  }

  const handleModeloAuto = (val: string) => {
    setModeloAutoFiltro(val)
    setPaginaActual(1)
    aplicarFiltros(busquedaCodigo, busquedaDescripcion, marcaFiltro, categoriaFiltro, rubroFiltro, vehiculoFiltro, val, 1)
  }

  const irAInicio = () => {
    limpiarFiltros()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const irACatalogo = () => {
    catalogoRef.current?.scrollIntoView({ behavior: 'smooth' })
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
    setPaginaActual(1)
    aplicarFiltros('', '', '', '', '', '', '', 1)
  }

  const hayFiltrosActivos = busquedaCodigo !== '' || busquedaDescripcion !== '' || marcaFiltro !== '' || categoriaFiltro !== '' || rubroFiltro !== '' || vehiculoFiltro !== '' || modeloAutoFiltro !== ''

  const cambiarPagina = (nuevaPagina: number) => {
    setPaginaActual(nuevaPagina)
    aplicarFiltros(busquedaCodigo, busquedaDescripcion, marcaFiltro, categoriaFiltro, rubroFiltro, vehiculoFiltro, modeloAutoFiltro, nuevaPagina)
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
    const numeroWhatsApp = "5493515416301"
    let texto = "Hola *Swami Autopartes*!%0AQuería solicitar una cotización por los siguientes repuestos:%0A%0A"

    carrito.forEach(item => {
      texto += `🔹 *[${item.codigo}]* ${descripcionMostrada(item)} (x${item.cantidad})%0A`
    })

    texto += `%0A*Total estimado:* $${totalCarrito.toLocaleString('es-AR')}`
    window.open(`https://wa.me/${numeroWhatsApp}?text=${texto}`, '_blank')
  }

  const totalPaginas = Math.ceil(totalRegistros / porPagina)

  return (
    <main className="relative min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-brand-500/30 overflow-x-hidden">

      {/* SELECTOR DE MARCA: pantalla grande la primera vez que se entra al
          sitio (sin eleccion guardada en localStorage). Solo se monta en
          modo swami — entrar directo a /radiacor ya es una eleccion. */}
      {mostrarSelector && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-zinc-950/95 backdrop-blur-sm">
          <div className="max-w-2xl w-full">
            <p className="text-center text-[11px] text-brand-400 tracking-[0.3em] uppercase mb-3">Elegí tu catálogo</p>
            <h2 className="font-display text-center text-3xl sm:text-4xl font-semibold text-white mb-10">¿Qué estás buscando hoy?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <button
                onClick={() => elegirMarca('swami')}
                className="group border-2 border-white/20 hover:border-brand-500 bg-zinc-900 p-8 flex flex-col items-center gap-4 transition-colors"
              >
                <span className="w-16 h-16 rounded-sm bg-zinc-950/60 flex items-center justify-center overflow-hidden ring-1 ring-white/20 group-hover:ring-2 group-hover:ring-brand-500 transition-all">
                  <Image src="/logo.png" alt="Swami" width={64} height={64} priority className="w-full h-full object-contain p-1.5" />
                </span>
                <div className="text-center">
                  <span className="font-display block text-white text-lg font-semibold tracking-[0.04em] uppercase">Swami Autopartes</span>
                  <span className="block text-zinc-400 text-xs mt-1">Catálogo completo de repuestos</span>
                </div>
              </button>
              <button
                onClick={() => elegirMarca('radiacor')}
                className="group border-2 border-white/20 hover:border-brand-500 bg-zinc-900 p-8 flex flex-col items-center gap-4 transition-colors"
              >
                <span className="w-16 h-16 rounded-sm bg-zinc-950/60 flex items-center justify-center text-brand-300 font-display font-bold text-3xl ring-1 ring-white/20 group-hover:ring-2 group-hover:ring-brand-500 transition-all">R</span>
                <div className="text-center">
                  <span className="font-display block text-white text-lg font-semibold tracking-[0.04em] uppercase">Radiacor</span>
                  <span className="block text-zinc-400 text-xs mt-1">Radiadores multimarca</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP DE BANNERS: aparece al entrar (una vez por sesion) si hay
          banners activos cargados desde /admin/banners. Al cerrarlo pasa a
          vivir como carrusel fijo, ver mas abajo. */}
      {mostrarPopupBanners && banners.length > 0 && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-6 bg-zinc-950/90 backdrop-blur-sm">
          <div className={`relative max-w-lg w-full aspect-[4/3] overflow-hidden shadow-2xl transition-all duration-500 ease-out ${entradaPopup ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            <Image
              src={`${BANNERS_STORAGE_URL}/${banners[indiceBanner].imagen_path}`}
              alt={banners[indiceBanner].titulo}
              fill
              priority
              sizes="512px"
              className={`object-cover transition-transform duration-[7000ms] ease-out ${entradaPopup ? 'scale-100' : 'scale-110'}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

            <span className="absolute top-4 left-4 bg-brand-600 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-sm">
              Oferta
            </span>

            <button
              onClick={cerrarPopupBanners}
              aria-label="Cerrar"
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white border border-white/30 rounded-full transition-colors"
            >
              ✕
            </button>

            <div className="absolute left-5 right-5 bottom-5">
              <button
                onClick={() => irABanner(banners[indiceBanner])}
                className={`block w-full text-left ${banners[indiceBanner].link_url ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <h3 className="text-white text-xl font-semibold mb-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">{banners[indiceBanner].titulo}</h3>
                {banners[indiceBanner].texto && (
                  <p className="text-white/85 text-sm mb-3">{banners[indiceBanner].texto}</p>
                )}
                {banners[indiceBanner].link_url && (
                  <span className="inline-block bg-white text-zinc-900 text-[11px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-sm">
                    Ver más
                  </span>
                )}
              </button>
              {banners.length > 1 && (
                <div className="flex items-center gap-1.5 mt-3">
                  {banners.map((b, i) => (
                    <button
                      key={b.id}
                      onClick={() => setIndiceBanner(i)}
                      aria-label={`Ver banner ${i + 1}`}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${i === indiceBanner ? 'bg-white' : 'bg-white/40'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BARRA DE ANUNCIOS: gris carbón, precede al header — el acento de
          marca queda para la linea fina que abre la franja de abajo. */}
      <div className="bg-zinc-950">
        <p className="max-w-7xl mx-auto px-6 py-2 text-center text-[10px] sm:text-[11px] text-zinc-300 tracking-wide">
          Envíos a todo el país <span className="text-brand-400/70 mx-2">·</span> Cotización directa por WhatsApp
        </p>
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-20 overflow-hidden shadow-sm">
        {/* Franja de marca: carbón solido con una linea fina de acento en
            naranja quemado arriba — hace de contrapunto al mismo acento
            que cierra el footer, sin cubrir toda la banda de color fuerte. */}
        <div className="relative bg-zinc-900">
          <div aria-hidden className="h-[3px] bg-gradient-to-r from-brand-700 via-brand-400 to-brand-700" />
          {/* Plano de motor: grilla de plano técnico que se apaga hacia los
              bordes — conecta con el motor animado de abajo. */}
          <div
            aria-hidden
            className="hidden lg:block pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '26px 26px',
              maskImage: 'radial-gradient(ellipse 70% 100% at 50% 0%, black 40%, transparent 90%)',
              WebkitMaskImage: 'radial-gradient(ellipse 70% 100% at 50% 0%, black 40%, transparent 90%)',
            }}
          />

          {/* Marca de agua: engranaje de línea, un guiño discreto al rubro sin
              caer en foto de stock — se recorta y se apaga en pantallas chicas. */}
          <svg
            aria-hidden
            viewBox="0 0 200 200"
            className="hidden lg:block pointer-events-none absolute -top-16 -right-16 w-64 h-64 text-white/[0.08]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
          >
            <circle cx={100} cy={100} r={52} />
            <circle cx={100} cy={100} r={14} />
            {Array.from({ length: 12 }, (_, i) => {
              const ang = (Math.PI * 2 * i) / 12
              const x1 = (100 + 52 * Math.cos(ang)).toFixed(2)
              const y1 = (100 + 52 * Math.sin(ang)).toFixed(2)
              const x2 = (100 + 68 * Math.cos(ang)).toFixed(2)
              const y2 = (100 + 68 * Math.sin(ang)).toFixed(2)
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
            })}
          </svg>

          <div className="relative max-w-7xl mx-auto px-6 py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">

              {/* Título y Logo */}
              <div className="flex items-center justify-between w-full md:w-auto gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMostrarLogin(true)}
                    aria-label={clienteSesion ? `Mi cuenta: ${clienteSesion.nombre}` : adminSesion ? 'Sesión de administrador' : 'Ingresar'}
                    className="relative p-2 -ml-2 text-white/80 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    {(clienteSesion || adminSesion) && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </button>

                  {/* Placa Swami: siempre activa, opaca cuando estas en Radiacor.
                      El logo (jpg con fondo negro solido, sin transparencia)
                      va encerrado en una placa oscura con anillo — asi el
                      fondo negro se lee como parte del badge, no como un
                      recorte que choca contra el header. Mismo tratamiento
                      que usa el selector de marca al entrar al sitio. */}
                  <Link href="/" className={`flex items-center gap-3 transition-opacity ${modo === 'swami' ? '' : 'opacity-60 hover:opacity-100'}`}>
                    <span className="w-11 h-11 md:h-14 md:w-14 rounded-sm bg-zinc-950/60 ring-1 ring-white/15 flex items-center justify-center overflow-hidden shrink-0">
                      <Image src="/logo.png" alt="Swami Logo" width={500} height={500} priority className="w-full h-full object-contain p-1.5" />
                    </span>
                    <div className="hidden md:flex flex-col justify-center">
                      <h1 className="font-display text-xl font-semibold tracking-[0.04em] text-white uppercase leading-tight">
                        Swami Autopartes
                      </h1>
                      <span className="text-[10px] text-brand-200 tracking-[0.3em] uppercase opacity-90">
                        Distribuidor Mayorista
                      </span>
                    </div>
                  </Link>

                  <div className="hidden md:block w-px h-10 bg-white/25" />

                  {/* Placa Radiacor: mismo badge que Swami (mismo tamaño, radio
                      y anillo) para que las dos marcas se sientan una familia
                      visual, aunque Radiacor todavia no tenga logo propio. */}
                  <Link href="/radiacor" className={`flex items-center gap-3 transition-opacity ${modo === 'radiacor' ? '' : 'opacity-60 hover:opacity-100'}`}>
                    <span className="w-11 h-11 md:h-14 md:w-14 rounded-sm bg-zinc-950/60 ring-1 ring-white/15 flex items-center justify-center text-brand-300 font-display font-bold text-xl md:text-2xl shrink-0">R</span>
                    <div className="hidden md:flex flex-col justify-center">
                      <span className="font-display text-xl font-semibold tracking-[0.04em] text-white uppercase leading-tight">
                        Radiacor
                      </span>
                      <span className="text-[10px] text-brand-200 tracking-[0.3em] uppercase opacity-90">
                        Radiadores Multimarca
                      </span>
                    </div>
                  </Link>
                </div>

                <button
                  onClick={() => setMostrarCarrito(true)}
                  className="md:hidden relative p-2 text-white/80 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  {carrito.length > 0 && (
                    <span className="absolute top-0 right-0 bg-white text-brand-700 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {carrito.reduce((acc, item) => acc + item.cantidad, 0)}
                    </span>
                  )}
                </button>
              </div>

              {/* Navegación */}
              <nav className="hidden md:flex items-center gap-8">
                <button onClick={irAInicio} className="text-[11px] uppercase tracking-[0.15em] text-white/80 hover:text-white transition-colors">
                  Inicio
                </button>
                <button onClick={irACatalogo} className="text-[11px] uppercase tracking-[0.15em] text-white/80 hover:text-white transition-colors">
                  Catálogo
                </button>
              </nav>

              {/* Carrito Desktop (el buscador bajo a la fila de filtros) */}
              <div className="flex gap-4 items-center">
                <button
                  onClick={() => setMostrarCarrito(true)}
                  className="hidden md:flex relative items-center justify-center bg-white/15 border border-white/30 p-3 rounded-sm hover:bg-white/25 hover:border-white/50 transition-all group min-w-[46px]"
                >
                  <svg className="w-5 h-5 text-white/80 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  {carrito.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-white text-brand-700 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                      {carrito.reduce((acc, item) => acc + item.cantidad, 0)}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Franja de filtros: blanca, separada de la banda naranja solo por
            el cambio de color — sigue el mismo patron que el resto del
            sitio para delimitar secciones. Aca vive el buscador (dividido
            en Codigo / Descripcion) junto con los demas filtros. */}
        <div className="bg-white border-b-2 border-zinc-300">
          <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row md:flex-wrap gap-4">
            <div className="flex-1 min-w-[160px] flex flex-col gap-1.5">
              <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 px-0.5">Código</span>
              <input
                type="text"
                placeholder="Propio o de proveedor..."
                value={busquedaCodigo}
                onChange={(e) => handleBusquedaCodigo(e.target.value)}
                className="bg-white border border-zinc-400 text-zinc-800 text-sm px-4 py-2.5 rounded-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 w-full transition-all placeholder:text-zinc-400 placeholder:normal-case placeholder:tracking-normal uppercase tracking-wider text-[11px]"
              />
            </div>

            <div className="flex-[2] min-w-[200px] flex flex-col gap-1.5">
              <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 px-0.5">Descripción</span>
              <input
                type="text"
                placeholder="Qué repuesto buscás..."
                value={busquedaDescripcion}
                onChange={(e) => handleBusquedaDescripcion(e.target.value)}
                className="bg-white border border-zinc-400 text-zinc-800 text-sm px-4 py-2.5 rounded-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 w-full transition-all placeholder:text-zinc-400 placeholder:normal-case placeholder:tracking-normal uppercase tracking-wider text-[11px]"
              />
            </div>

            <div className="flex-1 min-w-[140px] flex flex-col gap-1.5">
              <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 px-0.5">Marca Producto</span>
              <select
                value={marcaFiltro}
                onChange={(e) => handleMarca(e.target.value)}
                className="bg-white border border-zinc-400 text-zinc-800 text-sm px-4 py-2.5 rounded-sm focus:outline-none focus:border-brand-500/50 appearance-none cursor-pointer w-full transition-all uppercase tracking-wider text-[11px]"
              >
                <option value="">Todos</option>
                {marcas.filter(m => m.id !== 0).map(m => (
                  <option key={m.id} value={m.id}>{m.descripcion}</option>
                ))}
              </select>
            </div>

            {modo === 'swami' && (
              <>
                <div className="flex-1 min-w-[140px] flex flex-col gap-1.5">
                  <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 px-0.5">Rubro</span>
                  <select
                    value={categoriaFiltro}
                    onChange={(e) => handleCategoria(e.target.value)}
                    className="bg-white border border-zinc-400 text-zinc-800 text-sm px-4 py-2.5 rounded-sm focus:outline-none focus:border-brand-500/50 appearance-none cursor-pointer w-full transition-all uppercase tracking-wider text-[11px]"
                  >
                    <option value="">Todos</option>
                    {categoriasGenerales.map(c => (
                      <option key={c.id} value={c.id}>{c.descripcion}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[140px] flex flex-col gap-1.5">
                  <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 px-0.5">Subrubro</span>
                  <select
                    value={rubroFiltro}
                    onChange={(e) => handleRubro(e.target.value)}
                    className="bg-white border border-zinc-400 text-zinc-800 text-sm px-4 py-2.5 rounded-sm focus:outline-none focus:border-brand-500/50 appearance-none cursor-pointer w-full transition-all uppercase tracking-wider text-[11px]"
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
              </>
            )}

            <div className="flex-1 min-w-[140px] flex flex-col gap-1.5">
              <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 px-0.5">Marca Auto</span>
              <select
                value={vehiculoFiltro}
                onChange={(e) => handleVehiculo(e.target.value)}
                className="bg-white border border-zinc-400 text-zinc-800 text-sm px-4 py-2.5 rounded-sm focus:outline-none focus:border-brand-500/50 appearance-none cursor-pointer w-full transition-all uppercase tracking-wider text-[11px]"
              >
                <option value="">Todos</option>
                {marcasAuto.map(m => (
                  <option key={m.id} value={m.id}>{m.descripcion}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[140px] flex flex-col gap-1.5">
              <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 px-0.5">Modelo</span>
              <select
                value={modeloAutoFiltro}
                onChange={(e) => handleModeloAuto(e.target.value)}
                disabled={!vehiculoFiltro}
                className="bg-white border border-zinc-400 text-zinc-800 text-sm px-4 py-2.5 rounded-sm focus:outline-none focus:border-brand-500/50 appearance-none cursor-pointer w-full transition-all uppercase tracking-wider text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
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
              className="text-[11px] uppercase tracking-wider text-zinc-600 border border-zinc-400 px-4 py-2.5 hover:border-brand-500 hover:text-brand-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-zinc-400 disabled:hover:text-zinc-500 shrink-0 self-end"
            >
              Limpiar Filtros
            </button>
          </div>
          </div>
        </div>
      </header>

      {/* FRANJA DE CONFIANZA: tono neutro apenas tibio, intermedio entre el
          header solido y el blanco del catalogo — el color queda solo en
          los iconos, no en toda la banda. */}
      <div className="border-b border-brand-200 bg-brand-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-2 text-[10px] uppercase tracking-[0.15em] font-medium text-zinc-600">
          <span className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Envíos a todo el país
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            Cotización directa por WhatsApp
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            Stock real, actualizado
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Atención directa, sin intermediarios
          </span>
        </div>
      </div>

      {/* TARJETA FLOTANTE DE BANNERS: vive anclada abajo a la derecha
          despues de que se cierra el popup de entrada, hasta que se cierra
          tambien. Al ser "fixed" no empuja el catalogo hacia abajo. */}
      {mostrarCarruselBanners && banners.length > 0 && (
        <div
          className={`fixed bottom-5 right-5 z-40 w-64 bg-white rounded-md shadow-2xl overflow-hidden transition-all duration-500 ease-out ${entradaCarrusel ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <div className="relative aspect-video bg-zinc-100">
            <Image
              src={`${BANNERS_STORAGE_URL}/${banners[indiceBanner].imagen_path}`}
              alt={banners[indiceBanner].titulo}
              fill
              priority
              sizes="256px"
              className="object-cover"
            />
            <button
              onClick={cerrarCarruselBanners}
              aria-label="Cerrar"
              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors text-xs"
            >
              ✕
            </button>
          </div>
          <button
            onClick={() => irABanner(banners[indiceBanner])}
            className={`block w-full text-left px-3.5 pt-2.5 pb-1.5 ${banners[indiceBanner].link_url ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <p className="text-[13px] font-semibold text-zinc-900 truncate">{banners[indiceBanner].titulo}</p>
            {banners[indiceBanner].texto && (
              <p className="text-[11px] text-zinc-500 truncate">{banners[indiceBanner].texto}</p>
            )}
          </button>
          {banners.length > 1 && (
            <div className="flex items-center gap-1.5 px-3.5 pb-3">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => setIndiceBanner(i)}
                  aria-label={`Ver banner ${i + 1}`}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === indiceBanner ? 'bg-brand-500' : 'bg-zinc-200'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* GRILLA DE PRODUCTOS */}
      <section ref={catalogoRef} className="max-w-7xl mx-auto px-6 py-12 scroll-mt-24">
        <div className="flex justify-between items-center mb-8 bg-brand-600 text-white text-[10px] uppercase tracking-[0.2em] px-4 py-2.5">
          <span className="font-medium">{modo === 'radiacor' ? 'Inventario Radiacor' : 'Inventario Swami'}</span>
          <div className="flex items-center gap-6">
            <span>{totalRegistros} repuestos</span>
            <div className="flex items-center gap-1 border border-white/30 rounded-sm overflow-hidden">
              <button
                onClick={() => setVistaLista(false)}
                aria-label="Ver en grilla"
                className={`p-2 transition-colors ${!vistaLista ? 'bg-white text-brand-600' : 'text-white/70 hover:text-white'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" /></svg>
              </button>
              <button
                onClick={() => setVistaLista(true)}
                aria-label="Ver en lista"
                className={`p-2 transition-colors ${vistaLista ? 'bg-white text-brand-600' : 'text-white/70 hover:text-white'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            </div>
          </div>
        </div>

        {cargando ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: porPagina }).map((_, i) => (
              <div key={i} className="border border-zinc-300 bg-white p-5 animate-pulse">
                <div className="aspect-square w-full bg-zinc-200 mb-5" />
                <div className="h-2 w-1/3 bg-zinc-200 mb-3" />
                <div className="h-3 w-full bg-zinc-200 mb-2" />
                <div className="h-3 w-2/3 bg-zinc-200 mb-4" />
                <div className="h-5 w-1/2 bg-zinc-200" />
              </div>
            ))}
          </div>
        ) : errorCarga ? (
          <div className="text-center py-32 text-zinc-400 font-light tracking-wide">
            No pudimos cargar el catálogo. Revisá tu conexión y volvé a intentar.
          </div>
        ) : repuestos.length === 0 ? (
          <div className="text-center py-32 text-zinc-400 font-light tracking-wide">No se encontraron resultados para tu búsqueda.</div>
        ) : (
          <>
            {vistaLista ? (
            <div className="overflow-x-auto border border-zinc-300 bg-white shadow-sm">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-brand-50 border-b-2 border-brand-300 text-[10px] uppercase tracking-[0.2em] text-brand-900">
                    <th className="text-left font-semibold px-4 py-3">Código Original</th>
                    <th className="text-left font-semibold px-4 py-3">Código Interno</th>
                    <th className="text-left font-semibold px-4 py-3">Descripción</th>
                    <th className="text-left font-semibold px-4 py-3 hidden md:table-cell">Marca</th>
                    <th className="text-left font-semibold px-4 py-3 hidden md:table-cell">Rubro</th>
                    <th className="text-right font-semibold px-4 py-3">Precio</th>
                    <th className="text-right font-semibold px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {repuestos.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setArticuloSeleccionado(item)}
                      className="border-b border-zinc-300 last:border-b-0 odd:bg-white even:bg-zinc-50 hover:bg-brand-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-brand-600 font-mono text-[11px] whitespace-nowrap">
                        {item.codigo_proveedor && !proveedoresSinRef.includes(item.id_proveedor ?? -1) ? item.codigo_proveedor : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 font-mono text-[11px] whitespace-nowrap">{item.codigo}</td>
                      <td className="px-4 py-3 text-zinc-900 font-light">{descripcionMostrada(item)}</td>
                      <td className="px-4 py-3 text-zinc-500 text-[11px] uppercase tracking-wider hidden md:table-cell">
                        {item.marcas?.descripcion && item.marcas.descripcion !== 'Sin Marca' ? item.marcas.descripcion : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-[11px] uppercase tracking-wider hidden md:table-cell">
                        {item.rubros?.descripcion ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-900 font-light whitespace-nowrap">
                        ${item.precio_1.toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setArticuloSeleccionado(item) }}
                            aria-label="Ver detalle"
                            className="p-2 text-zinc-500 hover:text-brand-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          </button>
                          <button
                            onClick={(e) => agregarAlCarrito(item, e)}
                            className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3 py-2 transition-all whitespace-nowrap"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            Agregar
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
                  className="group relative border border-zinc-300 bg-white p-5 shadow-sm hover:border-brand-500/30 hover:shadow-md hover:shadow-brand-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    {/* Contenedor de Imagen con URL Dinámica Supabase */}
                    <div className="relative aspect-square w-full bg-zinc-50 border border-zinc-300/50 mb-5 flex items-center justify-center overflow-hidden group-hover:border-brand-500/20 transition-colors">
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
                        <svg className="w-8 h-8 text-zinc-200 group-hover:text-brand-500/20 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    </div>

                    <div className="flex justify-between items-start gap-2 mb-3">
                      <span className="text-[10px] text-brand-600 font-mono tracking-wider">
                        {item.codigo}
                      </span>
                      <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-400 truncate max-w-[100px]">
                        {item.marcas?.descripcion !== 'Sin Marca' ? item.marcas?.descripcion : ''}
                      </span>
                    </div>

                    <h2 className="text-sm font-light text-zinc-900 leading-relaxed mb-2 line-clamp-2 group-hover:text-zinc-900 transition-colors">
                      {descripcionMostrada(item)}
                    </h2>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-300/50 pt-4 mt-4">
                    <span className="text-lg font-light text-zinc-900 tracking-wide group-hover:text-brand-600 transition-colors">
                      ${item.precio_1.toLocaleString('es-AR')}
                    </span>
                    <button
                      onClick={(e) => agregarAlCarrito(item, e)}
                      className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] font-semibold text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 transition-all shrink-0"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      Agregar
                    </button>
                  </div>
                </article>
              ))}
            </div>
            )}

            {/* CONTROLES DE PAGINACIÓN */}
            {totalPaginas > 1 && (
              <div className="flex justify-center items-center gap-6 mt-16 pt-8 border-t border-zinc-300">
                <button
                  onClick={() => cambiarPagina(paginaActual - 1)}
                  disabled={paginaActual === 1}
                  className="px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] bg-transparent border border-zinc-300 text-zinc-600 hover:border-brand-500/50 hover:text-brand-600 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                >
                  Anterior
                </button>

                <span className="text-[10px] font-mono tracking-widest text-zinc-400">
                  <strong className="text-zinc-900 font-normal">{paginaActual}</strong> / {totalPaginas}
                </span>

                <button
                  onClick={() => cambiarPagina(paginaActual + 1)}
                  disabled={paginaActual === totalPaginas}
                  className="px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] bg-transparent border border-zinc-300 text-zinc-600 hover:border-brand-500/50 hover:text-brand-600 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <MotorExplosivo />

      {/* MODAL DE PRODUCTO (VISTA AMPLIADA) */}
      {articuloSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity"
            onClick={() => setArticuloSeleccionado(null)}
          />
          <div className="relative bg-white border border-zinc-300 w-full max-w-4xl flex flex-col md:flex-row shadow-2xl max-h-[90vh] overflow-hidden">

            {/* Mitad Imagen */}
            <div className="w-full md:w-1/2 bg-zinc-100 border-b md:border-b-0 md:border-r border-zinc-300 aspect-square md:aspect-auto flex items-center justify-center relative p-8">
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
                <svg className="w-16 h-16 text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-[10px] text-zinc-300 tracking-[0.2em] uppercase">Imagen no disponible</span>
              </div>
            </div>

            {/* Mitad Info */}
            <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col overflow-y-auto">
              <button
                onClick={() => setArticuloSeleccionado(null)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-brand-500 transition-colors p-2"
              >
                ✕
              </button>

              <div className="mb-8 mt-4 md:mt-0">
                <div className="flex gap-4 mb-6">
                  <span className="px-3 py-1 bg-brand-500/10 border border-brand-500/20 text-[10px] font-mono text-brand-600 tracking-wider">
                    CÓD: {articuloSeleccionado.codigo}
                  </span>
                  {articuloSeleccionado.codigo_proveedor && !proveedoresSinRef.includes(articuloSeleccionado.id_proveedor ?? -1) && (
                    <span className="px-3 py-1 bg-zinc-100 border border-zinc-300 text-[10px] font-mono text-zinc-500 tracking-wider">
                      REF: {articuloSeleccionado.codigo_proveedor}
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-light text-zinc-900 leading-snug mb-4">
                  {descripcionMostrada(articuloSeleccionado)}
                </h2>

                <div className="flex flex-col gap-2 text-xs text-zinc-500 uppercase tracking-widest mt-6">
                  {articuloSeleccionado.marcas?.descripcion && (
                    <p>Marca: <span className="text-zinc-900">{articuloSeleccionado.marcas.descripcion}</span></p>
                  )}
                  {articuloSeleccionado.rubros?.categorias_generales?.descripcion && (
                    <p>Rubro: <span className="text-zinc-900">{articuloSeleccionado.rubros.categorias_generales.descripcion}</span></p>
                  )}
                  {articuloSeleccionado.rubros?.descripcion && (
                    <p>Subrubro: <span className="text-zinc-900">{articuloSeleccionado.rubros.descripcion}</span></p>
                  )}
                  {Object.entries(
                    vehiculosCompatibles.reduce<Record<string, string[]>>((acc, v) => {
                      if (!v.marca) return acc
                      acc[v.marca] = [...(acc[v.marca] ?? []), v.modelo]
                      return acc
                    }, {})
                  ).map(([marca, modelos]) => (
                    <p key={marca}>Marca Auto: <span className="text-zinc-900">{marca}</span> — Modelo: <span className="text-zinc-900">{modelos.join(', ')}</span></p>
                  ))}
                </div>
              </div>

              <div className="mt-auto pt-8 border-t border-zinc-300 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] text-brand-600 uppercase tracking-widest mb-1">Precio Mayorista</span>
                  <span className="text-3xl font-light text-zinc-900 tracking-wide">
                    ${articuloSeleccionado.precio_1.toLocaleString('es-AR')}
                  </span>
                </div>

                <button
                  onClick={() => agregarAlCarrito(articuloSeleccionado)}
                  className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-4 text-xs uppercase tracking-[0.2em] font-medium transition-colors"
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
          <div className="fixed top-0 left-0 h-full w-full max-w-sm bg-zinc-50 border-r border-zinc-300 z-50 flex flex-col shadow-2xl">
            <div className="p-8 border-b border-zinc-300 flex justify-between items-center bg-zinc-50/50">
              <h2 className="text-sm font-light tracking-[0.3em] text-zinc-900 uppercase">
                {clienteSesion || adminSesion ? 'Mi cuenta' : 'Ingresar'}
              </h2>
              <button onClick={() => setMostrarLogin(false)} className="text-zinc-400 hover:text-brand-500 transition-colors p-2">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              {clienteSesion ? (
                <div className="space-y-6">
                  <p className="text-sm text-zinc-600">
                    Hola, <span className="text-zinc-900">{clienteSesion.nombre}</span>.
                  </p>
                  {clienteSesion.descuento_pct > 0 && (
                    <p className="text-xs text-brand-600 uppercase tracking-widest">
                      Descuento asignado: {clienteSesion.descuento_pct}%
                    </p>
                  )}
                  <button
                    onClick={handleLogoutSesion}
                    className="w-full border border-zinc-300 text-zinc-600 py-3 text-xs uppercase tracking-widest hover:border-brand-500/50 hover:text-brand-600 transition-colors"
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : adminSesion ? (
                <div className="space-y-6">
                  <p className="text-sm text-zinc-600">
                    Sesión de <span className="text-zinc-900">administrador</span> activa.
                  </p>
                  <Link
                    href="/admin"
                    className="block text-center w-full bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium uppercase tracking-[0.2em] py-4 transition-colors"
                  >
                    Ir al panel administrador
                  </Link>
                  <button
                    onClick={handleLogoutSesion}
                    className="w-full border border-zinc-300 text-zinc-600 py-3 text-xs uppercase tracking-widest hover:border-brand-500/50 hover:text-brand-600 transition-colors"
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
                      className="w-full bg-white border border-zinc-300 rounded-sm px-4 py-3 text-sm text-zinc-800 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Contraseña</label>
                    <input
                      type="password"
                      required
                      value={passwordLogin}
                      onChange={(e) => setPasswordLogin(e.target.value)}
                      className="w-full bg-white border border-zinc-300 rounded-sm px-4 py-3 text-sm text-zinc-800 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                  {errorLogin && <p className="text-xs text-red-500">{errorLogin}</p>}
                  <button
                    type="submit"
                    disabled={cargandoLogin}
                    className="w-full bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium uppercase tracking-[0.2em] py-4 transition-colors disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed"
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
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-zinc-50 border-l border-zinc-300 z-50 flex flex-col shadow-2xl">
            <div className="p-8 border-b border-zinc-300 flex justify-between items-center bg-zinc-50/50">
              <h2 className="text-sm font-light tracking-[0.3em] text-zinc-900 uppercase">Tu Cotización</h2>
              <button onClick={() => setMostrarCarrito(false)} className="text-zinc-400 hover:text-brand-500 transition-colors p-2">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {carrito.length === 0 ? (
                <div className="text-center text-zinc-400 text-[10px] mt-10 uppercase tracking-[0.2em]">La lista está vacía</div>
              ) : (
                carrito.map(item => (
                  <div key={item.id} className="flex flex-col gap-4 p-5 bg-zinc-50 border border-zinc-300/50 hover:border-brand-500/30 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="pr-4">
                        <span className="text-[10px] text-brand-600 font-mono block mb-2">{item.codigo}</span>
                        <p className="text-sm font-light text-zinc-900 leading-relaxed">{descripcionMostrada(item)}</p>
                      </div>
                      <button onClick={() => removerDelCarrito(item.id)} className="text-zinc-300 hover:text-red-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>

                    <div className="flex justify-between items-center mt-2 pt-4 border-t border-zinc-300">
                      <div className="flex items-center gap-4 border border-zinc-300 p-1">
                        <button onClick={() => cambiarCantidad(item.id, -1)} className="px-3 text-zinc-500 hover:text-brand-500 transition-colors">-</button>
                        <span className="text-xs font-mono w-4 text-center text-zinc-900">{item.cantidad}</span>
                        <button onClick={() => cambiarCantidad(item.id, 1)} className="px-3 text-zinc-500 hover:text-brand-500 transition-colors">+</button>
                      </div>
                      <span className="text-sm font-light text-zinc-900 tracking-wide">${(item.precio_1 * item.cantidad).toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-8 bg-zinc-50 border-t border-zinc-300">
              <div className="flex justify-between items-end mb-8">
                <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em]">Total Estimado</span>
                <span className="text-2xl font-light text-brand-600 tracking-wide">${totalCarrito.toLocaleString('es-AR')}</span>
              </div>

              <button
                onClick={enviarWhatsApp}
                disabled={carrito.length === 0}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium uppercase tracking-[0.2em] py-5 transition-colors flex items-center justify-center gap-2 disabled:bg-zinc-100 disabled:text-zinc-300 disabled:cursor-not-allowed"
              >
                Solicitar Cotización
              </button>
            </div>
          </div>
        </>
      )}

      {/* FOOTER: banda carbón que cierra el sitio con la misma linea de
          acento naranja quemado que abre el header. */}
      <footer className="relative bg-zinc-900 mt-8">
        <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600" />
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-[10px] text-zinc-400 uppercase tracking-[0.2em]">
            Swami Distribuidora Mayorista {modo === 'radiacor' && '— Radiacor'}
          </span>
          <Link
            href="/admin"
            aria-label="Acceso administrador"
            className="text-zinc-500 hover:text-brand-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15a3 3 0 100-6 3 3 0 000 6z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
          </Link>
        </div>
      </footer>
    </main>
  )
}
