export interface CalendarParts {
  weekday: string
  day: string
  month: string
}

function titleCase(value: string): string {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value
}

export function calendarPartsFromDate(value: string): CalendarParts {
  const dateParts = value.split('-').map(Number)
  const year = dateParts[0]
  const month = dateParts[1]
  const day = dateParts[2]
  const date = year !== undefined && month !== undefined && day !== undefined && Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)
    ? new Date(year, month - 1, day)
    : new Date(value)

  return {
    weekday: titleCase(new Intl.DateTimeFormat('es-AR', { weekday: 'long' }).format(date)),
    day: new Intl.DateTimeFormat('es-AR', { day: 'numeric' }).format(date),
    month: titleCase(new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(date)),
  }
}
