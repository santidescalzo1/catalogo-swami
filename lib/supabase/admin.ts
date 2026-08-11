import { createClient } from '@supabase/supabase-js'

// Cliente con service_role: bypasea RLS por completo. Existe para esquivar
// el bug de plataforma de Supabase donde Storage rechaza JWTs de sesion
// firmados con la clave de firma nueva (ver memoria del proyecto:
// storage_rls_jwt_signing_key_bug). service_role no es un JWT en el
// sistema de API keys nuevo, así que no pasa por esa verificación.
//
// SUPABASE_SERVICE_ROLE_KEY vive SOLO como variable de entorno del
// servidor (Vercel), nunca en el repo. Este archivo solo se puede importar
// desde Route Handlers (corren siempre en el servidor) — nunca desde un
// componente 'use client'.
export function crearClienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
