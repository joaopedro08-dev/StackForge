import { useEffect, useMemo, useState } from "react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ThemeControls, LocaleSelect, OptionSelect } from "@/features/initializr/initializr-controls"
import { initializrCopy } from "@/features/initializr/initializr.copy"
import { buildChoices, getStoredLocale, initializrDefaults, sanitizeProjectName, toArg, localeStorageKey } from "@/features/initializr/initializr.utils"
import type { ApiStyle, Architecture, Database, FeatureSet, Language, Locale, PackageManager, Profile } from "@/features/initializr/initializr.types"
import { useTheme } from "@/components/theme-provider"

export function App() {
  const { theme, setTheme } = useTheme()
  const [projectName, setProjectName] = useState(initializrDefaults.projectName)
  const [profile, setProfile] = useState<Profile>(initializrDefaults.profile)
  const [language, setLanguage] = useState<Language>(initializrDefaults.language)
  const [database, setDatabase] = useState<Database>(initializrDefaults.database)
  const [architecture, setArchitecture] = useState<Architecture>(initializrDefaults.architecture)
  const [apiStyle, setApiStyle] = useState<ApiStyle>(initializrDefaults.apiStyle)
  const [packageManager, setPackageManager] = useState<PackageManager>(initializrDefaults.packageManager)
  const [featureSet, setFeatureSet] = useState<FeatureSet>(initializrDefaults.featureSet)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCleaningDownloads, setIsCleaningDownloads] = useState(false)
  const [includeInstallSteps, setIncludeInstallSteps] = useState(true)
  const [resultOutput, setResultOutput] = useState("")
  const [resultWarning, setResultWarning] = useState("")
  const [resultError, setResultError] = useState("")
  const [locale, setLocale] = useState<Locale>(getStoredLocale)

  const t = initializrCopy[locale]
  const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "")
  const normalizedProjectName = projectName.trim() || initializrDefaults.projectName
  const safeProjectName = sanitizeProjectName(normalizedProjectName) || initializrDefaults.projectName

  function resolveApiUrl(endpointPath: string) {
    if (!configuredApiBaseUrl) {
      return endpointPath
    }

    return `${configuredApiBaseUrl}${endpointPath}`
  }

  useEffect(() => {
    window.localStorage.setItem(localeStorageKey, locale)
    document.documentElement.lang = locale
  }, [locale])

  const command = useMemo(() => {
    const args = [
      profile === "full" ? "--full" : "",
      language === "typescript" ? "--lang=typescript" : "",
      toArg("--db", database, initializrDefaults.database),
      toArg("--architecture", architecture, initializrDefaults.architecture),
      toArg("--api", apiStyle, initializrDefaults.apiStyle),
      toArg("--pm", packageManager, initializrDefaults.packageManager),
      toArg("--features", featureSet, initializrDefaults.featureSet),
    ].filter(Boolean)

    return `${t.commandPrefix} ${safeProjectName}${args.length > 0 ? ` ${args.join(" ")}` : ""}`
  }, [apiStyle, architecture, database, featureSet, language, packageManager, profile, safeProjectName, t.commandPrefix])

  const runtimeDevCommand =
    packageManager === "npm"
      ? "npm run dev"
      : packageManager === "yarn"
        ? "yarn dev"
        : packageManager === "bun"
          ? "bun run dev"
          : "pnpm dev"

  async function downloadProjectZip() {
    setIsGenerating(true)
    setResultError("")
    setResultWarning("")
    setResultOutput("")

    try {
      const requestBody = JSON.stringify({
        projectName: safeProjectName,
        profile,
        language,
        database,
        architecture,
        apiStyle,
        packageManager,
        featureSet,
      })

      // Step 1: Request project generation and get download token
      const response = await fetch(resolveApiUrl("/api/scaffold/projects/download"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
      })

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || ""
        let message = t.generateDownloadFailed

        if (contentType.includes("application/json")) {
          const payload = await response.json().catch(() => null)
          message = payload?.message || message
        } else {
          const text = await response.text().catch(() => "")
          if (text.trim()) {
            message = text.slice(0, 280)
          }
        }

        setResultError(`[HTTP ${response.status}] ${message}`)
        return
      }

      // Step 2: Parse response and resolve download endpoint
      const responseData = await response.json()
      const downloadToken = responseData?.downloadToken
      const downloadUrlFromResponse = responseData?.downloadUrl

      if (!downloadToken && !downloadUrlFromResponse) {
        setResultError(t.invalidDownloadResponse)
        return
      }

      // Step 3: Download the file using the token
      const downloadEndpoint = downloadUrlFromResponse
        ? downloadUrlFromResponse.startsWith("http")
          ? downloadUrlFromResponse
          : resolveApiUrl(downloadUrlFromResponse)
        : resolveApiUrl(`/api/scaffold/projects/download/${downloadToken}`)
      const downloadResponse = await fetch(downloadEndpoint, {
        method: "GET",
      })

      if (!downloadResponse.ok) {
        setResultError(`[HTTP ${downloadResponse.status}] ${t.downloadFileFailed}`)
        return
      }

      // Step 4: Trigger browser download
      const blob = await downloadResponse.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = `${safeProjectName}.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)

      setResultOutput(`${t.downloadStarted}: ${safeProjectName}.zip`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : ""
      const isNetworkFailure =
        error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(errorMessage)

      if (isNetworkFailure) {
        setResultError(`${t.generateDownloadFailed} ${t.renderSleepNotice}`)
        return
      }

      setResultError(errorMessage || t.unexpectedDownloadError)
    } finally {
      setIsGenerating(false)
    }
  }

  async function cleanupDownloads() {
    setIsCleaningDownloads(true)
    setResultError("")
    setResultWarning("")

    try {
      const response = await fetch(resolveApiUrl("/api/scaffold/projects/downloads"), {
        method: "DELETE",
      })

      const contentType = response.headers.get("content-type") || ""

      if (!response.ok) {
        let message = t.cleanupDownloadsFailed

        if (contentType.includes("application/json")) {
          const payload = await response.json().catch(() => null)
          message = payload?.message || message
        }

        setResultError(`[HTTP ${response.status}] ${message}`)
        return
      }

      let deletedCount = 0

      if (contentType.includes("application/json")) {
        const payload = await response.json().catch(() => null)
        deletedCount = Number(payload?.deletedCount || 0)
      }

      setResultWarning(`${t.cleanupDownloadsSuccess} ${deletedCount > 0 ? `(${deletedCount})` : ""}`.trim())
    } catch (error) {
      setResultError(error instanceof Error ? error.message : t.cleanupDownloadsFailed)
    } finally {
      setIsCleaningDownloads(false)
    }
  }

  function resetDefaults() {
    setProjectName(initializrDefaults.projectName)
    setProfile(initializrDefaults.profile)
    setLanguage(initializrDefaults.language)
    setDatabase(initializrDefaults.database)
    setArchitecture(initializrDefaults.architecture)
    setApiStyle(initializrDefaults.apiStyle)
    setPackageManager(initializrDefaults.packageManager)
    setFeatureSet(initializrDefaults.featureSet)
    setResultOutput("")
    setResultWarning("")
    setResultError("")
    setLocale("en")
    setTheme("system")
  }

  return (
    <main className="initializr-page min-h-svh p-4 md:p-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="initializr-panel md:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="initializr-kicker mb-2 text-xs tracking-[0.2em] text-muted-foreground uppercase">{t.heroKicker}</p>
              <h1 className="initializr-title text-3xl leading-tight font-semibold text-foreground md:text-5xl">{t.heroTitle}</h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">{t.heroSubtitle}</p>
            </div>
            <ThemeControls
              themeLabel={t.theme}
              activeTheme={theme}
              onLight={() => setTheme("light")}
              onDark={() => setTheme("dark")}
              onSystem={() => setTheme("system")}
              resetLabel={t.reset}
              onReset={resetDefaults}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2 md:col-span-2">
              <Input id="project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="auth-service" />
            </div>

            <OptionSelect label={t.profile} value={profile} onChange={setProfile} options={buildChoices(t.choices.profile)} />
            <OptionSelect label={t.language} value={language} onChange={setLanguage} options={buildChoices(t.choices.language)} />
            <OptionSelect label={t.database} value={database} onChange={setDatabase} options={buildChoices(t.choices.database)} />
            <OptionSelect label={t.architecture} value={architecture} onChange={setArchitecture} options={buildChoices(t.choices.architecture)} />
            <OptionSelect label={t.apiStyle} value={apiStyle} onChange={setApiStyle} options={buildChoices(t.choices.apiStyle)} />
            <OptionSelect label={t.packageManager} value={packageManager} onChange={setPackageManager} options={buildChoices(t.choices.packageManager)} />
            <OptionSelect label={t.featureSet} value={featureSet} onChange={setFeatureSet} options={buildChoices(t.choices.featureSet)} />

            <LocaleSelect label={t.locale} locale={locale} onChange={setLocale} locales={t.locales} />

            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/60 p-3 md:col-span-2">
              <Checkbox id="include-install-steps" checked={includeInstallSteps} onChange={(event) => setIncludeInstallSteps(event.target.checked)} />
              <label className="text-sm normal-case tracking-normal" htmlFor="include-install-steps">
                {t.installSteps}
              </label>
            </div>
          </div>
        </Card>

        <aside className="space-y-6">
          <Card className="initializr-panel">
            <CardHeader>
              <Badge className="w-fit">{t.executeGenerator}</Badge>
              <CardTitle className="text-lg">{t.generateTitle}</CardTitle>
              <CardDescription>{t.generateDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>{t.projectWillBeCreated} <strong>{safeProjectName}.zip</strong></Alert>
              {safeProjectName !== normalizedProjectName ? (
                <Alert className="mt-3 border-amber-300/60 bg-amber-50/80 text-amber-900">
                  {t.projectAdjusted} <strong>{safeProjectName}</strong> ({t.projectRules}).
                </Alert>
              ) : null}
            </CardContent>
            <CardFooter>
              <Button onClick={downloadProjectZip} disabled={isGenerating}>
                {isGenerating ? t.generatingButton : t.generateButton}
              </Button>
            </CardFooter>
          </Card>

          <Card className="initializr-panel">
            <CardHeader>
              <CardTitle className="text-lg">{t.downloadStatus}</CardTitle>
              <CardDescription>{t.downloadDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {resultError ? <Alert className="border-destructive/40 text-destructive">{resultError}</Alert> : null}
              {resultWarning ? <Alert className="border-amber-300/60 bg-amber-50/80 text-amber-900">{resultWarning}</Alert> : null}
              <Textarea readOnly value={resultOutput || t.noDownload} className="min-h-40 md:min-h-55 font-mono text-xs" />
            </CardContent>
            <CardFooter>
              <Button variant="secondary" onClick={cleanupDownloads} disabled={isCleaningDownloads || isGenerating}>
                {isCleaningDownloads ? t.cleaningDownloads : t.cleanupDownloads}
              </Button>
            </CardFooter>
          </Card>

          {includeInstallSteps ? (
            <Card className="initializr-panel">
              <CardHeader>
                <CardTitle className="text-lg">{t.nextSteps}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-2xl bg-muted/60 p-4 text-xs leading-relaxed whitespace-pre-wrap wrap-break-word">{`cd developers/projects/${safeProjectName}
${packageManager} ${t.installLine}
node -e "require('node:fs').copyFileSync('.env.example', '.env')"
${runtimeDevCommand}`}</pre>
              </CardContent>
            </Card>
          ) : null}

          <Card className="initializr-panel">
            <CardHeader>
              <CardTitle className="text-lg">{t.equivalentCli}</CardTitle>
              <CardDescription>{t.referenceOnly}</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="rounded-2xl bg-black/90 p-4 text-xs leading-relaxed text-green-300 whitespace-pre-wrap">{command}</pre>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  )
}

export default App
