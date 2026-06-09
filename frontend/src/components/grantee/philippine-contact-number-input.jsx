import {
  extractPhilippineContactDigits,
  formatPhilippineContactDisplay,
  getPhilippineContactInputValue,
  PH_CONTACT_MAX_LENGTH,
  PH_CONTACT_PLACEHOLDER,
  PH_CONTACT_PREFIX,
  sanitizeContactNumber,
} from "@/lib/contactNumber"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function PhilippineContactNumberInput({
  id,
  value,
  onChange,
  readOnly = false,
  disabled = false,
  required = false,
  className,
  placeholder = PH_CONTACT_PLACEHOLDER,
}) {
  if (readOnly || disabled) {
    const display = formatPhilippineContactDisplay(value) || "—"
    return (
      <p className={cn("text-sm font-medium leading-snug font-mono tracking-wide text-foreground", className)}>
        {display}
      </p>
    )
  }

  return (
    <Input
      id={id}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={getPhilippineContactInputValue(value)}
      onChange={(e) => onChange?.(sanitizeContactNumber(e.target.value))}
      onKeyDown={(e) => {
        const input = e.currentTarget
        const prefixLength = PH_CONTACT_PREFIX.length
        if (e.key === "Backspace" && input.selectionStart <= prefixLength && input.selectionEnd <= prefixLength) {
          e.preventDefault()
        }
      }}
      onFocus={(e) => {
        if (!extractPhilippineContactDigits(e.target.value)) {
          e.target.setSelectionRange(PH_CONTACT_PREFIX.length, PH_CONTACT_PREFIX.length)
        }
      }}
      placeholder={placeholder}
      maxLength={PH_CONTACT_MAX_LENGTH}
      required={required}
      className={cn("font-mono tracking-wide", className)}
    />
  )
}
