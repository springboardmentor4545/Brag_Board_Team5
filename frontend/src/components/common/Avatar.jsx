export default function Avatar({ src, name, size = 'md', className = '' }) {
  const sizeClasses = {
    xs: { wrapper: 'w-6 h-6 text-xs', image: 'w-6 h-6' },
    sm: { wrapper: 'w-8 h-8 text-sm', image: 'w-8 h-8' },
    md: { wrapper: 'w-10 h-10 text-base', image: 'w-10 h-10' },
    lg: { wrapper: 'w-12 h-12 text-lg', image: 'w-12 h-12' },
  };

  const selected = sizeClasses[size] || sizeClasses.md;
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';

  if (src) {
    return (
      <img
        src={src}
        alt={name ? `${name}'s avatar` : 'User avatar'}
        className={`rounded-full object-cover ${selected.image} border border-blue-100 dark:border-gray-700 ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold ${selected.wrapper} ${className}`}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
