import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { IoArrowForward, IoCheckmarkCircle } from 'react-icons/io5';

const SuccessStep = ({ pageVariants }) => {
  return (
    <motion.div
      key="step3"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="text-center py-4"
    >
      <div className="w-16 h-16 bg-green-500 rounded-full mx-auto flex items-center justify-center mb-4">
        <IoCheckmarkCircle className="text-white text-3xl" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Registration Complete!</h2>
      <p className="text-gray-400 mb-6 text-sm">
        Your account has been created successfully. Let's start your learning journey!
      </p>
      <Link to="/onboarding">
        <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
          Continue to Onboarding <IoArrowForward />
        </button>
      </Link>
    </motion.div>
  );
};

export default SuccessStep;