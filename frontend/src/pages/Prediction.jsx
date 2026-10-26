import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Loader2, PackageCheck, ShoppingBag, TrendingUp } from 'lucide-react'
import api, { errorMessage } from '../services/api'
import { useToast } from '../components/Toast.jsx'
import { PageHeader, Spinner, StatusBadge } from '../components/ui.jsx'

const EMPTY = {
  item_id: '', store_id: '', item_base_price: '', discount_applied: '',
  store_footfall: '', is_holiday: '0', past_week_sales: '',
  safety_stock: '0', product_id: '',
}

export default function Prediction() {
  const toast = useToast()
  const [status, setStatus] = useState(null)
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    api.get('/api/ml/status').then((r) => setStatus(r.data)).catch((e) => {
      setStatus({ trained: false })
      toast.error(errorMessage(e))
    })
    api.get('/api/products').then((r) => setProducts(r.data)).catch(() => {})
  }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    const num = (v) => (v === '' ? NaN : Number(v))
    const payload = {
      item_id: form.item_id.trim(),
      store_id: form.store_id.trim(),
      item_base_price: num(form.item_base_price),
      discount_applied: num(form.discount_applied),
      store_footfall: num(form.store_footfall),
      is_holiday: Number(form.is_holiday),
      past_week_sales: num(form.past_week_sales),
      safety_stock: num(form.safety_stock),
      product_id: form.product_id ? Number(form.product_id) : null,
    }
    if (!payload.item_id || !payload.store_id) return toast.error('Item ID and Store ID are required')
    const numbers = ['item_base_price', 'discount_applied', 'store_footfall', 'past_week_sales', 'safety_stock']
    if (numbers.some((k) => Number.isNaN(payload[k]) || payload[k] < 0))
      return toast.error('All numeric fields must be filled in and zero or more')

    setBusy(true)
    try {
      const res = await api.post('/api/ml/predict', payload)
      setResult(res.data)
      toast.success('Prediction generated')
    } catch (err) {
      setResult(null)
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!status) return <Spinner />

  return (
    <div>
      <PageHeader title="Demand Prediction" subtitle="Predict units sold and get a reorder recommendation" />

      {!status.trained && (
        <div className="card mb-4 flex items-start gap-3 border-amber-200 bg-amber-50">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">The model is not trained yet.</p>
            <p>
              Upload a dataset and train the models first.{' '}
              <Link to="/dataset" className="font-semibold underline">Go to Dataset Upload</Link>
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <form onSubmit={submit} className="card lg:col-span-3">
          <h2 className="mb-4 font-semibold text-slate-800">Input features</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Item ID</label>
              <input className="input" placeholder="e.g. ITEM001" value={form.item_id} onChange={set('item_id')} />
            </div>
            <div>
              <label className="label">Store ID</label>
              <input className="input" placeholder="e.g. STORE1" value={form.store_id} onChange={set('store_id')} />
            </div>
            <div>
              <label className="label">Item Base Price (₹)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.item_base_price} onChange={set('item_base_price')} />
            </div>
            <div>
              <label className="label">Discount Applied (%)</label>
              <input className="input" type="number" min="0" step="0.1" value={form.discount_applied} onChange={set('discount_applied')} />
            </div>
            <div>
              <label className="label">Store Footfall</label>
              <input className="input" type="number" min="0" step="1" value={form.store_footfall} onChange={set('store_footfall')} />
            </div>
            <div>
              <label className="label">Is Holiday</label>
              <select className="input" value={form.is_holiday} onChange={set('is_holiday')}>
                <option value="0">No</option>
                <option value="1">Yes</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Past Week Sales (units)</label>
              <input className="input" type="number" min="0" step="1" value={form.past_week_sales} onChange={set('past_week_sales')} />
            </div>
          </div>

          <h2 className="mb-1 mt-6 font-semibold text-slate-800">Inventory optimization (optional)</h2>
          <p className="mb-3 text-xs text-slate-500">
            Link a product to compare the prediction with its current stock. Reorder = max(0, Predicted Demand + Safety Stock − Current Stock).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Product</label>
              <select className="input" value={form.product_id} onChange={set('product_id')}>
                <option value="">None</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.stock} in stock)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Safety Stock (units)</label>
              <input className="input" type="number" min="0" step="1" value={form.safety_stock} onChange={set('safety_stock')} />
            </div>
          </div>

          <button className="btn-primary mt-6 w-full sm:w-auto" disabled={busy || !status.trained}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
            Predict Demand
          </button>
        </form>

        <div className="space-y-4 lg:col-span-2">
          {!result ? (
            <div className="card flex h-full min-h-48 flex-col items-center justify-center text-center text-slate-500">
              <TrendingUp className="mb-2 h-8 w-8 text-indigo-300" />
              <p className="text-sm">Fill in the form and click <b>Predict Demand</b> to see the result.</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 p-6 text-white shadow-lg">
                <p className="text-sm text-indigo-100">Predicted Units Sold</p>
                <p className="mt-1 text-5xl font-bold">{result.predicted_units}</p>
                <p className="mt-3 text-sm text-indigo-100">Model: {result.model_name}</p>
              </div>

              {result.recommended_reorder === null ? (
                <div className="card text-sm text-slate-500">
                  No product linked, so stock status and reorder quantity are not shown. Select a product to get a recommendation.
                </div>
              ) : (
                <div className="card">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 font-semibold"><PackageCheck className="h-5 w-5 text-indigo-600" /> {result.product_name}</h3>
                    <StatusBadge status={result.stock_status} />
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between"><dt className="text-slate-500">Predicted demand</dt><dd className="font-medium">{result.predicted_units}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">+ Safety stock</dt><dd className="font-medium">{result.safety_stock}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">− Current stock</dt><dd className="font-medium">{result.current_stock}</dd></div>
                  </dl>
                  <div className={`mt-4 flex items-center gap-3 rounded-xl p-4 ${result.recommended_reorder > 0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                    <ShoppingBag className="h-6 w-6" />
                    <div>
                      <p className="text-xs uppercase tracking-wide">Recommended reorder</p>
                      <p className="text-2xl font-bold">
                        {result.recommended_reorder} units
                      </p>
                      {result.recommended_reorder === 0 && <p className="text-xs">Current stock covers the predicted demand.</p>}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
