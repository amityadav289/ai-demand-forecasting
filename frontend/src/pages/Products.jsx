import { useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import api, { errorMessage } from '../services/api'
import { useToast } from '../components/Toast.jsx'
import { EmptyState, Modal, PageHeader, Spinner, StatusBadge, money } from '../components/ui.jsx'

const EMPTY = { name: '', category: '', price: '', stock: '', minimum_stock: '' }

export default function Products() {
  const toast = useToast()
  const [products, setProducts] = useState(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // null = closed, {} = new, {id,...} = edit
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const load = (q = search) =>
    api
      .get('/api/products', { params: { search: q } })
      .then((r) => setProducts(r.data))
      .catch((e) => toast.error(errorMessage(e)))

  useEffect(() => {
    const t = setTimeout(() => load(search), 250) // small delay while typing
    return () => clearTimeout(t)
  }, [search])

  const openNew = () => {
    setForm(EMPTY)
    setEditing({})
  }
  const openEdit = (p) => {
    setForm({ name: p.name, category: p.category, price: p.price, stock: p.stock, minimum_stock: p.minimum_stock })
    setEditing(p)
  }

  const save = async (e) => {
    e.preventDefault()
    const payload = {
      name: form.name,
      category: form.category || 'General',
      price: Number(form.price),
      stock: parseInt(form.stock, 10),
      minimum_stock: parseInt(form.minimum_stock, 10),
    }
    if (!(payload.price >= 0) || !(payload.stock >= 0) || !(payload.minimum_stock >= 0)) {
      toast.error('Price, stock and minimum stock must be zero or more')
      return
    }
    setSaving(true)
    try {
      if (editing.id) await api.put(`/api/products/${editing.id}`, payload)
      else await api.post('/api/products', payload)
      toast.success(editing.id ? 'Product updated' : 'Product added')
      setEditing(null)
      load()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    try {
      await api.delete(`/api/products/${deleting.id}`)
      toast.success('Product deleted')
      setDeleting(null)
      load()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const f = (key) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) })

  return (
    <div>
      <PageHeader title="Products" subtitle="Add, edit and search your product catalogue">
        <button className="btn-primary" onClick={openNew}>
          <Plus className="h-4 w-4" /> Add Product
        </button>
      </PageHeader>

      <div className="card p-0">
        <div className="border-b border-slate-100 p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search by name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {products === null ? (
          <Spinner />
        ) : products.length === 0 ? (
          <EmptyState
            title={search ? 'No matching products' : 'No products yet'}
            message={search ? 'Try a different search.' : 'Click "Add Product" to create your first product.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  {['ID', 'Name', 'Category', 'Price', 'Stock', 'Min Stock', 'Status', ''].map((h) => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="transition hover:bg-indigo-50/40">
                    <td className="td text-slate-500">#{p.id}</td>
                    <td className="td font-medium">{p.name}</td>
                    <td className="td">{p.category}</td>
                    <td className="td">{money(p.price)}</td>
                    <td className="td">{p.stock}</td>
                    <td className="td">{p.minimum_stock}</td>
                    <td className="td"><StatusBadge status={p.status} /></td>
                    <td className="td text-right">
                      <button onClick={() => openEdit(p)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleting(p)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal title={editing.id ? 'Edit Product' : 'Add Product'} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-3">
            <div>
              <label className="label">Product Name</label>
              <input className="input" required maxLength={120} {...f('name')} />
            </div>
            <div>
              <label className="label">Category</label>
              <input className="input" placeholder="General" maxLength={60} {...f('category')} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Price (₹)</label>
                <input className="input" type="number" min="0" step="0.01" required {...f('price')} />
              </div>
              <div>
                <label className="label">Stock</label>
                <input className="input" type="number" min="0" step="1" required {...f('stock')} />
              </div>
              <div>
                <label className="label">Min Stock</label>
                <input className="input" type="number" min="0" step="1" required {...f('minimum_stock')} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title="Delete product?" onClose={() => setDeleting(null)}>
          <p className="text-sm text-slate-600">
            <b>{deleting.name}</b> will be removed permanently, together with its sales records. This cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setDeleting(null)}>Cancel</button>
            <button className="btn-danger" onClick={remove}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
