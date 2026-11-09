'use client';

import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button';

/**
 * The one and only "are you sure?" dialog, used before every delete.
 *
 * Both answers are full-width 80px buttons with plain-language labels
 * ("Yes, delete it" / "No, keep it") — never a bare OK/Cancel, and never a
 * small X as the safe way out.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  pending = false,
  tone = 'destructive',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  tone?: 'destructive' | 'default';
}) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <AlertDialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2',
            'rounded-2xl border border-border bg-card p-6 shadow-2xl',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
          )}
        >
          <div className="flex items-start gap-4">
            <span
              aria-hidden
              className={cn(
                'flex size-14 shrink-0 items-center justify-center rounded-full',
                tone === 'destructive' ? 'bg-destructive-tint text-destructive' : 'bg-muted',
              )}
            >
              <AlertTriangle className="size-8" />
            </span>
            <div className="space-y-2">
              <AlertDialogPrimitive.Title className="text-2xl font-bold">
                {title}
              </AlertDialogPrimitive.Title>
              <AlertDialogPrimitive.Description className="text-lg text-muted-foreground">
                {description}
              </AlertDialogPrimitive.Description>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse">
            <AlertDialogPrimitive.Action
              onClick={(event) => {
                // Keep the dialog open while the server action runs.
                event.preventDefault();
                onConfirm();
              }}
              disabled={pending}
              className={cn(
                buttonVariants({ variant: tone === 'destructive' ? 'danger' : 'default', size: 'lg' }),
                'flex-1',
              )}
            >
              {confirmLabel}
            </AlertDialogPrimitive.Action>
            <AlertDialogPrimitive.Cancel
              disabled={pending}
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'flex-1')}
            >
              {cancelLabel}
            </AlertDialogPrimitive.Cancel>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
