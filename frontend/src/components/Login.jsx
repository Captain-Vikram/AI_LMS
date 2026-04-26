import React from "react";
import { SignIn } from "@clerk/clerk-react";
import { motion } from "framer-motion";
import IconsCarousel from "./IconsCarousel";
import { useBackground } from "../context/BackgroundContext";

const Login = () => {
  const { backgroundColor } = useBackground();

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 py-12 pt-28 overflow-hidden">
      {/* Background Icon Carousel */}
      <motion.div className="absolute inset-0" style={{ backgroundColor }}>
        <IconsCarousel />
      </motion.div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_22%,rgba(34,211,238,0.12),transparent_36%),radial-gradient(circle_at_82%_64%,rgba(79,140,255,0.18),transparent_44%),linear-gradient(120deg,rgba(7,11,23,0.2),rgba(7,11,23,0.76))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_52%,rgba(4,8,18,0.62)_100%)]" />

      <div className="relative z-10">
        <SignIn 
          routing="path" 
          path="/login" 
          signUpUrl="/register"
          fallbackRedirectUrl="/dashboard"
        />
      </div>
    </section>
  );
};

export default Login;
