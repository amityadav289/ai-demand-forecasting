import { useEffect, useState } from 'react'
import { Download, Loader2, Package, ShoppingCart, TrendingUp } from 'lucide-react'
import api, { downloadReport, errorMessage } from '../services/api'
import { useToast } from '../components/Toast.jsx'
import { EmptyState, PageHeader } from '../components/ui.jsx'

const REPORTS = [
  { key: 'inventory', file: 'inventory_report.csv', title: 'Product Inventory Report', desc: 'All products with price, stock, minimum stock, status and stock value.', icon: Package },
  { key: 'sales', file: 'sales_report.csv', title: 'Sales Report', desc: 'Every recorded sale with product, date, quantity, price and total.', icon: ShoppingCart },
  { key: 'predictions', file: 'prediction_history.csv', title: 'Prediction History', desc: 'All demand predictions generated, with the model used.', icon: TrendingUp },
]

export default function Reports() {
  const toast = useToast()
  const [busy, setBusy] = useState(null)
  const [history, setHistory] = useState(null)

  useEffect(() => {
    api.get('/api/predictions').then((r) => setHistory(r.data)).catch((e) => toast.error(errorMessage(e)))
  }, [])

  const download = async (r) => {
    setBusy(r.key)
    try {
      await downloadReport(r.key, r.file)
      toast.success(`${r.title} downloaded`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader title="Reports" subtitle="Download your data as CSV files" />

      <div className="grid gap-4 md:grid-cols-3">
        {REPORTS.map((r) => (
          <div key={r.key} className="card flex flex-col">
            <div className="mb-3 w-fit rounded-xl bg-indigo-50 p-3 text-indigo-600">
              <r.icon className="h-6 w-6" />
            </div>
            <h2 className="font-semibold">{r.title}</h2>
            <p className="mt-1 flex-1 text-sm text-slate-500">{r.desc}</p>
            <button className="btn-primary mt-4" disabled={busy === r.key} onClick={() => download(r)}>
              {busy === r.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download CSV
            </button>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-0">
        <h2 className="border-b border-slate-100 p-4 font-semibold">Recent prediction history</h2>
        {history === null ? null : history.length === 0 ? (
          <EmptyState title="No predictions yet" message="Predictions you generate will be listed here." actionLabel="Predict demand" actionTo="/prediction" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>{['Date', 'Item', 'Store', 'Predicted Units', 'Model'].map((h) => <th key={h} className="th">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h) => (
                  <tr key={h.id} className="transition hover:bg-indigo-50/40">
                    <td className="td">{new Date(h.created_at + 'Z').toLocaleString()}</td>
                    <td className="td font-medium">{h.item_id}</td>
                    <td className="td">{h.store_id}</td>
                    <td className="td font-semibold text-indigo-600">{h.predicted_units}</td>
                    <td className="td">{h.model_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
