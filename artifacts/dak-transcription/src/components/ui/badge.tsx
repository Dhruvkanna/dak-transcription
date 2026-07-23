import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "bg-background-3 text-foreground": variant === 'default',
          "bg-success-bg text-success border-success/20 border": variant === 'success',
          "bg-warning-bg text-warning border-warning/20 border": variant === 'warning',
          "bg-danger-bg text-danger border-danger/20 border": variant === 'danger',
          "bg-info-bg text-info border-info/20 border": variant === 'info',
          "text-foreground border": variant === 'outline',
        },
        className
      )}
      {...props}
    />
  );
}
