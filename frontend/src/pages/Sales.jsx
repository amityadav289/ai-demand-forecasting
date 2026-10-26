import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Loader2, Plus } from 'lucide-react'
import api, { errorMessage } from '../services/api'
import { useToast } from '../components/Toast.jsx'
import { EmptyState, Modal, PageHeader, Spinner, money } from '../components/ui.jsx'

const today = () => new Date().toISOString().slice(0, 10)

export default function Sales() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [products, setProducts] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ product_id: '', date: today(), quantity: '', selling_price: '' })
  const [saving, setSaving] = useState(false)

  const load = () => {
    api.get('/api/sales').then((r) => setData(r.data)).catch((e) => toast.error(errorMessage(e)))
    api.get('/api/products').then((r) => setProducts(r.data)).catch(() => {})
  }
  useEffect(load, [])

  const selected = products.find((p) => String(p.id) === String(form.product_id))

  const pickProduct = (id) => {
    const p = products.find((x) => String(x.id) === id)
    setForm({ ...form, product_id: id, selling_price: p ? p.price : '' })
  }

  const submit = async (e) => {
    e.preventDefault()
    const quantity = parseInt(form.quantity, 10)
    if (!selected) return toast.error('Please select a product')
    if (!(quantity > 0)) return toast.error('Quantity must be at least 1')
    if (quantity > selected.stock) return toast.error(`Only ${selected.stock} units available for ${selected.name}`)
    setSaving(true)
    try {
      await api.post('/api/sales', {
        product_id: selected.id,
        date: form.date,
        quantity,
        selling_price: Number(form.selling_price),
      })
      toast.success('Sale recorded and stock updated')
      setOpen(false)
      setForm({ product_id: '', date: today(), quantity: '', selling_price: '' })
      load()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!data) return <Spinner />

  return (
    <div>
      <PageHeader title="Sales Data" subtitle="Record sales and review your sales history">
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add Sale
        </button>
      </PageHeader>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500">Total sales (revenue)</p>
          <p className="text-2xl font-bold text-emerald-600">{money(data.total_revenue)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Units sold</p>
          <p className="text-2xl font-bold">{data.total_units}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Sales records</p>
          <p className="text-2xl font-bold">{data.sales.length}</p>
        </div>
      </div>

      <div className="card mb-4">
        <h2 className="mb-4 font-semibold text-slate-800">Revenue by day</h2>
        {data.chart.length === 0 ? (
          <EmptyState title="No sales yet" message="Add a sale to see the chart." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card p-0">
        <h2 className="border-b border-slate-100 p-4 font-semibold text-slate-800">Sales history</h2>
        {data.sales.length === 0 ? (
          <EmptyState title="No sales recorded" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  {['Date', 'Product', 'Quantity', 'Selling Price', 'Total'].map((h) => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.sales.map((s) => (
                  <tr key={s.id} className="transition hover:bg-indigo-50/40">
                    <td className="td">{s.date}</td>
                    <td className="td font-medium">{s.product_name}</td>
                    <td className="td">{s.quantity}</td>
                    <td className="td">{money(s.selling_price)}</td>
                    <td className="td font-semibold">{money(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <Modal title="Add Sale" onClose={() => setOpen(false)}>
          {products.length === 0 ? (
            <EmptyState title="No products" message="Add a product before recording sales." actionLabel="Go to Products" actionTo="/products" />
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="label">Product</label>
                <select className="input" required value={form.product_id} onChange={(e) => pickProduct(e.target.value)}>
                  <option value="">Select a product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.stock} in stock)</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Date</label>
                  <input className="input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Quantity</label>
                  <input className="input" type="number" min="1" step="1" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </div>
                <div>
                  <label className="label">Price (₹)</label>
                  <input className="input" type="number" min="0" step="0.01" required value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-slate-500">Recording a sale reduces the product's current stock.</p>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <button className="btn-primary" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Sale
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  )
}
