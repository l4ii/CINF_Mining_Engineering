export function unitAddonClass(darkMode: boolean, heightClass = 'h-[38px]'): string {
  return `inline-flex ${heightClass} w-14 shrink-0 items-center justify-center rounded-r-md border border-l-0 text-center text-sm ${
    darkMode ? 'border-gray-600 bg-gray-700 text-gray-300' : 'border-gray-300 bg-gray-50 text-gray-500'
  }`
}

export function unitInputClass(extra = ''): string {
  return `h-[38px] min-w-0 flex-1 rounded-l-md border px-2 text-center text-sm outline-none ${extra}`
}

export function unitInputWithAddonClass(extra = ''): string {
  return unitInputClass(`pl-7 ${extra}`)
}
