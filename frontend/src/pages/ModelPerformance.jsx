import { useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Trophy } from 'lucide-react'
import api, { errorMessage } from '../services/api'
import { useToast } from '../components/Toast.jsx'
import { EmptyState, PageHeader, Spinner } from '../components/ui.jsx'

export default function ModelPerformance() {
  const toast = useToast()
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/api/ml/metrics').then((r) => setData(r.data)).catch((e) => {
      setData({ trained: false })
      toast.error(errorMessage(e))
    })
  }, [])

  if (!data) return <Spinner />

  if (!data.trained)
    return (
      <div>
        <PageHeader title="ML Model Performance" subtitle="Compare the trained models" />
        <div className="card">
          <EmptyState
            title="No trained models yet"
            message="Upload a dataset and train the models to see real evaluation metrics here."
            actionLabel="Upload dataset"
            actionTo="/dataset"
          />
        </div>
      </div>
    )

  const chartData = data.metrics.map((m) => ({
    name: m.model_name,
    MAE: +m.mae.toFixed(3),
    RMSE: +m.rmse.toFixed(3),
    R2: +m.r2_score.toFixed(4),
  }))

  return (
    <div>
      <PageHeader
        title="ML Model Performance"
        subtitle={`Evaluated on ${data.test_rows} held-out test rows (trained on ${data.train_rows}). Best model chosen by ${data.selection_metric}.`}
      />

      <div className="card mb-4 flex items-center gap-3 border-emerald-200 bg-emerald-50">
        <Trophy className="h-6 w-6 text-emerald-600" />
        <div>
          <p className="text-sm text-emerald-700">Best-performing model (used for predictions)</p>
          <p className="text-lg font-bold text-emerald-900">{data.best_model}</p>
        </div>
      </div>

      <div className="card mb-4 p-0">
        <h2 className="border-b border-slate-100 p-4 font-semibold">Model comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>{['Model Name', 'MAE', 'MSE', 'RMSE', 'R² Score'].map((h) => <th key={h} className="th">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.metrics.map((m) => {
                const best = m.model_name === data.best_model
                return (
                  <tr key={m.model_name} className={best ? 'bg-emerald-50' : ''}>
                    <td className="td font-medium">
                      {m.model_name}
                      {best && <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">Best</span>}
                    </td>
                    <td className="td">{m.mae.toFixed(3)}</td>
                    <td className="td">{m.mse.toFixed(3)}</td>
                    <td className="td">{m.rmse.toFixed(3)}</td>
                    <td className="td">{m.r2_score.toFixed(4)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 font-semibold">Error comparison (lower is better)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="MAE" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="RMSE" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2 className="mb-4 font-semibold">R² score (higher is better)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 1]} />
                <Tooltip />
                <Bar dataKey="R2" fill="#10b981" radius={[4, 4, 0, 0]} name="R² Score" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold">Actual vs Predicted ({data.best_model}, first {data.actual_vs_predicted.length} test rows)</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.actual_vs_predicted}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="index" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="actual" stroke="#4f46e5" strokeWidth={2} dot={false} name="Actual" />
              <Line type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={2} dot={false} name="Predicted" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
