import { motion } from 'framer-motion';
import { FcGoogle } from 'react-icons/fc';
import { FaLinkedin } from 'react-icons/fa';

const SocialLogin = () => {
  return (
    <div className="mt-5">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-600"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-gray-800/60 text-gray-400 text-xs">Or continue with</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <motion.button
          type="button"
          className="py-2 px-3 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg flex justify-center items-center gap-2 text-xs cursor-pointer"
          whileTap={{ scale: 0.95 }}
        >
          <FcGoogle className="text-lg" />
          <span className="text-gray-300">Google</span>
        </motion.button>
        <motion.button
          type="button"
          className="py-2 px-3 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg flex justify-center items-center gap-2 text-xs cursor-pointer"
          whileTap={{ scale: 0.95 }}
        >
          <FaLinkedin className="text-lg text-blue-500" />
          <span className="text-gray-300">LinkedIn</span>
        </motion.button>
      </div>
    </div>
  );
};

export default SocialLogin;