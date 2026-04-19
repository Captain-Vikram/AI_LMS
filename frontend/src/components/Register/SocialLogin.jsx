import { motion } from 'framer-motion';
import { FcGoogle } from 'react-icons/fc';
import { FaLinkedin } from 'react-icons/fa';

const SocialLogin = () => {
  return (
    <div className="mt-5">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--color-surface-border)]"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs">Or continue with</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <motion.button
          type="button"
          className="py-2 px-3 bg-[rgba(8,14,28,0.72)] hover:bg-[rgba(10,18,34,0.9)] border border-[var(--color-surface-border)] rounded-xl flex justify-center items-center gap-2 text-xs cursor-pointer"
          whileTap={{ scale: 0.95 }}
        >
          <FcGoogle className="text-lg" />
          <span className="text-[var(--color-text)]">Google</span>
        </motion.button>
        <motion.button
          type="button"
          className="py-2 px-3 bg-[rgba(8,14,28,0.72)] hover:bg-[rgba(10,18,34,0.9)] border border-[var(--color-surface-border)] rounded-xl flex justify-center items-center gap-2 text-xs cursor-pointer"
          whileTap={{ scale: 0.95 }}
        >
          <FaLinkedin className="text-lg text-[var(--color-accent)]" />
          <span className="text-[var(--color-text)]">LinkedIn</span>
        </motion.button>
      </div>
    </div>
  );
};

export default SocialLogin;