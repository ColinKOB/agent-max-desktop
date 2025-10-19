/**
 * Button Component Library
 * 
 * Comprehensive button system with all variants and states
 */
import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

const variants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600',
  success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 dark:bg-green-500 dark:hover:bg-green-600',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-500 dark:hover:bg-red-600',
  warning: 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500 dark:bg-yellow-400 dark:hover:bg-yellow-500',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800',
  outline: 'bg-transparent border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800',
  link: 'bg-transparent text-blue-600 hover:text-blue-700 underline-offset-4 hover:underline dark:text-blue-400 dark:hover:text-blue-300'
};

const sizes = {
  xs: 'px-2.5 py-1.5 text-xs',
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-base',
  lg: 'px-5 py-3 text-lg',
  xl: 'px-6 py-3.5 text-xl'
};

const iconSizes = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-7 h-7'
};

export const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon: Icon,
  iconPosition = 'left',
  className = '',
  type = 'button',
  onClick,
  ...props
}, ref) => {
  const isDisabled = disabled || loading;
  const IconSize = iconSizes[size];

  const buttonClasses = clsx(
    // Base styles
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
    
    // Variant styles
    variants[variant],
    
    // Size styles
    sizes[size],
    
    // Width
    fullWidth && 'w-full',
    
    // Disabled styles
    isDisabled && 'opacity-50 cursor-not-allowed',
    
    // Custom classes
    className
  );

  const iconElement = loading ? (
    <Loader2 className={clsx(IconSize, 'animate-spin')} />
  ) : Icon ? (
    <Icon className={IconSize} />
  ) : null;

  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses}
      disabled={isDisabled}
      onClick={onClick}
      {...props}
    >
      {iconElement && iconPosition === 'left' && (
        <span className={children ? 'mr-2' : ''}>{iconElement}</span>
      )}
      {children}
      {iconElement && iconPosition === 'right' && (
        <span className={children ? 'ml-2' : ''}>{iconElement}</span>
      )}
    </button>
  );
});

Button.displayName = 'Button';

/**
 * Icon Button Component
 */
export const IconButton = forwardRef(({
  icon: Icon,
  variant = 'ghost',
  size = 'md',
  className = '',
  'aria-label': ariaLabel,
  ...props
}, ref) => {
  const buttonSizes = {
    xs: 'p-1',
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
    xl: 'p-3'
  };

  const IconSize = iconSizes[size];

  return (
    <button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
        variants[variant],
        buttonSizes[size],
        className
      )}
      aria-label={ariaLabel}
      {...props}
    >
      <Icon className={IconSize} />
    </button>
  );
});

IconButton.displayName = 'IconButton';

/**
 * Button Group Component
 */
export function ButtonGroup({ 
  children, 
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  className = '' 
}) {
  return (
    <div className={clsx(
      'inline-flex rounded-lg shadow-sm',
      fullWidth && 'w-full',
      className
    )}>
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return null;
        
        const isFirst = index === 0;
        const isLast = index === React.Children.count(children) - 1;
        
        return React.cloneElement(child, {
          variant,
          size,
          className: clsx(
            child.props.className,
            !isFirst && '-ml-px',
            !isFirst && !isLast && 'rounded-none',
            isFirst && 'rounded-r-none',
            isLast && 'rounded-l-none'
          )
        });
      })}
    </div>
  );
}

/**
 * Toggle Button Component
 */
export function ToggleButton({
  children,
  pressed = false,
  onPressedChange,
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}) {
  return (
    <Button
      variant={pressed ? 'primary' : variant}
      size={size}
      className={className}
      onClick={() => onPressedChange?.(!pressed)}
      aria-pressed={pressed}
      {...props}
    >
      {children}
    </Button>
  );
}

/**
 * Split Button Component
 */
export function SplitButton({
  children,
  menuItems = [],
  variant = 'primary',
  size = 'md',
  className = ''
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative inline-flex rounded-lg shadow-sm">
      <Button
        variant={variant}
        size={size}
        className="rounded-r-none"
      >
        {children}
      </Button>
      <button
        className={clsx(
          'px-2 -ml-px rounded-r-lg border-l border-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2',
          variants[variant]
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1">
            {menuItems.map((item, index) => (
              <button
                key={index}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => {
                  item.onClick?.();
                  setIsOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Floating Action Button
 */
export function FAB({
  icon: Icon,
  label,
  variant = 'primary',
  position = 'bottom-right',
  onClick,
  className = ''
}) {
  const positions = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6'
  };

  return (
    <button
      className={clsx(
        'fixed z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all duration-200 hover:shadow-xl',
        variants[variant],
        positions[position],
        className
      )}
      onClick={onClick}
    >
      {Icon && <Icon className="w-5 h-5" />}
      {label && <span className="font-medium">{label}</span>}
    </button>
  );
}

/**
 * Progress Button
 */
export function ProgressButton({
  children,
  progress = 0,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) {
  return (
    <div className="relative inline-flex">
      <Button
        variant={variant}
        size={size}
        className={clsx('relative overflow-hidden', className)}
        {...props}
      >
        <div 
          className="absolute inset-0 bg-white/20"
          style={{ width: `${progress}%`, transition: 'width 0.3s ease' }}
        />
        <span className="relative z-10">{children}</span>
      </Button>
    </div>
  );
}

/**
 * Copy Button
 */
export function CopyButton({ text, onCopy, size = 'sm' }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleCopy}
      className="font-mono"
    >
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  );
}
