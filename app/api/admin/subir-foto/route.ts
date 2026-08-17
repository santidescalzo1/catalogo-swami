import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { crearClienteAdmin } from '@/lib/supabase/admin'

// proxy.ts protege /admin/:path* pero NO /api/*, así que esta ruta se
// protege sola: sin ser admin no llega a usar el cliente admin
// (service_role), que bypasea RLS por completo. "Hay sesión válida" no
// alcanza — desde que existe login de clientes en el catálogo público,
// una sesión válida puede ser perfectamente un cliente, no el admin.
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
  const codigo = formData.get('codigo')

  if (!(archivo instanceof File) || typeof codigo !== 'string' || !codigo.trim()) {
    return NextResponse.json({ error: 'Falta el archivo o el código' }, { status: 400 })
  }

  const admin = crearClienteAdmin()
  const { error } = await admin.storage
    .from('repuestos')
    .upload(`${codigo.trim()}.jpg`, archivo, {
      upsert: true,
      contentType: archivo.type || 'image/jpeg',
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
