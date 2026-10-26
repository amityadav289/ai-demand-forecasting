import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { LineChart, Loader2 } from 'lucide-react'
import api, { errorMessage } from '../services/api'
import { useToast } from '../components/Toast.jsx'

export default function Login() {
  const navigate = useNavigate()
  const toast = useToast()
  const [adminExists, setAdminExists] = useState(null) // null = still checking
  const [form, setForm] = useState({ username: '', password: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .get('/api/health')
      .then((r) => setAdminExists(r.data.admin_exists))
      .catch((e) => {
        setAdminExists(true)
        toast.error(errorMessage(e))
      })
  }, [])

  if (localStorage.getItem('token')) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (!adminExists) {
        await api.post('/api/setup', form)
        toast.success('Admin account created')
      }
      const res = await api.post('/api/login', form)
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('username', res.data.username)
      navigate('/')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const setupMode = adminExists === false

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white">
            <LineChart className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">DemandAI</h1>
          <p className="mt-1 text-sm text-slate-500">
            AI-Powered Demand Forecasting & Inventory Optimization
          </p>
        </div>

        {adminExists === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {setupMode && (
              <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-700">
                First time here? Create the administrator account. This only works once.
              </p>
            )}
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                required
                minLength={3}
                autoFocus
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                required
                minLength={setupMode ? 6 : 1}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              {setupMode && <p className="mt-1 text-xs text-slate-400">At least 6 characters.</p>}
            </div>
            <button className="btn-primary w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {setupMode ? 'Create Admin & Sign In' : 'Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
