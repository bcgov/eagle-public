interface SkeletonProps {
  /** CSS length for the bar, e.g. `60%` or `8rem`. */
  width?: string;
  height?: string;
  /** Stacked bars, the last one short the way a paragraph ends. */
  lines?: number;
  className?: string;
}

/**
 * A shimmering bar standing in for content still in flight. Decorative on purpose: the region
 * around it carries `aria-busy` and the "Loading" text a screen reader announces.
 */
export function Skeleton({ width = '100%', height, lines = 1, className }: SkeletonProps) {
  return (
    <span
      className={`skeleton placeholder-wave${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          className="placeholder"
          style={{ width: lines > 1 && index === lines - 1 ? '65%' : width, height }}
        />
      ))}
    </span>
  );
}
