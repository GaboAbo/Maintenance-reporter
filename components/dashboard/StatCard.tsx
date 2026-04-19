type Props = {
  title: string
  value: string | number
  subtitle?: string
}

export function StatCard({ title, value, subtitle }: Props) {
  return (
    <div className="rounded-lg border bg-white p-5">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-zinc-400">{subtitle}</p> : null}
    </div>
  )
}
