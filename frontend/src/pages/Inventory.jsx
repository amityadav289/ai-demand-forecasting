import { useEffect, useState } from 'react'
import { Loader2, MinusCircle, PlusCircle, RefreshCw } from 'lucide-react'
import api, { errorMessage } from '../services/api'
import { useToast } from '../components/Toast.jsx'
import { EmptyState, Modal, PageHeader, Spinner, StatusBadge } from '../components/ui.jsx'

const ACTIONS = {
  add: { title: 'Add Stock', icon: PlusCircle, label: 'Quantity to add' },
  reduce: { title: 'Reduce Stock', icon: MinusCircle, label: 'Quantity to remove' },
  set: { title: 'Update Stock', icon: RefreshCw, label: 'New stock quantity' },
}

export default function Inventory() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [dialog, setDialog] = useState(null) // { product, action }
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () =>
    api.get('/api/inventory').then((r) => setData(r.data)).catch((e) => toast.error(errorMessage(e)))

  useEffect(() => {
    load()
  }, [])

  const open = (product, action) => {
    setQty('')
    setDialog({ product, action })
  }

  const submit = async (e) => {
    e.preventDefault()
    const quantity = parseInt(qty, 10)
    if (!(quantity >= 0)) return toast.error('Enter a valid quantity (0 or more)')
    if (dialog.action === 'reduce' && quantity > dialog.product.stock)
      return toast.error(`Only ${dialog.product.stock} units in stock`)
    setSaving(true)
    try {
      await api.put(`/api/inventory/${dialog.product.id}`, { action: dialog.action, quantity })
      toast.success('Stock updated')
      setDialog(null)
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
      <PageHeader title="Inventory" subtitle="Monitor current stock and make adjustments" />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500">Items tracked</p>
          <p className="text-2xl font-bold">{data.items.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Low stock</p>
          <p className="text-2xl font-bold text-amber-600">{data.low_stock}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Out of stock</p>
          <p className="text-2xl font-bold text-red-600">{data.out_of_stock}</p>
        </div>
      </div>

      <div className="card p-0">
        {data.items.length === 0 ? (
          <EmptyState title="No inventory yet" message="Add products first, then manage their stock here." actionLabel="Go to Products" actionTo="/products" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  {['Product', 'Category', 'Current Stock', 'Min Stock', 'Status', 'Adjust'].map((h) => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((p) => (
                  <tr key={p.id} className="transition hover:bg-indigo-50/40">
                    <td className="td font-medium">{p.name}</td>
                    <td className="td">{p.category}</td>
                    <td className="td font-semibold">{p.stock}</td>
                    <td className="td">{p.minimum_stock}</td>
                    <td className="td"><StatusBadge status={p.status} /></td>
                    <td className="td">
                      <div className="flex gap-1">
                        <button className="btn-secondary px-2.5 py-1.5 text-emerald-700" onClick={() => open(p, 'add')}>
                          <PlusCircle className="h-4 w-4" /> Add
                        </button>
                        <button className="btn-secondary px-2.5 py-1.5 text-amber-700" onClick={() => open(p, 'reduce')}>
                          <MinusCircle className="h-4 w-4" /> Reduce
                        </button>
                        <button className="btn-secondary px-2.5 py-1.5 text-indigo-700" onClick={() => open(p, 'set')}>
                          <RefreshCw className="h-4 w-4" /> Set
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialog && (
        <Modal title={`${ACTIONS[dialog.action].title}: ${dialog.product.name}`} onClose={() => setDialog(null)}>
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-slate-500">Current stock: <b>{dialog.product.stock}</b></p>
            <div>
              <label className="label">{ACTIONS[dialog.action].label}</label>
              <input className="input" type="number" min="0" step="1" required autoFocus value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setDialog(null)}>Cancel</button>
              <button className="btn-primary" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
