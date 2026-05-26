import { Eye, EyeOff } from "lucide-react"

export default function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  show,
  onToggleShow,
  autoComplete,
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-600">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className="w-full rounded-md border border-gray-300 py-2 pr-10 pl-3 text-sm outline-none focus:border-blue-500"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-500 transition hover:text-gray-700"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
