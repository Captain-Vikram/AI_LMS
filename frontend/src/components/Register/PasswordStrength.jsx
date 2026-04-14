const PasswordStrength = ({ strength }) => {
    return (
      <div className="mt-1">
        <div className="flex h-1 rounded-full overflow-hidden bg-gray-700">
          <div 
            className={`${
              strength <= 1 ? 'bg-red-500' : 
              strength === 2 ? 'bg-orange-500' : 
              strength === 3 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${(strength + 1) * 20}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {strength === 0 && 'Very weak'}
          {strength === 1 && 'Weak'}
          {strength === 2 && 'Fair'}
          {strength === 3 && 'Good'}
          {strength === 4 && 'Strong'}
        </p>
      </div>
    );
  };
  
  export default PasswordStrength;