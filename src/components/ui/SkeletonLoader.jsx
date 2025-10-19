/**
 * Skeleton Loader Component
 * 
 * Provides elegant loading states with skeleton animations
 */
import React from 'react';

export function SkeletonLoader({ 
  variant = 'text', 
  count = 1, 
  height, 
  width,
  className = '',
  lines = 3,
  animate = true
}) {
  const baseClasses = `${animate ? 'animate-pulse' : ''} bg-gray-200 dark:bg-gray-700 rounded`;
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'text':
        return {
          height: height || '1rem',
          width: width || '100%',
          marginBottom: '0.5rem'
        };
      case 'title':
        return {
          height: height || '2rem',
          width: width || '60%',
          marginBottom: '1rem'
        };
      case 'card':
        return {
          height: height || '8rem',
          width: width || '100%',
          marginBottom: '1rem'
        };
      case 'avatar':
        return {
          height: height || '3rem',
          width: width || height || '3rem',
          borderRadius: '50%'
        };
      case 'button':
        return {
          height: height || '2.5rem',
          width: width || '6rem'
        };
      case 'image':
        return {
          height: height || '12rem',
          width: width || '100%',
          borderRadius: '0.5rem'
        };
      case 'table-row':
        return {
          height: height || '3rem',
          width: width || '100%',
          marginBottom: '0.25rem'
        };
      default:
        return {
          height: height || '1rem',
          width: width || '100%'
        };
    }
  };

  const styles = getVariantStyles();

  if (variant === 'text' && lines > 1) {
    return (
      <div className={className}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={baseClasses}
            style={{
              ...styles,
              width: index === lines - 1 ? '80%' : '100%'
            }}
          />
        ))}
      </div>
    );
  }

  if (count > 1) {
    return (
      <>
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={`${baseClasses} ${className}`}
            style={styles}
          />
        ))}
      </>
    );
  }

  return (
    <div
      className={`${baseClasses} ${className}`}
      style={styles}
    />
  );
}

/**
 * Card Skeleton - Composed skeleton for card layouts
 */
export function CardSkeleton({ showAvatar = false, showActions = false }) {
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {showAvatar && (
        <div className="flex items-center gap-3 mb-4">
          <SkeletonLoader variant="avatar" />
          <div className="flex-1">
            <SkeletonLoader variant="text" width="40%" />
            <SkeletonLoader variant="text" width="30%" height="0.75rem" />
          </div>
        </div>
      )}
      
      <SkeletonLoader variant="title" />
      <SkeletonLoader variant="text" lines={3} />
      
      {showActions && (
        <div className="flex gap-2 mt-4">
          <SkeletonLoader variant="button" />
          <SkeletonLoader variant="button" />
        </div>
      )}
    </div>
  );
}

/**
 * Table Skeleton - Composed skeleton for table layouts
 */
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
        {Array.from({ length: columns }).map((_, index) => (
          <SkeletonLoader
            key={index}
            variant="text"
            height="1rem"
            width={index === 0 ? '20%' : '15%'}
          />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <SkeletonLoader
              key={colIndex}
              variant="text"
              height="1rem"
              width={colIndex === 0 ? '20%' : '15%'}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Form Skeleton - Composed skeleton for form layouts
 */
export function FormSkeleton({ fields = 4 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index}>
          <SkeletonLoader variant="text" width="30%" height="0.875rem" />
          <SkeletonLoader variant="text" height="2.5rem" />
        </div>
      ))}
      <div className="flex gap-3 mt-6">
        <SkeletonLoader variant="button" width="5rem" />
        <SkeletonLoader variant="button" width="5rem" />
      </div>
    </div>
  );
}

/**
 * Dashboard Skeleton - Full page dashboard skeleton
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <SkeletonLoader variant="title" width="200px" />
        <SkeletonLoader variant="button" />
      </div>
      
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      
      {/* Chart */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <SkeletonLoader variant="text" width="150px" />
        <SkeletonLoader variant="image" height="200px" />
      </div>
      
      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <TableSkeleton rows={4} />
      </div>
    </div>
  );
}
