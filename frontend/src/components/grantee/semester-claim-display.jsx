import { CircleCheck, CircleDashed } from "lucide-react"

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { formatSemesterClaimedAt } from "@/lib/granteeSemesterClaims"
import { cn } from "@/lib/utils"

const semesterClaimSelectWrapperClass =
  "min-w-[122px] [&_[data-slot=native-select]]:h-8 [&_[data-slot=native-select]]:w-full [&_[data-slot=native-select]]:min-w-[122px] [&_[data-slot=native-select]]:rounded-md [&_[data-slot=native-select]]:border-input [&_[data-slot=native-select]]:bg-background [&_[data-slot=native-select]]:pl-2.5 [&_[data-slot=native-select]]:pr-8 [&_[data-slot=native-select]]:text-xs [&_[data-slot=native-select]]:shadow-xs [&_[data-slot=native-select]]:ring-0 [&_[data-slot=native-select]]:focus-visible:ring-2 [&_[data-slot=native-select]]:focus-visible:ring-ring/50 dark:[&_[data-slot=native-select]]:bg-input/30 [&_[data-slot=native-select-icon]]:right-2 [&_[data-slot=native-select-icon]]:size-3.5 [&_[data-slot=native-select-icon]]:stroke-[2.25] [&_[data-slot=native-select-icon]]:text-slate-500 dark:[&_[data-slot=native-select-icon]]:text-slate-400"

export function SemesterClaimStatusSelect({ className, ...props }) {
  return (
    <NativeSelect className={cn(semesterClaimSelectWrapperClass, className)} {...props}>
      <NativeSelectOption value="Claimed">Claimed</NativeSelectOption>
      <NativeSelectOption value="Unclaimed">Unclaimed</NativeSelectOption>
    </NativeSelect>
  )
}

export function SemesterClaimClaimerSelect({ className, ...props }) {
  return (
    <NativeSelect className={cn(semesterClaimSelectWrapperClass, className)} {...props}>
      <NativeSelectOption value="Grantee">Grantee</NativeSelectOption>
      <NativeSelectOption value="Other">Other</NativeSelectOption>
    </NativeSelect>
  )
}

export function ClaimSemesterBadge({ value }) {
  const claimed = value === "Claimed"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        claimed
          ? "border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-500/12 dark:text-emerald-100"
          : "border-amber-200/90 bg-amber-50 text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/12 dark:text-amber-100",
      )}
    >
      {claimed ? <CircleCheck className="size-3.5 shrink-0 opacity-90" /> : <CircleDashed className="size-3.5 shrink-0 opacity-90" />}
      {claimed ? "Claimed" : "Unclaimed"}
    </span>
  )
}

export function SemesterClaimInfo({ claimStatus, claimerType, otherName, claimedAt }) {
  if (claimStatus !== "Claimed") {
    return <p className="text-[11px] text-muted-foreground">No claim yet</p>
  }

  const when = claimedAt ? formatSemesterClaimedAt(claimedAt) : ""

  return (
    <div className="space-y-0.5">
      {when ? (
        <p className="text-[11px] text-muted-foreground" title={claimedAt}>
          Claimed on {when}
        </p>
      ) : null}
      <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
        Claimed by: {claimerType || "Grantee"}
      </p>
      {claimerType === "Other" && otherName ? (
        <p className="text-[11px] text-muted-foreground">Name: {otherName}</p>
      ) : null}
    </div>
  )
}

export function SemesterClaimedAtLabel({ claimedAt }) {
  const label = claimedAt ? formatSemesterClaimedAt(claimedAt) : ""
  if (!label) return null

  return (
    <p className="text-[11px] text-muted-foreground" title={claimedAt}>
      {label}
    </p>
  )
}

export function SemesterClaimCell({ semStatus, claimerType, otherName, claimedAt }) {
  return (
    <div className="space-y-1.5">
      <ClaimSemesterBadge value={semStatus} />
      <SemesterClaimInfo
        claimStatus={semStatus}
        claimerType={claimerType}
        otherName={otherName}
        claimedAt={semStatus === "Claimed" ? claimedAt : null}
      />
    </div>
  )
}
