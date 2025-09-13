"use client"

import * as Dialog from '@radix-ui/react-dialog'
import { signInGoogle } from '@/lib/auth'
import dynamic from 'next/dynamic'
import { PropsWithChildren } from 'react'

const XIcon = dynamic(() => import('lucide-react').then(m => m.X), { ssr: false })

export type AuthModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  ctaLabel?: string
}

export default function AuthModal({ open, onOpenChange, title, description, ctaLabel }: PropsWithChildren<AuthModalProps>) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-800 bg-slate-900 p-5 shadow-xl focus:outline-none">
          <div className="flex items-start justify-between">
            <Dialog.Title className="text-base font-semibold text-slate-100">{title || 'Inicia sesión'}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-md border border-slate-700 p-1 text-slate-300 hover:bg-slate-800" aria-label="Cerrar">
                <XIcon size={16} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-2 text-sm text-slate-400">
            {description || 'Inicia sesión para disfrutar de esta funcionalidad.'}
          </Dialog.Description>

          <div className="mt-5 flex justify-end gap-3">
            <Dialog.Close asChild>
              <button
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </button>
            </Dialog.Close>
            <button
              className="rounded-md border border-sky-600 bg-sky-900/30 px-3 py-1.5 text-sm text-sky-200 hover:bg-sky-900/50"
              onClick={() => signInGoogle()}
            >
              {ctaLabel || 'Iniciar sesión con Google'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
