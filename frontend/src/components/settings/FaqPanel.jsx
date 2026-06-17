import { useMemo, useState } from "react"
import { BookOpen, ChevronDown, ChevronRight, Download, FileText, HelpCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getMockFaqItems, MOCK_USER_MANUAL } from "@/lib/supportMockData"
import { cn } from "@/lib/utils"

function FaqAccordionItem({ item, isOpen, onToggle }) {
  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
        aria-expanded={isOpen}
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#081F5C]/60">
            {item.category}
          </span>
          <span className="mt-0.5 block text-sm font-medium text-gray-900">{item.question}</span>
        </span>
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <p className="border-t border-gray-100 px-4 py-3 text-sm leading-relaxed text-gray-700">{item.answer}</p>
        </div>
      </div>
    </article>
  )
}

export default function FaqPanel({ workspace = "cashier" }) {
  const faqItems = useMemo(() => getMockFaqItems(workspace), [workspace])
  const [openFaqId, setOpenFaqId] = useState(faqItems[0]?.id ?? "")
  const [manualOpen, setManualOpen] = useState(false)
  const [downloadNoticeOpen, setDownloadNoticeOpen] = useState(false)
  const [activeManualSectionId, setActiveManualSectionId] = useState(MOCK_USER_MANUAL.sections[0]?.id ?? "")

  const activeManualSection = useMemo(
    () => MOCK_USER_MANUAL.sections.find((section) => section.id === activeManualSectionId) ?? MOCK_USER_MANUAL.sections[0],
    [activeManualSectionId],
  )

  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-blue-700" />
          <h3 className="text-base font-semibold text-gray-900">FAQ</h3>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Quick answers to common questions. Content below is temporary mock data until the official FAQ is published.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-900">Frequently asked questions</p>
        <div className="space-y-2">
          {faqItems.map((item) => (
            <FaqAccordionItem
              key={item.id}
              item={item}
              isOpen={openFaqId === item.id}
              onToggle={() => setOpenFaqId((current) => (current === item.id ? "" : item.id))}
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[#081F5C]/10 bg-[#081F5C]/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#081F5C] text-white shadow-sm">
              <BookOpen className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">User manual</h4>
              <p className="text-xs text-gray-600">
                {MOCK_USER_MANUAL.title} · {MOCK_USER_MANUAL.version} · Updated {MOCK_USER_MANUAL.lastUpdated}
              </p>
              <p className="mt-1 max-w-2xl text-sm text-gray-700">{MOCK_USER_MANUAL.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-[#081F5C]/20 bg-white px-3 py-2 text-sm font-medium text-[#081F5C] transition hover:bg-[#081F5C]/5"
            >
              <FileText className="h-4 w-4" aria-hidden />
              View manual
            </button>
            <button
              type="button"
              onClick={() => setDownloadNoticeOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-[#081F5C]/20 bg-white px-3 py-2 text-sm font-medium text-[#081F5C] transition hover:bg-[#081F5C]/5"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download manual
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {MOCK_USER_MANUAL.sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => {
                setActiveManualSectionId(section.id)
                setManualOpen(true)
              }}
              className="flex items-center justify-between rounded-lg border border-white/80 bg-white px-3 py-2.5 text-left text-sm text-gray-800 transition hover:border-[#081F5C]/20 hover:bg-white"
            >
              <span className="font-medium">{section.title}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            </button>
          ))}
        </div>
      </div>

      <Dialog open={downloadNoticeOpen} onOpenChange={setDownloadNoticeOpen}>
        <DialogContent className="border border-slate-200 bg-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Coming soon</DialogTitle>
            <DialogDescription>
              The official SRMS user manual download will be available here once it is published.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDownloadNoticeOpen(false)}
              className="rounded-md bg-linear-to-r from-[#04133d] to-[#0b2b73] px-4 py-2 text-sm text-white transition hover:brightness-110"
            >
              OK
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col border border-slate-200 bg-white sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{MOCK_USER_MANUAL.title}</DialogTitle>
            <DialogDescription>
              {MOCK_USER_MANUAL.version} · Last updated {MOCK_USER_MANUAL.lastUpdated}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-4 overflow-hidden md:grid-cols-[220px_1fr]">
            <nav className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/80 p-2 md:max-h-none">
              {MOCK_USER_MANUAL.sections.map((section) => {
                const selected = section.id === activeManualSection?.id
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveManualSectionId(section.id)}
                    className={cn(
                      "block w-full rounded-md px-3 py-2 text-left text-sm transition",
                      selected
                        ? "bg-[#081F5C] font-medium text-white"
                        : "text-gray-700 hover:bg-white hover:text-[#081F5C]",
                    )}
                  >
                    {section.title}
                  </button>
                )
              })}
            </nav>

            <article className="min-h-0 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4">
              <h4 className="text-base font-semibold text-gray-900">{activeManualSection?.title}</h4>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-700">
                {String(activeManualSection?.content ?? "")
                  .split("\n\n")
                  .map((paragraph, index) => (
                    <p key={`${activeManualSection?.id}-p-${index}`}>{paragraph}</p>
                  ))}
              </div>
            </article>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
