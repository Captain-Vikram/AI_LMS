import { motion } from 'framer-motion';
import { IoPerson, IoLocationOutline } from 'react-icons/io5';
import { MdWork } from 'react-icons/md';

const FormStep2 = ({ 
  registerStep2, 
  handleSubmitStep2, 
  errorsStep2, 
  onSubmitStep2,
  setStep,
  pageVariants
}) => {
  return (
    <motion.form
      key="step2"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      onSubmit={handleSubmitStep2(onSubmitStep2)}
    >
      <div className="space-y-3">
        {/* First Name */}
        <div>
          <label className="block text-gray-300 mb-1 text-xs" htmlFor="firstName">First Name</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-gray-400">
              <IoPerson className="text-sm" />
            </span>
            <input
              type="text"
              id="firstName"
              className={`w-full bg-gray-700/50 border ${errorsStep2.firstName ? 'border-red-500' : 'border-gray-600'} rounded-lg py-2 px-7 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="John"
              {...registerStep2('firstName', { required: 'First name is required' })}
            />
          </div>
          {errorsStep2.firstName && <p className="text-red-500 text-xs mt-1">{errorsStep2.firstName.message}</p>}
        </div>

        {/* Last Name */}
        <div>
          <label className="block text-gray-300 mb-1 text-xs" htmlFor="lastName">Last Name</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-gray-400">
              <IoPerson className="text-sm" />
            </span>
            <input
              type="text"
              id="lastName"
              className={`w-full bg-gray-700/50 border ${errorsStep2.lastName ? 'border-red-500' : 'border-gray-600'} rounded-lg py-2 px-7 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="Doe"
              {...registerStep2('lastName', { required: 'Last name is required' })}
            />
          </div>
          {errorsStep2.lastName && <p className="text-red-500 text-xs mt-1">{errorsStep2.lastName.message}</p>}
        </div>

        {/* Location */}
        <div>
          <label className="block text-gray-300 mb-1 text-xs" htmlFor="location">Location</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-gray-400">
              <IoLocationOutline className="text-sm" />
            </span>
            <input
              type="text"
              id="location"
              className={`w-full bg-gray-700/50 border ${errorsStep2.location ? 'border-red-500' : 'border-gray-600'} rounded-lg py-2 px-7 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="City, Country"
              {...registerStep2('location', { required: 'Location is required' })}
            />
          </div>
          {errorsStep2.location && <p className="text-red-500 text-xs mt-1">{errorsStep2.location.message}</p>}
        </div>

        {/* Role */}
        <div>
          <label className="block text-gray-300 mb-1 text-xs" htmlFor="role">Professional Role</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-gray-400">
              <MdWork className="text-sm" />
            </span>
            <select
              id="role"
              className={`w-full bg-gray-700/50 border ${errorsStep2.role ? 'border-red-500' : 'border-gray-600'} rounded-lg py-2 pl-7 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
              {...registerStep2('role', { required: 'Professional role is required' })}
            >
              <option value="">Select your role</option>
              <option value="student">Student</option>
              <option value="professional">Professional</option>
              <option value="manager">Manager</option>
              <option value="executive">Executive</option>
              <option value="educator">Educator</option>
              <option value="other">Other</option>
            </select>
          </div>
          {errorsStep2.role && <p className="text-red-500 text-xs mt-1">{errorsStep2.role.message}</p>}
        </div>
      </div>

      <div className="flex space-x-2 mt-4">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="w-1/3 bg-gray-700 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
        >
          Back
        </button>
        <button
          type="submit"
          className="w-2/3 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
        >
          Create Account
        </button>
      </div>
    </motion.form>
  );
};

export default FormStep2;