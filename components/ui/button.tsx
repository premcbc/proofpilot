import { ReactNode } from 'react'

interface ButtonProps {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  ariaLabel?: string
}

const variants = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 border-transparent',
  secondary: 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700 hover:border-slate-600',
  ghost: 'bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border-transparent',
  danger: 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20 hover:border-red-500/40',
}

const sizes = {
  sm: 'h-7 px-2.5 text-xs rounded-md gap-1.5',
  md: 'h-8 px-3 text-sm rounded-md gap-2',
  lg: 'h-10 px-4 text-sm rounded-lg gap-2',
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className = '',
  onClick,
  disabled,
  type = 'button',
  ariaLabel,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={[
        'inline-flex items-center justify-center font-medium border transition-all duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}
