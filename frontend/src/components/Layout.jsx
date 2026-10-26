import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart, Upload,
  TrendingUp, BarChart3, FileText, LogOut, Menu, X, LineChart,
} from 'lucide-react'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/inventory', label: 'Inventory', icon: Warehouse },
  { to: '/sales', label: 'Sales Data', icon: ShoppingCart },
  { to: '/dataset', label: 'Dataset Upload', icon: Upload },
  { to: '/prediction', label: 'Demand Prediction', icon: TrendingUp },
  { to: '/performance', label: 'ML Model Performance', icon: BarChart3 },
  { to: '/reports', label: 'Reports', icon: FileText },
]

export default function Layout() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    navigate('/login')
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2 font-bold text-indigo-700">
          <LineChart className="h-5 w-5" /> DemandAI
        </div>
        <button onClick={() => setOpen(!open)} className="rounded-lg p-2 hover:bg-slate-100">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-gradient-to-b from-indigo-700 to-blue-800 text-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-6 py-6 text-xl font-bold">
          <LineChart className="h-6 w-6" /> DemandAI
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-white/20 text-white' : 'text-indigo-100 hover:bg-white/10'
                }`
              }
            >
              <Icon className="h-5 w-5" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="mb-2 truncate text-xs text-indigo-200">
            Signed in as {localStorage.getItem('username') || 'admin'}
          </p>
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/10">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  )
}
