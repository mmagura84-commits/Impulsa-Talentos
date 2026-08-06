/**
 * Accessible confirm dialog for unsaved-changes guards.
 * Radix Dialog provides focus trap, Esc-to-cancel, aria-modal and labelled
 * regions out of the box.
 */
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface UnsavedChangesDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function UnsavedChangesDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: UnsavedChangesDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby="unsaved-desc"
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-xl data-[state=open]:animate-in data-[state=open]:zoom-in-95 focus:outline-none"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
              <AlertTriangle className="size-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <Dialog.Title className="font-serif text-lg font-bold text-foreground">
                {title}
              </Dialog.Title>
              <Dialog.Description id="unsaved-desc" className="mt-1 text-sm text-muted-foreground">
                {description}
              </Dialog.Description>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button onClick={onConfirm}>{confirmLabel}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
