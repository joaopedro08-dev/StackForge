import type { Choice, Locale } from "./initializr.types"

export const localeStorageKey = "stackforge.locale"

export const initializrDefaults = {
  projectName: "auth-service",
  profile: "lite" as const,
  language: "javascript" as const,
  database: "json" as const,
  architecture: "layered" as const,
  apiStyle: "rest" as const,
  packageManager: "pnpm" as const,
  featureSet: "auth" as const,
}

export function getStoredLocale(): Locale {
  const storedLocale = window.localStorage.getItem(localeStorageKey)

  if (storedLocale === "pt" || storedLocale === "es" || storedLocale === "en") {
    return storedLocale
  }

  const browserLanguage = window.navigator.language.toLowerCase()

  if (browserLanguage.startsWith("pt")) {
    return "pt"
  }

  if (browserLanguage.startsWith("es")) {
    return "es"
  }

  return "en"
}

export function sanitizeProjectName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}



export function toArg(flag: string, value: string, defaultValue: string) {
  if (value === defaultValue) {
    return ""
  }

  return `${flag}=${value}`
}

export function buildChoices<T extends string>(labels: Record<T, string>): Choice<T>[] {
  return Object.entries(labels).map(([value, label]) => ({
    value: value as T,
    label: String(label),
  }))
}
