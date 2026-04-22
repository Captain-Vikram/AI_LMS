import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IoArrowBackOutline } from 'react-icons/io5';

const AppBackButton = ({
  label = 'Back',
  fallbackTo = '/',
  useHistory = true,
  className = '',
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    const hasHistory = typeof window !== 'undefined' && window.history.length > 1;
    if (useHistory && hasHistory) {
      navigate(-1);
      return;
    }
    navigate(fallbackTo);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`inline-flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-900/70 px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800 ${className}`}
    >
      <IoArrowBackOutline />
      {label}
    </button>
  );
};

export default AppBackButton;
