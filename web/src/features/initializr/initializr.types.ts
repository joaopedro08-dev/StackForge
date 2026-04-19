export type Profile = "lite" | "full"
export type Language = "javascript" | "typescript"
export type Database = "json" | "postgresql" | "mysql" | "sqlite" | "sqlserver"
export type Architecture = "layered" | "mvc" | "clean"
export type ApiStyle = "rest" | "graphql" | "hybrid"
export type PackageManager = "pnpm" | "npm" | "yarn" | "bun"
export type FeatureSet = "auth" | "email" | "both" | "none"
export type Locale = "en" | "pt" | "es"

export type Choice<T extends string> = {
  value: T
  label: string
}

export type InitializrCopy = {
  heroKicker: string
  heroTitle: string
  heroSubtitle: string
  reset: string
  theme: string
  locale: string
  projectName: string
  profile: string
  language: string
  database: string
  architecture: string
  apiStyle: string
  packageManager: string
  featureSet: string
  installSteps: string
  executeGenerator: string
  generateTitle: string
  generateDescription: string
  projectWillBeCreated: string
  projectAdjusted: string
  projectRules: string
  apiBaseUrl: string
  usingProxy: string
  generateButton: string
  generatingButton: string
  downloadStatus: string
  downloadDescription: string
  noDownload: string
  generateDownloadFailed: string
  invalidDownloadResponse: string
  downloadFileFailed: string
  unexpectedDownloadError: string
  renderSleepNotice: string
  cleanupDownloads: string
  cleaningDownloads: string
  cleanupDownloadsFailed: string
  cleanupDownloadsSuccess: string
  nextSteps: string
  equivalentCli: string
  referenceOnly: string
  downloadStarted: string
  installLine: string
  runLine: string
  commandPrefix: string
  themes: Record<"light" | "dark" | "system", string>
  locales: Record<Locale, string>
  choices: {
    profile: Record<Profile, string>
    language: Record<Language, string>
    database: Record<Database, string>
    architecture: Record<Architecture, string>
    apiStyle: Record<ApiStyle, string>
    packageManager: Record<PackageManager, string>
    featureSet: Record<FeatureSet, string>
  }
}

export type InitializrStrings = Record<Locale, InitializrCopy>
