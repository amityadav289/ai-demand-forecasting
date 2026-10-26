import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Brain, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react'
import api, { errorMessage } from '../services/api'
import { useToast } from '../components/Toast.jsx'
import { EmptyState, PageHeader, Spinner } from '../components/ui.jsx'

const REQUIRED = [
  'Item_ID', 'Store_ID', 'Item_Base_Price', 'Discount_Applied',
  'Store_Footfall', 'Is_Holiday', 'Past_Week_Sales', 'Units_Sold',
]

export default function DatasetUpload() {
  const toast = useToast()
  const fileRef = useRef(null)
  const [summary, setSummary] = useState(undefined) // undefined = loading, null = none
  const [uploading, setUploading] = useState(false)
  const [training, setTraining] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    api
      .get('/api/dataset/preview')
      .then((r) => setSummary(r.data.exists ? r.data : null))
      .catch((e) => {
        setSummary(null)
        toast.error(errorMessage(e))
      })
  }, [])

  const upload = async (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) return toast.error('Please choose a .csv file')
    const body = new FormData()
    body.append('file', file)
    setUploading(true)
    setResult(null)
    try {
      const res = await api.post('/api/dataset/upload', body)
      setSummary(res.data)
      toast.success('Dataset uploaded and validated')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const train = async () => {
    setTraining(true)
    try {
      const res = await api.post('/api/ml/train')
      setResult(res.data)
      toast.success(res.data.message)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setTraining(false)
    }
  }

  if (summary === undefined) return <Spinner />

  return (
    <div>
      <PageHeader title="Dataset Upload & Training" subtitle="Upload historical sales data, then train and compare three ML models" />

      <div className="card mb-4">
        <div
          className="flex flex-col items-center rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 px-4 py-8 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            upload(e.dataTransfer.files[0])
          }}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          ) : (
            <UploadCloud className="h-8 w-8 text-indigo-500" />
          )}
          <p className="mt-2 font-medium text-slate-700">Drag & drop a CSV file here, or</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => upload(e.target.files[0])} />
          <button className="btn-primary mt-3" disabled={uploading} onClick={() => fileRef.current.click()}>
            <FileSpreadsheet className="h-4 w-4" /> Choose CSV file
          </button>
          <p className="mt-4 text-xs text-slate-500">
            Required columns: <span className="font-mono">{REQUIRED.join(', ')}</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">Uploading historical data never changes your current product stock.</p>
        </div>
      </div>

      {!summary ? (
        <div className="card">
          <EmptyState title="No dataset uploaded" message="Upload a CSV file to preview it and train the models." />
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-4">
            <div className="card"><p className="text-sm text-slate-500">Total rows</p><p className="text-2xl font-bold">{summary.rows.toLocaleString()}</p></div>
            <div className="card"><p className="text-sm text-slate-500">Total columns</p><p className="text-2xl font-bold">{summary.columns}</p></div>
            <div className="card"><p className="text-sm text-slate-500">Missing values</p><p className="text-2xl font-bold text-amber-600">{summary.total_missing}</p></div>
            <div className="card"><p className="text-sm text-slate-500">Duplicate rows</p><p className="text-2xl font-bold text-amber-600">{summary.duplicate_rows}</p></div>
          </div>

          {summary.total_missing > 0 && (
            <div className="card mb-4">
              <h2 className="mb-2 font-semibold">Missing values per column</h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.missing_values)
                  .filter(([, n]) => n > 0)
                  .map(([col, n]) => (
                    <span key={col} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                      {col}: {n}
                    </span>
                  ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Missing numbers are filled with the median and missing categories with "unknown" during training. Duplicates are removed.
              </p>
            </div>
          )}

          <div className="card mb-4 p-0">
            <h2 className="border-b border-slate-100 p-4 font-semibold">Dataset preview (first 10 rows)</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>{summary.column_names.map((c) => <th key={c} className="th">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.preview.map((row, i) => (
                    <tr key={i}>
                      {summary.column_names.map((c) => (
                        <td key={c} className="td">{row[c] ?? <span className="text-slate-300">—</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Train models</h2>
              <p className="text-sm text-slate-500">
                Trains Linear Regression, Random Forest and XGBoost (80/20 split), then saves the best one.
              </p>
            </div>
            <button className="btn-primary" onClick={train} disabled={training}>
              {training ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {training ? 'Training... please wait' : 'Train Model'}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="card mt-4 p-0">
          <div className="flex items-center gap-2 border-b border-slate-100 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <h2 className="font-semibold">Training complete: best model is {result.best_model}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>{['Model', 'MAE', 'MSE', 'RMSE', 'R² Score'].map((h) => <th key={h} className="th">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.results.map((m) => (
                  <tr key={m.model_name} className={m.model_name === result.best_model ? 'bg-emerald-50' : ''}>
                    <td className="td font-medium">{m.model_name}{m.model_name === result.best_model && ' ★'}</td>
                    <td className="td">{m.mae.toFixed(3)}</td>
                    <td className="td">{m.mse.toFixed(3)}</td>
                    <td className="td">{m.rmse.toFixed(3)}</td>
                    <td className="td">{m.r2_score.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 p-4">
            <Link to="/performance" className="btn-secondary">View charts</Link>
            <Link to="/prediction" className="btn-primary">Predict demand</Link>
          </div>
        </div>
      )}
    </div>
  )
}
