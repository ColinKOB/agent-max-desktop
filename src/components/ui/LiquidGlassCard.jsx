/**
 * Liquid Glass Card Component
 * 
 * Premium glass morphism card following Apple's liquid glass aesthetic
 * Based on LiquidGlass.md specifications
 */
import React from 'react';
import { clsx } from 'clsx';

export function LiquidGlassCard({
  children,
  className = '',
  variant = 'default', // 'default', 'subtle', 'nested', 'elevated'
  size = 'default', // 'sm', 'default', 'lg'
  interactive = false,
  glow = false,
  animate = true,
  as: Component = 'div',
  ...props
}) {
  const variants = {
    default: 'liquid-glass-default',
    subtle: 'liquid-glass-subtle',
    nested: 'liquid-glass-nested',
    elevated: 'liquid-glass-elevated'
  };

  const sizes = {
    sm: 'liquid-glass-sm',
    default: 'liquid-glass-md',
    lg: 'liquid-glass-lg'
  };

  const cardClasses = clsx(
    // Base liquid glass styles
    'liquid-glass',
    
    // Variant
    variants[variant],
    
    // Size
    sizes[size],
    
    // Interactive states
    interactive && 'liquid-glass-interactive',
    
    // Glow effect
    glow && 'liquid-glass-glow',
    
    // Animation
    animate && 'liquid-glass-animate',
    
    // Custom classes
    className
  );

  return (
    <Component className={cardClasses} {...props}>
      {/* Wet highlight layer */}
      <div className="liquid-glass-highlight" />
      
      {/* Ambient goo blobs */}
      {glow && (
        <div className="liquid-glass-goo">
          <span className="blob blob-1" />
          <span className="blob blob-2" />
          <span className="blob blob-3" />
        </div>
      )}
      
      {/* Content */}
      <div className="liquid-glass-content">
        {children}
      </div>
    </Component>
  );
}

/**
 * Liquid Glass Panel - Full-height container
 */
export function LiquidGlassPanel({
  children,
  className = '',
  header,
  footer,
  ...props
}) {
  return (
    <div className={clsx('liquid-panel', className)} {...props}>
      {/* Background gradient */}
      <div className="liquid-panel-bg" />
      
      {/* Header */}
      {header && (
        <div className="liquid-panel-header">
          {header}
        </div>
      )}
      
      {/* Content */}
      <div className="liquid-panel-content">
        {children}
      </div>
      
      {/* Footer */}
      {footer && (
        <div className="liquid-panel-footer">
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * Liquid Glass Button - Premium button with glass effect
 */
export function LiquidGlassButton({
  children,
  variant = 'primary', // 'primary', 'secondary', 'ghost', 'pill'
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  className = '',
  ...props
}) {
  const variants = {
    primary: 'liquid-btn-primary',
    secondary: 'liquid-btn-secondary',
    ghost: 'liquid-btn-ghost',
    pill: 'liquid-btn-pill'
  };

  const sizes = {
    sm: 'liquid-btn-sm',
    md: 'liquid-btn-md',
    lg: 'liquid-btn-lg'
  };

  return (
    <button
      className={clsx(
        'liquid-btn',
        variants[variant],
        sizes[size],
        (loading || disabled) && 'liquid-btn-disabled',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {Icon && !loading && <Icon className="liquid-btn-icon" />}
      {loading && (
        <svg className="liquid-btn-spinner" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
        </svg>
      )}
      {children}
    </button>
  );
}

/**
 * Liquid Glass Input - Premium input field
 */
export function LiquidGlassInput({
  className = '',
  error = false,
  ...props
}) {
  return (
    <input
      className={clsx(
        'liquid-input',
        error && 'liquid-input-error',
        className
      )}
      {...props}
    />
  );
}

/**
 * Liquid Glass Surface - Main application surface
 */
export function LiquidGlassSurface({ children, className = '' }) {
  return (
    <div className={clsx('liquid-surface', className)}>
      {/* Animated background gradients */}
      <div className="liquid-surface-gradients">
        <div className="gradient-1" />
        <div className="gradient-2" />
        <div className="gradient-3" />
      </div>
      
      {/* Content */}
      <div className="liquid-surface-content">
        {children}
      </div>
    </div>
  );
}
