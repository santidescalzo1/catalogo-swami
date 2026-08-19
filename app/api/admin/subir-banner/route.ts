import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { crearClienteAdmin } from '@/lib/supabase/admin'

// Mismo patron que /api/admin/subir-foto: proxy.ts no protege /api/*, asi
// que esta ruta se protege sola verificando admin antes de tocar el
// cliente service_role (que bypasea RLS y el bug de plataforma de Storage
// con JWTs de sesion).
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // No hace falta refrescar cookies en un route handler de una sola request.
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: esAdmin } = await supabase.from('admins').select('id').eq('id', user.id).maybeSingle()
  if (!esAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const formData = await request.formData()
  const archivo = formData.get('archivo')

  if (!(archivo instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
  }

  const extension = (archivo.name.split('.').pop() || 'jpg').toLowerCase()
  const nombreArchivo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`

  const admin = crearClienteAdmin()
  const { error } = await admin.storage
    .from('banners')
    .upload(nombreArchivo, archivo, {
      contentType: archivo.type || 'image/jpeg',
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, path: nombreArchivo })
}
