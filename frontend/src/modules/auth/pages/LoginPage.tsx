import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'

import { queryClient } from '../../../app/queryClient'
import idesemLogo from '../../../assets/IDESEM_sin_fondo.png'
import { ApiRequestError } from '../../../services/apiError'
import { useAuthStore } from '../../../store/authStore'
import { loginSchema, type LoginFormValues } from '../schemas/login.schema'
import { authService } from '../services/auth.service'

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated)

  const from =
    (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  const login = useMutation({
    mutationFn: authService.login,
    onSuccess: (user) => {
      queryClient.setQueryData(['auth', 'me'], user)
      setAuthenticated(user)
      navigate(from, { replace: true })
    },
    onError: (error) => {
      const message =
        error instanceof ApiRequestError
          ? error.details.message
          : 'No se pudo iniciar sesión.'

      setError('root', { message })
    },
  })

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.05fr_0.95fr]">
      {/* Panel izquierdo */}
      <section className="relative hidden overflow-hidden bg-[#e8f0f8] p-12 lg:flex lg:flex-col lg:justify-between">
        {/* Elementos decorativos */}
        <div
          aria-hidden="true"
          className="absolute -right-32 -top-28 size-96 rounded-full border-[70px] border-brand-600/5"
        />

        <div
          aria-hidden="true"
          className="absolute -bottom-48 -left-32 size-[32rem] rounded-full bg-brand-500/10 blur-3xl"
        />

        {/* Encabezado */}
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-700">
            Sistema de gestión comercial
          </p>
        </div>

        {/* Logotipo principal */}
        <div className="relative flex flex-1 items-center justify-center px-8">
          <img
            src={idesemLogo}
            alt="IDESEM S.R.L. - Importación y distribución de equipos múltiples"
            className="h-auto w-full max-w-[540px] object-contain drop-shadow-sm"
          />
        </div>

        {/* Pie */}
        <p className="relative text-xs font-medium text-slate-500">
          IDESEM S.R.L. · Bolivia
        </p>
      </section>

      {/* Panel derecho */}
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Encabezado móvil */}
          <div className="mb-8 flex items-center lg:hidden">
            <img
              src={idesemLogo}
              alt="IDESEM S.R.L."
              className="h-20 w-auto max-w-[220px] object-contain object-left"
            />
          </div>

          <div className="mb-8">
            <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <LockKeyhole className="size-5" />
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Bienvenido
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Ingresa tus credenciales para acceder al sistema.
            </p>
          </div>

          <form
            className="space-y-5"
            noValidate
            onSubmit={handleSubmit((values) => login.mutate(values))}
          >
            {errors.root?.message && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {errors.root.message}
              </div>
            )}

            <label className="block text-sm font-semibold text-slate-700">
              Nombre de usuario <span className="text-red-500">*</span>

              <input
                {...register('username')}
                autoComplete="username"
                autoFocus
                aria-invalid={Boolean(errors.username)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              />

              {errors.username && (
                <span
                  role="alert"
                  className="mt-1.5 block text-xs text-red-600"
                >
                  {errors.username.message}
                </span>
              )}
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Contraseña <span className="text-red-500">*</span>

              <span className="relative mt-2 block">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                />

                <button
                  type="button"
                  aria-label={
                    showPassword
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400 transition hover:text-slate-700"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </span>

              {errors.password && (
                <span
                  role="alert"
                  className="mt-1.5 block text-xs text-red-600"
                >
                  {errors.password.message}
                </span>
              )}
            </label>

            <button
              type="submit"
              disabled={login.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {login.isPending ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Verificando…
                </>
              ) : (
                <>
                  Iniciar sesión
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}