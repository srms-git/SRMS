import { useId } from "react"
import { Calendar, CircleCheck, CircleDashed, Phone, User, Users } from "lucide-react"

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Input } from "@/components/ui/input"
import { formatPhilippineContactDisplay } from "@/lib/contactNumber"
import { PhilippineContactNumberInput } from "@/components/grantee/philippine-contact-number-input"
import { formatSemesterClaimedAt } from "@/lib/granteeSemesterClaims"
import { cn } from "@/lib/utils"

const semesterClaimSelectWrapperClass =
  "min-w-[122px] [&_[data-slot=native-select]]:h-8 [&_[data-slot=native-select]]:w-full [&_[data-slot=native-select]]:min-w-[122px] [&_[data-slot=native-select]]:rounded-md [&_[data-slot=native-select]]:border-input [&_[data-slot=native-select]]:bg-background [&_[data-slot=native-select]]:pl-2.5 [&_[data-slot=native-select]]:pr-8 [&_[data-slot=native-select]]:text-xs [&_[data-slot=native-select]]:shadow-xs [&_[data-slot=native-select]]:ring-0 [&_[data-slot=native-select]]:focus-visible:ring-2 [&_[data-slot=native-select]]:focus-visible:ring-ring/50 dark:[&_[data-slot=native-select]]:bg-input/30 [&_[data-slot=native-select-icon]]:right-2 [&_[data-slot=native-select-icon]]:size-3.5 [&_[data-slot=native-select-icon]]:stroke-[2.25] [&_[data-slot=native-select-icon]]:text-slate-500 dark:[&_[data-slot=native-select-icon]]:text-slate-400"

const otherPersonPanelClass =
  "rounded-lg border border-[#081F5C]/14 bg-linear-to-br from-slate-50/95 to-[#081F5C]/[0.04] p-2.5 shadow-[0_1px_0_0_rgba(15,23,42,0.04)] dark:border-[#081F5C]/28 dark:from-slate-900/55 dark:to-[#081F5C]/10"

const claimerIconGranteeClass =
  "bg-[#081F5C]/10 text-[#081F5C] dark:bg-[#081F5C]/25 dark:text-sky-200"
const claimerIconRepresentativeClass =
  "bg-[#1447a6]/12 text-[#081F5C] dark:bg-[#1447a6]/22 dark:text-sky-200"

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
      <NativeSelectOption value="Other">Other (representative)</NativeSelectOption>
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

function OtherPersonDetailRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex gap-2.5">
      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/90 text-[#081F5C] shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800/80 dark:text-sky-200 dark:ring-white/10"
        aria-hidden
      >
        <Icon className="size-3.5" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-xs font-medium leading-snug text-slate-900 dark:text-slate-100">{value}</dd>
      </div>
    </div>
  )
}

export function OtherPersonDetails({ name, relation, contact, className, title = "Representative" }) {
  const hasAny = Boolean(String(name ?? "").trim() || String(relation ?? "").trim() || String(contact ?? "").trim())

  if (!hasAny) {
    return (
      <div className={cn(otherPersonPanelClass, className)}>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#081F5C]/75 dark:text-sky-300/85">{title}</p>
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">No name, relation, or contact recorded yet.</p>
      </div>
    )
  }

  return (
    <div className={cn(otherPersonPanelClass, className)}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#081F5C]/75 dark:text-sky-300/85">{title}</p>
      <dl className="space-y-2">
        <OtherPersonDetailRow icon={User} label="Full name" value={String(name ?? "").trim()} />
        <OtherPersonDetailRow icon={Users} label="Relation to grantee" value={String(relation ?? "").trim()} />
        <OtherPersonDetailRow icon={Phone} label="Contact number" value={formatPhilippineContactDisplay(contact)} />
      </dl>
    </div>
  )
}

function OtherPersonField({ id, label, icon: Icon, children }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        <Icon className="size-3 shrink-0 text-[#081F5C]/70 dark:text-sky-300/80" aria-hidden />
        {label}
      </label>
      {children}
    </div>
  )
}

export function OtherPersonFields({
  name,
  relation,
  contact,
  onNameChange,
  onRelationChange,
  onContactChange,
  namePlaceholder = "e.g. Maria Santos",
  relationPlaceholder = "e.g. Parent, Guardian, Sibling",
  contactPlaceholder,
  required = false,
  className,
  title = "Representative details",
  description = "Required when someone other than the grantee claimed on their behalf.",
}) {
  const baseId = useId()

  return (
    <div className={cn(otherPersonPanelClass, "space-y-2.5", className)}>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#081F5C]/75 dark:text-sky-300/85">{title}</p>
        {description ? <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-2">
        <OtherPersonField id={`${baseId}-name`} label="Full name" icon={User}>
          <Input
            id={`${baseId}-name`}
            value={name ?? ""}
            onChange={onNameChange}
            placeholder={namePlaceholder}
            className="h-8 w-full text-xs"
            required={required}
            autoComplete="name"
          />
        </OtherPersonField>
        <OtherPersonField id={`${baseId}-relation`} label="Relation to grantee" icon={Users}>
          <Input
            id={`${baseId}-relation`}
            value={relation ?? ""}
            onChange={onRelationChange}
            placeholder={relationPlaceholder}
            className="h-8 w-full text-xs"
            autoComplete="off"
          />
        </OtherPersonField>
        <OtherPersonField id={`${baseId}-contact`} label="Contact number" icon={Phone}>
          <PhilippineContactNumberInput
            id={`${baseId}-contact`}
            value={contact}
            onChange={(formatted) =>
              onContactChange({
                target: { value: formatted },
              })
            }
            placeholder={contactPlaceholder}
            className="h-8 w-full text-xs"
          />
        </OtherPersonField>
      </div>
    </div>
  )
}

export function SemesterClaimInfo({ claimStatus, claimerType, otherName, otherRelation, otherContact, claimedAt }) {
  if (claimStatus !== "Claimed") {
    return <p className="text-[11px] text-muted-foreground">Not claimed for this semester.</p>
  }

  const when = claimedAt ? formatSemesterClaimedAt(claimedAt) : ""
  const claimer = claimerType || "Grantee"
  const isOther = claimer === "Other"

  return (
    <div className="space-y-2">
      {when ? (
        <p
          className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-slate-100/90 px-2 py-1 text-[11px] text-muted-foreground dark:bg-white/8"
          title={claimedAt}
        >
          <Calendar className="size-3 shrink-0 opacity-80" aria-hidden />
          <span>Claimed {when}</span>
        </p>
      ) : null}
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md",
            isOther ? claimerIconRepresentativeClass : claimerIconGranteeClass,
          )}
          aria-hidden
        >
          {isOther ? <Users className="size-3.5" /> : <User className="size-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Claimed by</p>
          <p className="text-xs font-semibold text-slate-900 dark:text-white">{isOther ? "Representative (other)" : "Grantee"}</p>
        </div>
      </div>
      {isOther ? (
        <OtherPersonDetails name={otherName} relation={otherRelation} contact={otherContact} />
      ) : null}
    </div>
  )
}

export function RequirementSubmittedByInfo({ submittedBy, otherName, otherRelation, otherContact }) {
  const by = submittedBy || "Grantee"
  const isOther = by === "Other"

  return (
    <div className="space-y-2 border-t border-slate-200/80 pt-2 dark:border-white/10">
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md",
            isOther ? claimerIconRepresentativeClass : claimerIconGranteeClass,
          )}
          aria-hidden
        >
          {isOther ? <Users className="size-3" /> : <User className="size-3" />}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Submitted by</p>
          <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">{isOther ? "Representative (other)" : "Grantee"}</p>
        </div>
      </div>
      {isOther ? (
        <OtherPersonDetails
          name={otherName}
          relation={otherRelation}
          contact={otherContact}
          title="Submitter"
          className="mt-0"
        />
      ) : null}
    </div>
  )
}

export function RequirementSubmittedByFields({
  submittedBy,
  otherName,
  otherRelation,
  otherContact,
  onSubmittedByChange,
  onOtherNameChange,
  onOtherRelationChange,
  onOtherContactChange,
  selectId,
}) {
  return (
    <div className="space-y-2 border-t border-slate-200/80 pt-2 dark:border-white/10">
      <label htmlFor={selectId} className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        Submitted by
      </label>
      <SemesterClaimClaimerSelect id={selectId} value={submittedBy || "Grantee"} onChange={onSubmittedByChange} />
      {submittedBy === "Other" ? (
        <OtherPersonFields
          name={otherName}
          relation={otherRelation}
          contact={otherContact}
          onNameChange={onOtherNameChange}
          onRelationChange={onOtherRelationChange}
          onContactChange={onOtherContactChange}
          namePlaceholder="Name of person"
          title="Submitter details"
          description="Who submitted the requirements on behalf of the grantee."
          required
        />
      ) : null}
    </div>
  )
}

export function SemesterClaimedAtLabel({ claimedAt }) {
  const label = claimedAt ? formatSemesterClaimedAt(claimedAt) : ""
  if (!label) return null

  return (
    <p
      className="inline-flex items-center gap-1.5 rounded-md bg-slate-100/90 px-2 py-1 text-[11px] text-muted-foreground dark:bg-white/8"
      title={claimedAt}
    >
      <Calendar className="size-3 shrink-0 opacity-80" aria-hidden />
      {label}
    </p>
  )
}

export function SemesterClaimCell({ semStatus, claimerType, otherName, otherRelation, otherContact, claimedAt }) {
  return (
    <div className="min-w-[200px] max-w-[280px] space-y-2 py-0.5">
      <ClaimSemesterBadge value={semStatus} />
      <SemesterClaimInfo
        claimStatus={semStatus}
        claimerType={claimerType}
        otherName={otherName}
        otherRelation={otherRelation}
        otherContact={otherContact}
        claimedAt={semStatus === "Claimed" ? claimedAt : null}
      />
    </div>
  )
}
