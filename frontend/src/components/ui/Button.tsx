import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading = false,
  icon,
  className = '', 
  disabled,
  ...props 
}: ButtonProps) {
  const baseStyle = "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-hidden active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
  
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs hover:shadow-sm focus:ring-2 focus:ring-indigo-500/20",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60 focus:ring-2 focus:ring-slate-400/20",
    outline: "border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 shadow-xs hover:border-slate-400 focus:ring-2 focus:ring-indigo-500/20",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-xs hover:shadow-sm focus:ring-2 focus:ring-rose-500/20",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs hover:shadow-sm focus:ring-2 focus:ring-emerald-500/20"
  };

  const sizes = {
    xs: "px-2.5 py-1 text-xs gap-1.5",
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5",
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} 
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}


