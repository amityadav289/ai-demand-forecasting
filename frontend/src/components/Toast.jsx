import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const push = useCallback(
    (type, message) => {
      const id = Date.now() + Math.random()
      setToasts((t) => [...t, { id, type, message }])
      setTimeout(() => remove(id), 4000)
    },
    [remove]
  )

  const toast = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed right-4 top-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-xl border bg-white p-3 shadow-lg ${
              t.type === 'success' ? 'border-emerald-200' : 'border-red-200'
            }`}
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            )}
            <p className="flex-1 text-sm text-slate-700">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
