import axios from 'axios'

// Empty base URL in dev (Vite proxy). On Vercel, VITE_API_URL points to the backend.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLoginCall = error.config?.url?.includes('/api/login')
    if (error.response?.status === 401 && !isLoginCall) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Turn any axios error into a short, readable message.
export function errorMessage(error) {
  if (!error.response) return 'Cannot reach the server. Check that the backend is running.'
  const detail = error.response.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    // FastAPI validation errors
    return detail.map((d) => `${(d.loc || []).slice(1).join('.')}: ${d.msg}`).join('; ')
  }
  return 'Something went wrong. Please try again.'
}

// Download a CSV report with the auth header attached.
export async function downloadReport(name, filename) {
  const res = await api.get(`/api/reports/${name}`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export default api
