// Simple Card component that doesn't require external UI library
export const Card = ({ children, className = '' }) => (
  <div className={`rounded-lg bg-gray-800/50 border border-gray-700 ${className}`}>
    {children}
  </div>
);

export const CardHeader = ({ children, className = '' }) => (
  <div className={`p-4 border-b border-gray-700 ${className}`}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '' }) => (
  <h3 className={`font-semibold text-gray-100 ${className}`}>
    {children}
  </h3>
);

export const CardContent = ({ children, className = '' }) => (
  <div className={`p-4 ${className}`}>
    {children}
  </div>
);
