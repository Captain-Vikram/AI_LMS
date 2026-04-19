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
          <label className="block text-[var(--color-text-muted)] mb-1 text-xs" htmlFor="firstName">First Name</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-[var(--color-text-muted)]">
              <IoPerson className="text-sm" />
            </span>
            <input
              type="text"
              id="firstName"
              className={`w-full bg-[rgba(8,14,28,0.72)] border ${errorsStep2.firstName ? 'border-red-500' : 'border-[var(--color-surface-border)]'} rounded-xl py-2 px-7 text-sm text-white placeholder-[rgba(226,235,255,0.38)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]`}
              placeholder="John"
              {...registerStep2('firstName', { required: 'First name is required' })}
            />
          </div>
          {errorsStep2.firstName && <p className="text-red-500 text-xs mt-1">{errorsStep2.firstName.message}</p>}
        </div>

        {/* Last Name */}
        <div>
          <label className="block text-[var(--color-text-muted)] mb-1 text-xs" htmlFor="lastName">Last Name</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-[var(--color-text-muted)]">
              <IoPerson className="text-sm" />
            </span>
            <input
              type="text"
              id="lastName"
              className={`w-full bg-[rgba(8,14,28,0.72)] border ${errorsStep2.lastName ? 'border-red-500' : 'border-[var(--color-surface-border)]'} rounded-xl py-2 px-7 text-sm text-white placeholder-[rgba(226,235,255,0.38)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]`}
              placeholder="Doe"
              {...registerStep2('lastName', { required: 'Last name is required' })}
            />
          </div>
          {errorsStep2.lastName && <p className="text-red-500 text-xs mt-1">{errorsStep2.lastName.message}</p>}
        </div>

        {/* Location */}
        <div>
          <label className="block text-[var(--color-text-muted)] mb-1 text-xs" htmlFor="location">Location</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-[var(--color-text-muted)]">
              <IoLocationOutline className="text-sm" />
            </span>
            <input
              type="text"
              id="location"
              className={`w-full bg-[rgba(8,14,28,0.72)] border ${errorsStep2.location ? 'border-red-500' : 'border-[var(--color-surface-border)]'} rounded-xl py-2 px-7 text-sm text-white placeholder-[rgba(226,235,255,0.38)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]`}
              placeholder="City, Country"
              {...registerStep2('location', { required: 'Location is required' })}
            />
          </div>
          {errorsStep2.location && <p className="text-red-500 text-xs mt-1">{errorsStep2.location.message}</p>}
        </div>

        {/* Role */}
        <div>
          <label className="block text-[var(--color-text-muted)] mb-1 text-xs" htmlFor="role">Account Role</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-[var(--color-text-muted)]">
              <MdWork className="text-sm" />
            </span>
            <select
              id="role"
              className={`w-full bg-[rgba(8,14,28,0.72)] border ${errorsStep2.role ? 'border-red-500' : 'border-[var(--color-surface-border)]'} rounded-xl py-2 pl-7 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]`}
              {...registerStep2('role', { required: 'Role is required' })}
            >
              <option value="">Select your role</option>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>
          {errorsStep2.role && <p className="text-red-500 text-xs mt-1">{errorsStep2.role.message}</p>}
        </div>
      </div>

      <div className="flex space-x-2 mt-4">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="w-1/3 bg-[rgba(8,14,28,0.72)] border border-[var(--color-surface-border)] text-[var(--color-text)] py-2 px-3 rounded-xl text-sm font-medium hover:bg-[rgba(8,14,28,0.9)] transition-colors"
        >
          Back
        </button>
        <button
          type="submit"
          className="w-2/3 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)] text-slate-950 py-2 px-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_20px_40px_rgba(34,211,238,0.14)]"
        >
          Create Account
        </button>
      </div>
    </motion.form>
  );
};

export default FormStep2;