interface IconProps {
  className?: string
}

const base = "stroke-current fill-none"
const props = { viewBox: "0 0 24 24", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

export function IconLayoutGrid({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

export function IconFileSearch({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <circle cx="10.5" cy="14.5" r="2.5" />
      <line x1="12.5" y1="16.5" x2="15" y2="19" />
    </svg>
  )
}

export function IconShieldAlert({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <path d="M12 2L3 6v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V6L12 2z" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

export function IconBarChart({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <line x1="3" y1="3" x2="3" y2="21" />
      <line x1="3" y1="21" x2="21" y2="21" />
      <line x1="7" y1="13" x2="7" y2="21" />
      <line x1="12" y1="8" x2="12" y2="21" />
      <line x1="17" y1="4" x2="17" y2="21" />
    </svg>
  )
}

export function IconUsers({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function IconSettings({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function IconSearch({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function IconBell({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

export function IconTrendingUp({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

export function IconTrendingDown({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  )
}

export function IconClock({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

export function IconCheckCircle({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

export function IconXCircle({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}

export function IconAlertTriangle({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

export function IconActivity({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

export function IconEye({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function IconMoreHorizontal({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props} fill="currentColor" strokeWidth={0}>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  )
}

export function IconMenu({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export function IconX({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function IconPlus({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function IconZap({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

export function IconUser({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

export function IconLogOut({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export function IconChevronDown({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function IconChevronRight({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export function IconFilter({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}

export function IconRefresh({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

export function IconDownload({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export function IconChevronLeft({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

export function IconCheck({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function IconArrowUpRight({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} {...props}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  )
}
