'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Music } from 'lucide-react'

const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://ipfs-hifi-music-streaming.onrender.com'
  : 'http://localhost:4000'

export default function AuthPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [registerData, setRegisterData] = useState({ 
    email: '', 
    password: '', 
    confirmPassword: '',
    username: ''
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(loginData)
      })

      const result = await response.json()

      if (result.ok) {
        setSuccess('¡Inicio de sesión exitoso!')
        // Redirect to home or dashboard
        window.location.href = '/'
      } else {
        setError(result.error || 'Error en el inicio de sesión')
      }
    } catch (err) {
      setError('Error de conexión con el servidor')
      console.error('Login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    if (registerData.password !== registerData.confirmPassword) {
      setError('Las contraseñas no coinciden')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: registerData.email,
          password: registerData.password,
          username: registerData.username
        })
      })

      const result = await response.json()

      if (result.ok) {
        setSuccess('¡Registro exitoso! Ya puedes iniciar sesión.')
        // Clear form
        setRegisterData({ email: '', password: '', confirmPassword: '', username: '' })
      } else {
        setError(result.error || 'Error en el registro')
      }
    } catch (err) {
      setError('Error de conexión con el servidor')
      console.error('Register error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/api/auth/google`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-black/50 backdrop-blur-sm border-gray-800">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Music className="h-8 w-8 text-purple-400" />
            <h1 className="text-2xl font-bold text-white">IPFS Music</h1>
          </div>
          <CardTitle className="text-white">Autenticación</CardTitle>
          <CardDescription className="text-gray-300">
            Inicia sesión o crea una cuenta para acceder a tu música
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4 border-red-500 bg-red-500/10">
              <AlertDescription className="text-red-400">{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="mb-4 border-green-500 bg-green-500/10">
              <AlertDescription className="text-green-400">{success}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="login" className="text-white data-[state=active]:bg-purple-600">
                Iniciar Sesión
              </TabsTrigger>
              <TabsTrigger value="register" className="text-white data-[state=active]:bg-purple-600">
                Registrarse
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-white">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-white">Contraseña</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Iniciando sesión...
                    </>
                  ) : (
                    'Iniciar Sesión'
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-email" className="text-white">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-username" className="text-white">Nombre de usuario</Label>
                  <Input
                    id="register-username"
                    type="text"
                    placeholder="miusuario"
                    value={registerData.username}
                    onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password" className="text-white">Contraseña</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="••••••••"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-confirm" className="text-white">Confirmar Contraseña</Label>
                  <Input
                    id="register-confirm"
                    type="password"
                    placeholder="••••••••"
                    value={registerData.confirmPassword}
                    onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    'Crear Cuenta'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-black px-2 text-gray-400">O continúa con</span>
              </div>
            </div>
            <Button
              onClick={handleGoogleLogin}
              variant="outline"
              className="w-full mt-4 bg-white text-black hover:bg-gray-100 border-gray-300"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continuar con Google
            </Button>
          </div>

          <div className="mt-6 text-center">
            <Button
              variant="link"
              onClick={() => window.location.href = '/'}
              className="text-purple-400 hover:text-purple-300"
            >
              ← Volver al inicio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
