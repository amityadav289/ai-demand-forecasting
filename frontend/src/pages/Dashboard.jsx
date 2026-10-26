import { useEffect, useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { AlertTriangle, Boxes, IndianRupee, Package, TrendingUp, Wallet } from 'lucide-react'
import api, { errorMessage } from '../services/api'
import { useToast } from '../components/Toast.jsx'
import { EmptyState, PageHeader, Spinner, StatCard, StatusBadge, money } from '../components/ui.jsx'

function ChartCard({ title, children, empty, emptyMsg, emptyTo, emptyAction }) {
  return (
    <div className="card">
      <h2 className="mb-4 font-semibold text-slate-800">{title}</h2>
      {empty ? (
        <EmptyState title="No data yet" message={emptyMsg} actionLabel={emptyAction} actionTo={emptyTo} />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const toast = useToast()
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/api/dashboard').then((r) => setData(r.data)).catch((e) => toast.error(errorMessage(e)))
  }, [])

  if (!data) return <Spinner text="Loading dashboard..." />
  const c = data.cards

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live overview of your inventory, sales and demand forecasts" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Package} label="Total Products" value={c.total_products} color="indigo" />
        <StatCard icon={Boxes} label="Total Stock" value={c.total_stock.toLocaleString('en-IN')} color="blue" />
        <StatCard icon={Wallet} label="Inventory Value" value={money(c.inventory_value)} color="violet" />
        <StatCard icon={IndianRupee} label="Total Sales" value={money(c.total_sales)} color="emerald" />
        <StatCard icon={AlertTriangle} label="Low Stock Products" value={c.low_stock_products} color="amber" />
        <StatCard
          icon={TrendingUp}
          label="Latest Predicted Demand"
          value={c.latest_predicted_demand === null ? '—' : `${c.latest_predicted_demand} units`}
          color="sky"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Sales Overview (revenue per day)"
          empty={data.sales_chart.length === 0}
          emptyMsg="Record a sale to see revenue over time."
          emptyAction="Add a sale"
          emptyTo="/sales"
        >
          <AreaChart data={data.sales_chart}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => money(v)} />
            <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} fill="url(#rev)" name="Revenue" />
          </AreaChart>
        </ChartCard>

        <ChartCard
          title="Inventory Distribution (stock by category)"
          empty={data.inventory_chart.length === 0}
          emptyMsg="Add products to see how stock is distributed."
          emptyAction="Add products"
          emptyTo="/products"
        >
          <BarChart data={data.inventory_chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="category" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="stock" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Stock" />
          </BarChart>
        </ChartCard>
      </div>

      <div className="mt-4">
        <ChartCard
          title={`Actual vs Predicted Demand${data.model_name ? ` (${data.model_name}, test set)` : ''}`}
          empty={data.actual_vs_predicted.length === 0}
          emptyMsg="Upload a dataset and train the models to compare actual and predicted demand."
          emptyAction="Upload dataset"
          emptyTo="/dataset"
        >
          <LineChart data={data.actual_vs_predicted}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="index" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="actual" stroke="#4f46e5" strokeWidth={2} dot={false} name="Actual" />
            <Line type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={2} dot={false} name="Predicted" />
          </LineChart>
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card">
          <h2 className="mb-3 font-semibold text-slate-800">Recent Products</h2>
          {data.recent_products.length === 0 ? (
            <EmptyState title="No products" message="Add your first product." actionLabel="Add product" actionTo="/products" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recent_products.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.category}</p>
                  </div>
                  <span className="text-slate-600">{p.stock} units</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold text-slate-800">Low Stock Alerts</h2>
          {data.low_stock_alerts.length === 0 ? (
            <EmptyState title="All good" message="No products are low or out of stock." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.low_stock_alerts.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.stock} left · min {p.minimum_stock}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold text-slate-800">Recent Predictions</h2>
          {data.recent_predictions.length === 0 ? (
            <EmptyState title="No predictions" message="Run a demand prediction." actionLabel="Predict demand" actionTo="/prediction" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recent_predictions.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium">
                      {r.item_id} · {r.store_id}
                    </p>
                    <p className="text-xs text-slate-500">{r.model_name}</p>
                  </div>
                  <span className="font-semibold text-indigo-600">{r.predicted_units} units</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
