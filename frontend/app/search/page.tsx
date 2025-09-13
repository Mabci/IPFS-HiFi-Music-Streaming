export default async function SearchPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const params = await searchParams
  const q = (params?.q || '').toString()
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Buscar</h1>
      <p className="text-sm text-slate-400">
        Query: {q ? <span className="text-slate-200">“{q}”</span> : '—'}
      </p>
      <div className="rounded-md border border-slate-800 p-4">
        <div className="text-sm text-slate-400">
          Resultados próximamente. Esta es una página mock.
        </div>
      </div>
    </div>
  )
}
