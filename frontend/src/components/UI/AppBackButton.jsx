import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IoArrowBackOutline } from 'react-icons/io5';

/**
 * AppBackButton — universal "Back" navigation button.
 *
 * Always navigates to `fallbackTo` (no browser history tricks that cause
 * redirect loops). Just pass the logical parent route.
 *
 * Props:
 *   fallbackTo  {string}  — the route to navigate to (required, no default)
 *   className   {string}  — optional extra Tailwind classes
 */
const AppBackButton = ({
  // label is accepted but ignored — always renders "Back" for consistency
  fallbackTo = '/dashboard',
  className = '',
}) => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(fallbackTo)}
      className={[
        'group inline-flex items-center gap-2 rounded-xl',
        'border border-white/10 bg-white/5 backdrop-blur-sm',
        'px-4 py-2 text-sm font-semibold text-gray-200',
        'transition-all duration-200',
        'hover:border-white/20 hover:bg-white/10 hover:text-white',
        'active:scale-[0.97]',
        className,
      ].join(' ')}
    >
      <IoArrowBackOutline
        className="transition-transform duration-200 group-hover:-translate-x-0.5"
        size={16}
      />
      Back
    </button>
  );
};

export default AppBackButton;
