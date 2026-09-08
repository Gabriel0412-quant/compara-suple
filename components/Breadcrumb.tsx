import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export type BreadcrumbItem = {
  label: string
  href?: string
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 overflow-x-auto text-sm text-ink-3"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1 whitespace-nowrap">
            {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-ink-4" />}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-brand-strong"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={isLast ? 'max-w-xs truncate font-medium text-ink' : ''}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
