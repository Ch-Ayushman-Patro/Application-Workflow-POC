import React from 'react';

export function Skeleton({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={`animate-pulse bg-slate-200/70 rounded-xl ${className}`} 
      {...props}
    />
  );
}


