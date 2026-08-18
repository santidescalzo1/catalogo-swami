// Motor de busqueda de texto compartido entre el catalogo publico
// (components/Catalogo.tsx) y el panel de edicion de articulos
// (app/admin/articulos/page.tsx), para que ambos matcheen exactamente
// igual (incluido plural/singular) sin duplicar la logica.

// Variantes de plural/singular de una palabra para que "bujias" tambien
// encuentre "BUJIA" (y viceversa). Al ser busqueda por substring (ilike),
// buscar por el singular ya alcanza para encontrar el plural — el caso que
// faltaba era el inverso: derivar el singular a partir de un termino en
// plural. Cubre los casos regulares del castellano (-s / -es); plurales
// irregulares (luz -> luces) quedan afuera.
export function variantesPalabra(palabra: string): string[] {
  const variantes = new Set([palabra])
  const minuscula = palabra.toLowerCase()
  if (minuscula.endsWith('es') && minuscula.length > 4) variantes.add(palabra.slice(0, -2))
  if (minuscula.endsWith('s') && minuscula.length > 3) variantes.add(palabra.slice(0, -1))
  return Array.from(variantes)
}

// Aplica la busqueda de texto (multi-palabra + version normalizada para
// descripcion) acotada a una lista de columnas — asi el mismo motor de
// busqueda sirve tanto para la caja de Codigo como para la de Descripcion,
// en el catalogo publico y en el panel admin.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function aplicarBusquedaTexto(query: any, termino: string, columnas: string[], incluirNormalizada: boolean) {
  const limpio = termino.trim()
  if (limpio.length < 2) return query

  const palabras = limpio.split(/\s+/)

  if (palabras.length === 1) {
    const variantes = variantesPalabra(limpio)
    const alternativas = variantes.flatMap(v => columnas.map(c => `${c}.ilike.%${v}%`))
    if (incluirNormalizada) {
      variantes.forEach(v => {
        const normalizado = v.toLowerCase().replace(/[^a-z0-9áéíóúñ]/gi, '')
        if (normalizado.length >= 2) alternativas.push(`descripcion_normalizada.ilike.%${normalizado}%`)
      })
    }
    return query.or(alternativas.join(','))
  }

  let q = query
  palabras.forEach(palabra => {
    const variantes = variantesPalabra(palabra)
    q = q.or(variantes.flatMap(v => columnas.map(c => `${c}.ilike.%${v}%`)).join(','))
  })
  return q
}
