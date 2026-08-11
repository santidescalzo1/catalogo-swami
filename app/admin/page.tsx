'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase/client'

interface FilaCategoria {
  ID: number;
  Descripción: string | number;
}

interface FilaArticulo {
  ID: number;
  Código?: string | number;
  Descripción?: string | number;
  'Código Proveedor'?: string | number;
  'ID Proveedor'?: number;
  'ID Rubro'?: number;
  'ID Marca'?: number;
  'Precio 1'?: number;
  Existencia?: number;
  Ubicación?: string | number;
  Oferta?: boolean | string | number;
}

export default function Home() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [progress, setProgress] = useState<string>('')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
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
      
      const hojaArticulos = workbook.Sheets['Articulo']
      const hojaMarcas = workbook.Sheets['Marca']
      const hojaRubros = workbook.Sheets['Rubro']

      if (!hojaArticulos || !hojaMarcas || !hojaRubros) {
        alert("Error: Faltan hojas en el Excel.")
        setIsProcessing(false)
        return
      }

      const articulosExcel = XLSX.utils.sheet_to_json<FilaArticulo>(hojaArticulos)
      const marcasExcel = XLSX.utils.sheet_to_json<FilaCategoria>(hojaMarcas)
      const rubrosExcel = XLSX.utils.sheet_to_json<FilaCategoria>(hojaRubros)

      setStatus('Sincronizando Marcas y Rubros...')
      
      const marcas = marcasExcel.map(m => ({ id: m.ID, descripcion: String(m.Descripción) }))
      const { error: errorMarcas } = await supabase.from('marcas').upsert(marcas)
      if (errorMarcas) throw errorMarcas

      const rubros = rubrosExcel.map(r => ({ id: r.ID, descripcion: String(r.Descripción) }))
      const { error: errorRubros } = await supabase.from('rubros').upsert(rubros)
      if (errorRubros) throw errorRubros

      setStatus(`Preparando ${articulosExcel.length} artículos...`)

      const articulos = articulosExcel.map(a => ({
        id: a.ID,
        codigo: String(a.Código || ''),
        descripcion: String(a.Descripción || ''),
        codigo_proveedor: String(a['Código Proveedor'] || ''),
        id_proveedor: Number(a['ID Proveedor']) || 0,
        id_rubro: Number(a['ID Rubro']) || 0,
        id_marca: Number(a['ID Marca']) || 0,
        precio_1: Number(a['Precio 1']) || 0,
        existencia: Number(a.Existencia) || 0,
        ubicacion: String(a.Ubicación || ''),
        oferta: Boolean(a.Oferta)
      }))

      setStatus('Subiendo catálogo masivo a la nube...')

      const chunkSize = 1000
      for (let i = 0; i < articulos.length; i += chunkSize) {
        const chunk = articulos.slice(i, i + chunkSize)
        const { error: errorArticulos } = await supabase.from('articulos').upsert(chunk)
        if (errorArticulos) throw errorArticulos
        
        setProgress(`Subidos ${Math.min(i + chunkSize, articulos.length)} de ${articulos.length}...`)
      }

      setStatus('¡Catálogo sincronizado con éxito!')
      setProgress('')
      alert('¡Los 4.125 repuestos de Swami Autopartes ya están online!')

   } catch (error) {
      console.error("Error completo extraído:", error)
      
      // Desarmamos el error de forma segura y estricta para TypeScript
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
        <div className="text-center relative">
          <h1 className="text-3xl font-light tracking-tight text-white mb-2">Swami Autopartes</h1>
          <p className="text-sm text-zinc-500 uppercase tracking-widest">Panel de Sincronización</p>
          <button
            onClick={handleLogout}
            className="absolute top-0 right-0 text-xs text-zinc-600 hover:text-orange-500 transition-colors uppercase tracking-widest"
          >
            Cerrar sesión
          </button>
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
          <label className="block text-sm font-medium text-zinc-400 mb-4">
            Importar lista de precios definitiva
          </label>
          
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