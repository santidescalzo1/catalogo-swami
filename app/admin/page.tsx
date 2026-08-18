'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase/client'

// Formato del Excel que manda el sistema de facturación: una sola hoja,
// una fila por artículo, columnas en minúscula. "rubro"/"marca"/"codprov"
// son abreviaturas propias de ese sistema (no IDs) — se resuelven contra
// marcas.codigo_excel / rubros.codigo_excel / proveedores.codigo_excel,
// que se poblaron una vez a partir de los artículos ya cargados (ver
// supabase/codigo-excel-*.sql). Si aparece una abreviatura nueva que
// nunca se vio, el artículo se carga igual pero sin esa clasificación,
// para completarla a mano en "Editar artículos individuales".
interface FilaArticuloExcel {
  codigo?: string | number;
  descrip?: string;
  descrip2?: string;
  descrip3?: string;
  codprov?: string;
  artprov?: string | number;
  costo?: number | string;
  coef?: number | string;
  rubro?: string;
  marca?: string;
}

// Diccionario de abreviaturas -> palabra completa, extraído de los pares
// descripcion/descripcion_estandarizada que ya se cargaron a mano en el
// panel admin (sin ambigüedad: cada abreviatura siempre se expandió igual).
// Se aplica solo a artículos NUEVOS al insertarlos — no toca la
// descripción de artículos que ya existen.
const REGLAS_ESTANDARIZACION: [string, string][] = [
  ['ELECTROV.', 'ELECTROVALVULA'],
  ['PRECAL.', 'PRECALENTAMIENTO'],
  ['DISTRIB.', 'DISTRIBUCION'],
  ['CALEF.', 'CALEFACCION'],
  ['S/DEP.', 'S/DEPOSITO'],
  ['C/DEP.', 'C/DEPOSITO'],
  ['P/BRAZ.', 'P/BRAZO'],
  ['CHEV.', 'CHEVROLET'],
  ['PEUG.', 'PEUGEOT'],
  ['CITR.', 'CITROEN'],
  ['ORIG.', 'ORIGINAL'],
  ['ELECT.', 'ELECTRICO'],
  ['IMP.', 'IMPORTADO'],
  ['JGO.', 'JUEGO'],
  ['REF.', 'REFRIGERANTE'],
  ['COMB.', 'COMBUSTIBLE'],
  ['LIQ.', 'LIQUIDO'],
  ['DEP.', 'DEPOSITO'],
  ['NAC.', 'NACIONAL'],
  ['HIDR.', 'HIDRAULICA'],
  ['REN.', 'RENAULT'],
  ['DIR.', 'DIRECCION'],
  ['AUX.', 'AUXILIAR'],
  ['INF.', 'INFERIOR'],
  ['ACEL.', 'ACELERADOR'],
  ['MULT.', 'MULTIPLE'],
  ['ADM.', 'ADMISION'],
]
REGLAS_ESTANDARIZACION.sort((a, b) => b[0].length - a[0].length)

function estandarizarAutomatico(descripcion: string): string {
  let resultado = descripcion
  for (const [abreviatura, expansion] of REGLAS_ESTANDARIZACION) {
    resultado = resultado.split(abreviatura).join(expansion)
  }
  return resultado
}

export default function Home() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [progress, setProgress] = useState<string>('')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setIsProcessing(true)
    setStatus('Leyendo Excel...')
    setProgress('')

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const hoja = workbook.Sheets[workbook.SheetNames[0]]

      if (!hoja) {
        alert('Error: el Excel no tiene ninguna hoja.')
        setIsProcessing(false)
        return
      }

      const filas = XLSX.utils.sheet_to_json<FilaArticuloExcel>(hoja)

      if (filas.length === 0 || !('codigo' in filas[0])) {
        alert('Error: no se encontró la columna "codigo" en la primera hoja. ¿Es el formato de Excel correcto?')
        setIsProcessing(false)
        return
      }

      setStatus('Cargando tablas de referencia...')

      const [{ data: dataMarcas }, { data: dataRubros }, { data: dataProveedores }] = await Promise.all([
        supabase.from('marcas').select('id, codigo_excel'),
        supabase.from('rubros').select('id, codigo_excel'),
        supabase.from('proveedores').select('id, codigo_excel'),
      ])

      const mapaMarcas = new Map((dataMarcas ?? []).filter(m => m.codigo_excel).map(m => [m.codigo_excel as string, m.id]))
      const mapaRubros = new Map((dataRubros ?? []).filter(r => r.codigo_excel).map(r => [r.codigo_excel as string, r.id]))
      const mapaProveedores = new Map((dataProveedores ?? []).filter(p => p.codigo_excel).map(p => [p.codigo_excel as string, p.id]))

      // Traído en páginas: Supabase limita cada respuesta a 1000 filas por
      // default, y con ~4125 artículos un solo select() se recortaba en
      // silencio — eso hizo que miles de artículos existentes se
      // confundieran con "nuevos" y el insert chocara contra el código
      // único duplicado.
      const codigosExistentes = new Set<string>()
      {
        const pageSize = 1000
        let desde = 0
        for (;;) {
          const { data, error } = await supabase.from('articulos').select('codigo').range(desde, desde + pageSize - 1)
          if (error) throw error
          if (!data || data.length === 0) break
          data.forEach(a => codigosExistentes.add(a.codigo))
          if (data.length < pageSize) break
          desde += pageSize
        }
      }

      setStatus('Procesando artículos...')

      const actualizaciones: { codigo: string; precio_1: number }[] = []
      const nuevos: Record<string, unknown>[] = []
      let sinRubro = 0
      let sinMarca = 0

      for (const fila of filas) {
        const codigo = String(fila.codigo ?? '').trim()
        if (!codigo) continue

        const costo = Number(fila.costo) || 0
        const coef = Number(fila.coef) || 1
        const precio_1 = Math.round(costo * coef * 100) / 100

        if (codigosExistentes.has(codigo)) {
          // Artículo existente: acá SOLO se toca el precio. No se manda
          // descripcion/marca/rubro/proveedor — un upsert de Postgres pisa
          // cualquier columna que le pases, y esas pueden tener
          // correcciones manuales hechas en el panel de edición.
          actualizaciones.push({ codigo, precio_1 })
        } else {
          // Artículo nuevo: se inserta completo. "descrip"+"descrip2" son
          // la misma descripción cortada en dos por un límite de largo del
          // sistema viejo — se reconstruyen concatenadas.
          const descripcion = [fila.descrip, fila.descrip2, fila.descrip3]
            .map(t => (t ?? '').toString().trim())
            .filter(Boolean)
            .join(' ')

          const marcaTexto = (fila.marca ?? '').toString().trim().toUpperCase()
          const rubroTexto = (fila.rubro ?? '').toString().trim().toUpperCase()
          const provTexto = (fila.codprov ?? '').toString().trim().toUpperCase()

          const id_marca = mapaMarcas.get(marcaTexto) ?? 0
          const id_rubro = mapaRubros.get(rubroTexto) ?? 0
          const id_proveedor = mapaProveedores.get(provTexto) ?? 0
          if (id_marca === 0) sinMarca++
          if (id_rubro === 0) sinRubro++

          const estandarizada = estandarizarAutomatico(descripcion)

          nuevos.push({
            codigo,
            descripcion,
            descripcion_estandarizada: estandarizada !== descripcion ? estandarizada : null,
            codigo_proveedor: String(fila.artprov ?? '').trim() || null,
            id_proveedor,
            id_marca,
            id_rubro,
            precio_1,
            oferta: false,
          })
        }
      }

      setStatus(`Actualizando precios de ${actualizaciones.length} artículos...`)
      const chunkSize = 1000
      for (let i = 0; i < actualizaciones.length; i += chunkSize) {
        const chunk = actualizaciones.slice(i, i + chunkSize)
        const { error: errorPrecios } = await supabase.from('articulos').upsert(chunk, { onConflict: 'codigo' })
        if (errorPrecios) throw errorPrecios
        setProgress(`Precios: ${Math.min(i + chunkSize, actualizaciones.length)} de ${actualizaciones.length}...`)
      }

      if (nuevos.length > 0) {
        setStatus(`Agregando ${nuevos.length} artículos nuevos...`)
        const { error: errorNuevos } = await supabase.from('articulos').insert(nuevos)
        if (errorNuevos) throw errorNuevos
      }

      setStatus('¡Listo!')
      setProgress('')

      let resumen = `Precios actualizados: ${actualizaciones.length}.\nArtículos nuevos agregados: ${nuevos.length}.`
      if (nuevos.length > 0 && (sinRubro > 0 || sinMarca > 0)) {
        resumen += `\n\nDe los nuevos, ${sinRubro} quedaron sin Rubro y ${sinMarca} sin Marca reconocidos — revisalos en "Editar artículos individuales".`
      }
      alert(resumen)

    } catch (error) {
      console.error("Error completo extraído:", error)

      let errorMsg = "Error desconocido";
      if (typeof error === 'object' && error !== null) {
        const err = error as { message?: string; details?: string };
        errorMsg = err.message || err.details || JSON.stringify(err);
      } else {
        errorMsg = String(error);
      }

      setStatus('Ocurrió un error. Revisá el cartel en pantalla.')
      alert("Motivo del rechazo en base de datos:\n" + errorMsg)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="min-h-screen bg-black text-zinc-300 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-white mb-2">Swami Autopartes</h1>
            <p className="text-sm text-zinc-500 uppercase tracking-widest">Panel de Sincronización</p>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xs text-zinc-500 hover:text-orange-500 uppercase tracking-widest transition-colors">
              Ver catálogo
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs text-zinc-600 hover:text-orange-500 transition-colors uppercase tracking-widest"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        <Link
          href="/admin/articulos"
          className="block text-center text-xs text-zinc-500 hover:text-orange-500 uppercase tracking-widest border border-zinc-800 hover:border-orange-500/50 py-3 transition-colors"
        >
          Editar artículos individuales →
        </Link>

        <Link
          href="/admin/fotos"
          className="block text-center text-xs text-zinc-500 hover:text-orange-500 uppercase tracking-widest border border-zinc-800 hover:border-orange-500/50 py-3 transition-colors"
        >
          Subir fotos →
        </Link>

        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-lg shadow-2xl">
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Importar Excel del sistema de facturación
          </label>
          <p className="text-xs text-zinc-600 mb-4">
            Actualiza los precios de todos los artículos existentes (sin tocar la descripción estandarizada) y agrega automáticamente los artículos nuevos que encuentre.
          </p>

          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-medium file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700 file:cursor-pointer cursor-pointer mb-6"
          />

          <button
            onClick={handleUpload}
            disabled={!file || isProcessing}
            className="w-full flex justify-center bg-white text-black font-medium py-3 px-4 rounded-sm transition-colors hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed mb-4"
          >
            {isProcessing ? 'Procesando...' : 'Sincronizar Catálogo'}
          </button>

          {status && (
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-zinc-400 animate-pulse">
                {status}
              </p>
              {progress && (
                <p className="text-xs font-mono text-zinc-500">
                  {progress}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
