import React, { useState, useRef } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import useNavbarVisibility from "../hooks/useNavbarVisibility";
import { navbarVariants, childVariants } from "../animations/navbarAnimations";

const Navbar = () => {
  const isVisible = useNavbarVisibility();
  const [hoveredItem, setHoveredItem] = useState(null);
  const navRefs = useRef({});
  const navigate = useNavigate();
  // Check if user is logged in
  const isLoggedIn = localStorage.getItem('isLoggedIn');

  // Navigation items with scroll functionality for Features
  const navItems = [
    { name: "Home", to: "/" },
    { name: "Features", to: "/#features", isScroll: true },
    ...(isLoggedIn ? [{ name: "Classrooms", to: "/classrooms" }] : []),
    { name: "Contact", to: "/contact" },
  ];

  // Handle navigation with scroll for specific items
  const handleNavigation = (item, e) => {
    if (item.isScroll) {
      e.preventDefault();
      if (window.location.pathname !== '/') {
        navigate('/');
        setTimeout(() => {
          const element = document.getElementById(item.name.toLowerCase());
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      } else {
        const element = document.getElementById(item.name.toLowerCase());
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  };

  return (
    <motion.nav
      className="fixed top-0 w-full z-50"
      initial="hidden"
      animate="visible"
      variants={navbarVariants}
      style={{
        transform: isVisible ? "none" : "translateY(-100%)",
      }}
    >
      <div className="backdrop-blur-md bg-black/80 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <motion.div 
              className="flex items-center"
              variants={childVariants}
              whileTap={{ scale: 0.95 }}
            >
              <RouterLink
                to="/"
                className="flex items-center cursor-pointer"
              >
                <span className="text-white font-bold text-2xl md:text-3xl tracking-tighter">
                  <span className="text-primary">Skill</span>Master
                </span>
              </RouterLink>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-8 items-center">
              {navItems.map((item, index) => (
                <motion.div
                  key={item.name}
                  className="relative"
                  ref={el => navRefs.current[item.name] = el}
                  onMouseEnter={() => setHoveredItem(item.name)}
                  onMouseLeave={() => setHoveredItem(null)}
                  whileTap={{ scale: 0.95 }}
                  variants={childVariants}
                  custom={index}
                >
                  <RouterLink
                    to={item.to}
                    className="text-white hover:text-primary text-lg font-medium cursor-pointer transition-colors py-1 px-1"
                    onClick={(e) => handleNavigation(item, e)}
                  >
                    {item.name}
                  </RouterLink>
                  
                  <AnimatePresence>
                    {hoveredItem === item.name && (
                      <motion.div
                        className="absolute left-0 bottom-0 h-0.5 bg-white"
                        layoutId="navUnderline"
                        initial={{ width: 0 }}
                        animate={{ 
                          width: navRefs.current[item.name]?.offsetWidth || 0,
                        }}
                        transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

              { isLoggedIn ? (
                <RouterLink to="/signout">
                  <motion.button
                    className="bg-primary text-white px-6 py-1.5 rounded-lg text-lg font-medium ml-4 border-2 cursor-pointer"
                    whileHover={{ color: "#000", backgroundColor: "#fff" }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.1 }}
                    variants={childVariants}
                  >
                    Sign Out
                  </motion.button>
                </RouterLink>
              ) : (
                <RouterLink to="/login">
                  <motion.button
                    className="bg-primary text-white px-6 py-1.5 rounded-lg text-lg font-medium ml-4 border-2 cursor-pointer"
                    whileHover={{ color: "#000", backgroundColor: "#fff" }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.1 }}
                    variants={childVariants}
                  >
                    Login
                  </motion.button>
                </RouterLink>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;