'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Credenciales incorrectas.')
      setIsLoading(false)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-black text-zinc-300 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-light tracking-tight text-white mb-2">Swami Autopartes</h1>
          <p className="text-sm text-zinc-500 uppercase tracking-widest">Acceso Administrador</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 p-8 rounded-lg shadow-2xl space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center bg-white text-black font-medium py-3 px-4 rounded-sm transition-colors hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </main>
  )
}
