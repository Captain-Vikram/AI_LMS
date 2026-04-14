import { IoCheckmarkCircle } from 'react-icons/io5';

const ProgressSteps = ({ currentStep }) => {
  return (
    <div className="flex justify-center mb-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center">
          <div 
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              currentStep === i ? 'bg-blue-600 text-white' : 
              currentStep > i ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'
            }`}
          >
            {currentStep > i ? <IoCheckmarkCircle /> : i}
          </div>
          {i < 3 && (
            <div className={`w-8 h-0.5 ${currentStep > i ? 'bg-green-500' : 'bg-gray-700'}`}></div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ProgressSteps;