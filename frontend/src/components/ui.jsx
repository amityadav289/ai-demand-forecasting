import { Loader2, Inbox, X } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Spinner({ text = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
      <span className="text-sm">{text}</span>
    </div>
  )
}

export function EmptyState({ title, message, actionLabel, actionTo }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-3 rounded-full bg-indigo-50 p-3">
        <Inbox className="h-6 w-6 text-indigo-500" />
      </div>
      <h3 className="font-semibold text-slate-700">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {actionLabel && actionTo && (
        <Link to={actionTo} className="btn-primary mt-4">
          {actionLabel}
        </Link>
      )}
    </div>
  )
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

const STATUS = {
  in_stock: { label: 'In Stock', cls: 'bg-emerald-100 text-emerald-700' },
  low_stock: { label: 'Low Stock', cls: 'bg-amber-100 text-amber-700' },
  out_of_stock: { label: 'Out of Stock', cls: 'bg-red-100 text-red-700' },
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.in_stock
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>{s.label}</span>
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function StatCard({ icon: Icon, label, value, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
    sky: 'bg-sky-50 text-sky-600',
  }
  return (
    <div className="card flex items-center gap-4">
      <div className={`rounded-xl p-3 ${colors[color]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="truncate text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  )
}

export const money = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
