/** The "24 h average" footnote shared by the instrument cards. */
export function TwentyFourHourAverage({
  value,
  unit,
  digits = 1,
}: {
  value: number | null
  unit: string
  digits?: number
}) {
  if (value === null) {
    return <>No history yet</>
  }

  return (
    <span className="flex items-baseline justify-between gap-2">
      <span>24 h average</span>
      <span className="font-extrabold text-ink tabular">
        {value.toFixed(digits)} <span className="font-bold text-muted">{unit}</span>
      </span>
    </span>
  )
}
