import { IoCheckmarkCircle } from 'react-icons/io5';

const ProgressSteps = ({ currentStep }) => {
  return (
    <div className="flex justify-center mb-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center">
          <div 
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              currentStep === i ? 'bg-[var(--color-accent)] text-slate-950' : 
              currentStep > i ? 'bg-[var(--color-accent-2)] text-white' : 'bg-[rgba(8,14,28,0.72)] text-[var(--color-text-muted)] border border-[var(--color-surface-border)]'
            }`}
          >
            {currentStep > i ? <IoCheckmarkCircle /> : i}
          </div>
          {i < 3 && (
            <div className={`w-8 h-0.5 ${currentStep > i ? 'bg-[var(--color-accent-2)]' : 'bg-[rgba(87,133,255,0.22)]'}`}></div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ProgressSteps;