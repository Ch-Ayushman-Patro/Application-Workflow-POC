import React from 'react';

export type BadgeVariant = 
  | 'default' 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'info' 
  | 'purple'
  | 'orange';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  pulse?: boolean;
  size?: 'sm' | 'md';
}

export function Badge({ 
  children, 
  variant = 'default', 
  dot = false,
  pulse = false,
  size = 'md',
  className = '',
  ...props 
}: BadgeProps) {
  const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
    default: {
      container: 'bg-slate-100 text-slate-700 border-slate-200/80',
      dot: 'bg-slate-500'
    },
    success: {
      container: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      dot: 'bg-emerald-500'
    },
    warning: {
      container: 'bg-amber-50 text-amber-800 border-amber-200/80',
      dot: 'bg-amber-500'
    },
    error: {
      container: 'bg-rose-50 text-rose-700 border-rose-200/80',
      dot: 'bg-rose-500'
    },
    info: {
      container: 'bg-blue-50 text-blue-700 border-blue-200/80',
      dot: 'bg-blue-500'
    },
    purple: {
      container: 'bg-violet-50 text-violet-700 border-violet-200/80',
      dot: 'bg-violet-500'
    },
    orange: {
      container: 'bg-orange-50 text-orange-700 border-orange-200/80',
      dot: 'bg-orange-500'
    }
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[11px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5'
  };

  const current = variantStyles[variant] || variantStyles.default;

  return (
    <span 
      className={`inline-flex items-center font-medium rounded-full border shadow-2xs transition-colors ${sizeStyles[size]} ${current.container} ${className}`}
      {...props}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${current.dot}`} />
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${current.dot}`} />
        </span>
      )}
      {children}
    </span>
  );
}


