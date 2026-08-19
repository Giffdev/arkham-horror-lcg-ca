import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function CardActionArea({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action-area"
      className={cn('flex flex-wrap items-center justify-end gap-1 self-start', className)}
      {...props}
    />
  )
}
