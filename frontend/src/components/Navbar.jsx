import React, { useState, useRef } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import useNavbarVisibility from "../hooks/useNavbarVisibility";
import { navbarVariants, childVariants } from "../animations/navbarAnimations";

const Navbar = () => {
  const isVisible = useNavbarVisibility();
  const location = useLocation();
  const [hoveredItem, setHoveredItem] = useState(null);
  const navRefs = useRef({});
  const navigate = useNavigate();
  // Check if user is logged in
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  const [mobileOpen, setMobileOpen] = useState(false);

  const hiddenRouteMatchers = [
    /^\/onboarding(?:\/|$)/i,
    /^\/classroom(?:\/|$)/i,
    /^\/skill-pathway(?:\/|$)/i,
  ];

  const shouldHideNavbar = hiddenRouteMatchers.some((matcher) =>
    matcher.test(location.pathname)
  );

  if (shouldHideNavbar) {
    return null;
  }

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
      const scrollToFeatures = () => {
        const element = document.getElementById('features');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };

      if (window.location.pathname !== '/') {
        navigate('/');
        requestAnimationFrame(() => {
          requestAnimationFrame(scrollToFeatures);
        });
      } else {
        scrollToFeatures();
      }
    }
  };

  return (
    <motion.nav
      data-app-navbar="true"
      className="fixed top-4 w-full z-50 px-4 lg:px-6 pointer-events-none"
      initial="hidden"
      animate="visible"
      variants={navbarVariants}
      style={{
        transform: isVisible ? "none" : "translateY(-100%)",
      }}
    >
      <div className="relative mx-auto w-full max-w-[1240px] pointer-events-auto">
        <div className="absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.02))] opacity-30" />
        <div className="absolute -inset-[1px] rounded-full bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.28),transparent_45%)] opacity-40" />

        <div className="relative flex items-center justify-between h-16 md:h-[74px] px-6 md:px-9 rounded-full border border-white/20 bg-[linear-gradient(140deg,rgba(13,24,46,0.86),rgba(8,17,34,0.7))] backdrop-blur-2xl shadow-[0_16px_38px_rgba(3,8,20,0.52)]">
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
                <span className="text-[var(--color-text)] font-bold text-2xl md:text-3xl tracking-tighter">
                  <span className="text-[var(--color-accent)]">Skill</span>Master
                </span>
              </RouterLink>
            </motion.div>

            {/* Mobile toggle + Desktop Navigation */}
            <div className="flex items-center md:hidden">
              <button
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((s) => !s)}
                className="inline-flex items-center justify-center rounded-md p-2 bg-white/5 hover:bg-white/8 text-white"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>

            <div className="hidden md:flex space-x-10 items-center">
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
                    className="text-[var(--color-text-muted)] hover:text-white text-[1.02rem] font-medium cursor-pointer transition-colors py-1 px-1"
                    onClick={(e) => handleNavigation(item, e)}
                  >
                    {item.name}
                  </RouterLink>
                  
                  <AnimatePresence>
                    {hoveredItem === item.name && (
                      <motion.div
                        className="absolute left-0 bottom-0 h-0.5 bg-[var(--color-accent)]"
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
                    className="bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-2))] text-slate-950 px-6 py-2 rounded-full text-lg font-semibold ml-4 border border-white/25 cursor-pointer shadow-[0_12px_28px_rgba(34,211,238,0.28)]"
                    whileHover={{ color: "#fff", backgroundColor: "#4f8cff" }}
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
                    className="bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-2))] text-slate-950 px-6 py-2 rounded-full text-lg font-semibold ml-4 border border-white/25 cursor-pointer shadow-[0_12px_28px_rgba(34,211,238,0.28)]"
                    whileHover={{ color: "#fff", backgroundColor: "#4f8cff" }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.1 }}
                    variants={childVariants}
                  >
                    Login
                  </motion.button>
                </RouterLink>
              )}
            </div>

            {/* Mobile menu panel */}
            <AnimatePresence>
              {mobileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute left-0 right-0 top-full mt-3 z-50 md:hidden"
                >
                  <div className="mx-3 rounded-xl border border-white/10 bg-slate-900/80 p-4 shadow-lg">
                    <nav className="flex flex-col gap-2">
                      {navItems.map((item) => (
                        <RouterLink
                          key={item.name}
                          to={item.to}
                          onClick={(e) => { handleNavigation(item, e); setMobileOpen(false); }}
                          className="block rounded-md px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/5"
                        >
                          {item.name}
                        </RouterLink>
                      ))}

                      <div className="mt-2">
                        {isLoggedIn ? (
                          <RouterLink to="/signout" onClick={() => setMobileOpen(false)} className="block rounded-md bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2 text-center font-semibold text-slate-950">Sign Out</RouterLink>
                        ) : (
                          <RouterLink to="/login" onClick={() => setMobileOpen(false)} className="block rounded-md bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2 text-center font-semibold text-slate-950">Login</RouterLink>
                        )}
                      </div>
                    </nav>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
    </motion.nav>
  );
};

export default Navbar;