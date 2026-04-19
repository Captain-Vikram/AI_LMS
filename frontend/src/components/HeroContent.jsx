import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link as RouterLink } from "react-router-dom";
import { gsap } from "gsap";

const HeroContent = () => {
  const contentRef = useRef(null);
  const splineRef = useRef(null);

  useEffect(() => {
    // Load Spline Script
    const existingScript = document.querySelector('script[src*="spline-viewer.js"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.type = "module";
      script.src = "https://unpkg.com/@splinetool/viewer@1.12.84/build/spline-viewer.js";
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const hideSplineBadge = () => {
      const host = splineRef.current;
      if (!host) {
        return false;
      }

      const viewer = host.querySelector("spline-viewer");
      if (!viewer) {
        return false;
      }

      const root = viewer.shadowRoot || viewer;
      const selectors = [
        'a[href*="spline"]',
        '[class*="logo"]',
        '[id*="logo"]',
        '[part*="logo"]',
        '[aria-label*="Spline"]',
      ];

      let hidden = false;
      selectors.forEach((selector) => {
        root.querySelectorAll(selector).forEach((el) => {
          el.style.display = "none";
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          hidden = true;
        });
      });

      return hidden;
    };

    const interval = setInterval(() => {
      hideSplineBadge();
    }, 250);

    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });

      // 1. Initial State: Hide elements to prevent flash
      gsap.set("[data-gsap='title-line'] span", { y: "110%" });

      tl.from("[data-gsap='badge']", {
        y: 20,
        opacity: 0,
        duration: 1,
        delay: 0.2
      })
      // 2. Reveal Title with a "Masked Slide"
      .to("[data-gsap='title-line'] span", {
        y: "0%",
        duration: 1.2,
        stagger: 0.1,
        ease: "power4.out"
      }, "-=0.8")
      // 3. Subtitle Fade + Slide
      .from("[data-gsap='subtitle']", {
        y: 15,
        opacity: 0,
        duration: 1
      }, "-=0.9")
      // 4. Features - Staggered Slide In
      .from("[data-gsap='feature']", {
        x: -20,
        opacity: 0,
        stagger: 0.1,
        duration: 0.8
      }, "-=0.7")
      // 5. Buttons - Pop In
      .from("[data-gsap='cta']", {
        scale: 0.9,
        opacity: 0,
        stagger: 0.1,
        duration: 0.6,
        ease: "back.out(1.7)"
      }, "-=0.5");

      // Continuous Floating Animation for Accent
      gsap.to("[data-gsap='accent']", {
        y: -5,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    }, contentRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={contentRef} className="relative z-30 flex justify-center items-center min-h-screen px-6 lg:px-10 overflow-hidden">
      <div className="container mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-20 items-start py-16 lg:py-24">
        
        <div className="flex flex-col space-y-6 px-4 md:px-6 pt-6 lg:pt-0 max-w-2xl">
          {/* Badge */}
          <div data-gsap="badge">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] border border-[var(--color-surface-border)] rounded-full px-4 py-1.5 backdrop-blur-sm bg-[var(--color-accent-soft)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
              AI-powered learning platform
            </span>
          </div>

          {/* Headline with Masking Effect */}
          <h1 className="text-4.5xl md:text-5xl lg:text-[3.9rem] font-extrabold leading-[1.02] tracking-tight text-[var(--color-text)]">
            <span className="block overflow-hidden" data-gsap="title-line">
              <span className="block">Discover your</span>
            </span>
            <span className="block overflow-hidden" data-gsap="title-line">
              <span className="block">path to </span>
            </span>
            <span className="block overflow-hidden" data-gsap="title-line">
              <span 
                className="block"
                data-gsap="accent"
                style={{
                  background: "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-2) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                skill mastery
              </span>
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-base md:text-lg text-[var(--color-text-muted)] leading-relaxed max-w-md" data-gsap="subtitle">
            Personalized learning journeys shaped by your goals, current skills, and where you want to go next.
          </p>

          {/* Feature list */}
          <ul className="flex flex-col space-y-3">
            {[
              "Identify skill gaps with personalized analysis",
              "Access curated learning resources",
              "Track progress with interactive visualizations",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-[var(--color-text-muted)] text-lg" data-gsap="feature">
                <span className="flex-shrink-0 w-5 h-5 rounded-full border border-[var(--color-surface-border)] bg-[var(--color-accent-soft)] flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>

          {/* CTA buttons */}
          <div className="flex items-center gap-5 pt-6">
            <div data-gsap="cta">
              <RouterLink to="/register">
                <motion.button
                  className="bg-[var(--color-accent)] text-slate-950 font-bold text-base py-3.5 px-8 rounded-xl cursor-pointer hover:brightness-110 transition-all shadow-[0_20px_40px_rgba(34,211,238,0.2)]"
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.96 }}
                >
                  Start your journey
                </motion.button>
              </RouterLink>
            </div>
            <button className="text-[var(--color-text-muted)] text-base font-semibold flex items-center gap-2 hover:text-[var(--color-text)] transition-colors group" data-gsap="cta">
              See how it works
              <svg className="transform group-hover:translate-x-1 transition-transform" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        </div>

        {/* RIGHT — Spline viewer with floating effect */}
        <motion.div
          ref={splineRef}
          className="relative overflow-hidden w-full max-w-[560px] h-[360px] md:h-[460px] lg:h-[560px] pointer-events-auto lg:justify-self-end"
          initial={{ opacity: 0, x: 40, y: 6 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.3 }}
        >
          <spline-viewer
            url="https://prod.spline.design/o-vWQQxU00RA-x0r/scene.splinecode"
            style={{ width: "100%", height: "100%" }}
          />

          {/* Watermark mask: hides the "Built with Spline" badge while preserving scene visuals */}
          <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-4 md:bottom-5 z-20 h-12 w-[220px] md:h-14 md:w-[250px] rounded-xl flex items-center justify-center gap-4 px-4"
            style={{
              background:
                "linear-gradient(120deg, rgba(7,11,23,0.96) 0%, rgba(7,11,23,0.88) 55%, rgba(7,11,23,0.78) 100%)",
              boxShadow: "0 8px 24px rgba(2, 6, 18, 0.45)",
              backdropFilter: "blur(3px)",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
              <span className="text-[9px] md:text-[10px] tracking-[0.18em] font-semibold text-[var(--color-text-muted)] uppercase">
                Robo Unit
              </span>
            </div>
            <span className="h-4 w-px bg-[var(--color-surface-border)] opacity-60" />
            <span className="text-sm md:text-[15px] font-bold tracking-wide text-[var(--color-accent)]">NOVA-7</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default HeroContent;