import { cn } from "@/lib/utils"

const navy = "#081F5C"
const borderBvSoft = "rgba(99, 102, 241, 0.18)"
const gradientNavyButton =
  "linear-gradient(135deg, #081F5C 0%, #0b2b73 42%, #1447a6 78%, #2a63cc 100%)"

export function orderWorkflowPrograms(programs, defaultProgramOrder) {
  const active = programs.filter((program) => program.active !== false)
  const byCode = new Map(active.map((program) => [String(program.code ?? "").trim().toUpperCase(), program]))

  const orderedCodes = [
    ...defaultProgramOrder.filter((code) => byCode.has(code)),
    ...[...byCode.keys()]
      .filter((code) => !defaultProgramOrder.includes(code))
      .sort((a, b) => a.localeCompare(b)),
  ]

  return orderedCodes.map((code) => byCode.get(code)).filter(Boolean)
}

export default function ProcessWorkflowProgramTabs({
  programs,
  activeCode,
  onChange,
  className,
  tabIdPrefix = "workflow",
}) {
  if (programs.length <= 1) return null

  return (
    <div
      className={cn("mb-5 flex flex-wrap gap-2 sm:mb-6", className)}
      role="tablist"
      aria-label="Scholarship program workflow"
    >
      {programs.map((program) => {
        const code = String(program.code ?? "").trim().toUpperCase()
        const isActive = activeCode === code

        return (
          <button
            key={code}
            type="button"
            role="tab"
            id={`${tabIdPrefix}-tab-${code}`}
            aria-selected={isActive}
            aria-controls={`${tabIdPrefix}-panel-${code}`}
            onClick={() => onChange(code)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              isActive
                ? "border-transparent text-white shadow-[0_10px_24px_-10px_rgba(8,31,92,0.45)] focus-visible:ring-[#1447a6]"
                : "bg-white/85 hover:bg-white focus-visible:ring-[#a5b4fc]",
            )}
            style={
              isActive
                ? { backgroundImage: gradientNavyButton }
                : { borderColor: borderBvSoft, color: navy }
            }
          >
            {program.name || code}
          </button>
        )
      })}
    </div>
  )
}
