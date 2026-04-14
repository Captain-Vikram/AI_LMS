import React from "react";
import { motion } from "framer-motion";
import {
  containerVariants,
  itemVariants,
  listItemVariants,
} from "../animations/homeAnimations";
import { Link as RouterLink } from "react-router-dom";

const HeroContent = () => {
  return (
    <div className="relative z-30 flex justify-center items-center min-h-screen px-6 lg:px-12">
      <div className="container mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center mt-15">
        <motion.div
          className="flex flex-col space-y-6 bg-black rounded-xl p-8 text-white shadow-2xl"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{
            boxShadow: `
            0 10px 15px -3px rgba(0, 0, 0, 0.7),
            0 4px 6px -4px rgba(0, 0, 0, 0.6),
            0 -2px 10px rgba(255, 255, 255, 0.1) inset,
            0 8px 20px rgba(0, 0, 0, 0.6),
            0 15px 40px rgba(0, 0, 0, 0.4)
            `,
            transform: "perspective(1000px) translateZ(10px)",
            transformStyle: "preserve-3d",
            backfaceVisibility: "hidden",
          }}
        >
          <motion.h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight"
            variants={itemVariants}
          >
            Discover Your Path to{" "}
            <span className="text-primary">Skill Mastery</span>
          </motion.h1>

          <motion.p
            className="text-xl md:text-2xl opacity-80"
            variants={itemVariants}
          >
            Personalized learning journeys based on your goals, current skills,
            and career aspirations.
          </motion.p>

          <motion.ul className="space-y-2 text-lg" variants={itemVariants}>
            <motion.li
              className="flex items-center"
              variants={listItemVariants}
            >
              <span className="mr-2">✓</span> Identify skill gaps with
              personalized analysis
            </motion.li>
            <motion.li
              className="flex items-center"
              variants={listItemVariants}
            >
              <span className="mr-2">✓</span> Access curated learning resources
            </motion.li>
            <motion.li
              className="flex items-center"
              variants={listItemVariants}
            >
              <span className="mr-2">✓</span> Track progress with interactive
              visualizations
            </motion.li>
          </motion.ul>

          <motion.div className="pt-4" variants={itemVariants}>
            <RouterLink to="/register">
              <motion.button
                className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-lg cursor-pointer border-2"
                whileHover={{ color: "#000", backgroundColor: "#fff" }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.1 }}
              >
                Start Your Journey
              </motion.button>
            </RouterLink>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default HeroContent;
