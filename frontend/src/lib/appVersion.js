import packageJson from "../../package.json"

/** Application version (SemVer). Synced with frontend/package.json. */
export const APP_VERSION = packageJson.version

/** Human-readable pre-release stage, derived from the version string. */
export function getAppReleaseStageLabel(version = APP_VERSION) {
  if (version.includes("-alpha")) return "Alpha"
  if (version.includes("-beta")) return "Beta"
  if (version.includes("-rc")) return "Release Candidate"
  if (version.startsWith("0.")) return "Pre-release"
  return null
}

export function formatAppVersionDisplay(version = APP_VERSION) {
  const stage = getAppReleaseStageLabel(version)
  const label = `v${version}`
  return stage ? `${label} · ${stage}` : label
}
