import type { ReactNode } from "react"
import { Languages, Monitor, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import type { Choice, Locale } from "./initializr.types"

export function ThemeButton({
  children,
  label,
  active,
  onClick,
}: {
  children: ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Button variant={active ? "default" : "outline"} size="icon" aria-label={label} title={label} onClick={onClick}>
      {children}
    </Button>
  )
}

export function ThemeControls({
  themeLabel,
  activeTheme,
  onLight,
  onDark,
  onSystem,
  resetLabel,
  onReset,
}: {
  themeLabel: string
  activeTheme: "light" | "dark" | "system"
  onLight: () => void
  onDark: () => void
  onSystem: () => void
  resetLabel: string
  onReset: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 hidden items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase md:inline-flex">
        {themeLabel}
      </span>
      <ThemeButton label="Light" active={activeTheme === "light"} onClick={onLight}>
        <Sun className="size-4" />
      </ThemeButton>
      <ThemeButton label="Dark" active={activeTheme === "dark"} onClick={onDark}>
        <Moon className="size-4" />
      </ThemeButton>
      <ThemeButton label="System" active={activeTheme === "system"} onClick={onSystem}>
        <Monitor className="size-4" />
      </ThemeButton>
      <Button variant="secondary" onClick={onReset}>
        {resetLabel}
      </Button>
    </div>
  )
}

export function OptionSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: readonly Choice<T>[]
}) {
  return (
    <label className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="capitalize">
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  )
}

export function LocaleSelect({
  label,
  locale,
  onChange,
  locales,
}: {
  label: string
  locale: Locale
  onChange: (value: Locale) => void
  locales: Record<Locale, string>
}) {
  return (
    <div className="flex flex-col gap-2 md:col-span-2 md:grid md:grid-cols-2 md:items-center">
      <Label className="inline-flex items-center gap-2">
        <Languages className="size-4" />
        {label}
      </Label>
      <Select value={locale} onChange={(event) => onChange(event.target.value as Locale)}>
        <option value="en">{locales.en}</option>
        <option value="pt">{locales.pt}</option>
        <option value="es">{locales.es}</option>
      </Select>
    </div>
  )
}
