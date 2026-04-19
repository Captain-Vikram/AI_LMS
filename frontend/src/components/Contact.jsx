import React, { useState } from "react";
import { motion } from "framer-motion";
import { FaEnvelope, FaLocationDot, FaPhone, FaPaperPlane } from "react-icons/fa6";
import IconsCarousel from "./IconsCarousel";
import { useBackground } from "../context/BackgroundContext";

const contactLinks = [
  {
    icon: FaEnvelope,
    title: "Email",
    value: "support@skillmaster.ai",
    href: "mailto:support@skillmaster.ai",
  },
  {
    icon: FaPhone,
    title: "Phone",
    value: "+1 (555) 012-2456",
    href: "tel:+15550122456",
  },
  {
    icon: FaLocationDot,
    title: "Office",
    value: "Remote-first, global team",
    href: "#",
  },
];

const Contact = () => {
  const { backgroundColor } = useBackground();
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <section className="relative min-h-screen overflow-hidden pt-28 px-4 sm:px-6 lg:px-8 pb-16">
      <motion.div className="absolute inset-0" style={{ backgroundColor }}>
        <IconsCarousel />
      </motion.div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_22%,rgba(34,211,238,0.12),transparent_36%),radial-gradient(circle_at_82%_64%,rgba(79,140,255,0.18),transparent_44%),linear-gradient(120deg,rgba(7,11,23,0.2),rgba(7,11,23,0.76))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_52%,rgba(4,8,18,0.62)_100%)]" />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="space-y-6 rounded-[28px] border border-[var(--color-surface-border)] bg-[var(--color-surface)] p-7 sm:p-8 backdrop-blur-xl shadow-[var(--shadow-xl)]"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-surface-border)] bg-[var(--color-accent-soft)] px-4 py-1.5 text-xs font-semibold tracking-[0.2em] text-[var(--color-accent)] uppercase">
            Contact us
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-[0.95] tracking-tight text-white">
              Let&apos;s build your
              <span className="block bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-2))] bg-clip-text text-transparent">
                learning future
              </span>
            </h1>
            <p className="max-w-xl text-sm sm:text-base leading-7 text-[var(--color-text-muted)]">
              Reach out for support, partnerships, product questions, or anything else about SkillMaster.
              We usually respond within one business day.
            </p>
          </div>

          <div className="grid gap-4">
            {contactLinks.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.title}
                  href={item.href}
                  className="group flex items-center gap-4 rounded-2xl border border-white/8 bg-[rgba(8,14,28,0.65)] px-4 py-4 transition-transform duration-300 hover:-translate-y-0.5 hover:border-[var(--color-surface-border)]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-2))] text-slate-950 shadow-[0_12px_24px_rgba(34,211,238,0.18)]">
                    <Icon />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                      {item.title}
                    </p>
                    <p className="text-sm font-medium text-white group-hover:text-[var(--color-accent)] transition-colors">
                      {item.value}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
          className="rounded-[28px] border border-[var(--color-surface-border)] bg-[var(--color-surface)] p-7 sm:p-8 backdrop-blur-xl shadow-[var(--shadow-xl)]"
        >
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
                Send a message
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                We&apos;re here to help
              </h2>
            </div>
            <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent-soft)] text-[var(--color-accent)] border border-[var(--color-surface-border)]">
              <FaPaperPlane />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-[var(--color-text-muted)]">
                Name
                <input
                  name="name"
                  value={formState.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-[var(--color-surface-border)] bg-[rgba(8,14,28,0.72)] px-4 py-3 text-white outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[rgba(34,211,238,0.18)]"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-[var(--color-text-muted)]">
                Email
                <input
                  type="email"
                  name="email"
                  value={formState.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-[var(--color-surface-border)] bg-[rgba(8,14,28,0.72)] px-4 py-3 text-white outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[rgba(34,211,238,0.18)]"
                />
              </label>
            </div>

            <label className="space-y-2 text-sm font-medium text-[var(--color-text-muted)]">
              Subject
              <input
                name="subject"
                value={formState.subject}
                onChange={handleChange}
                placeholder="How can we help?"
                className="w-full rounded-xl border border-[var(--color-surface-border)] bg-[rgba(8,14,28,0.72)] px-4 py-3 text-white outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[rgba(34,211,238,0.18)]"
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-[var(--color-text-muted)]">
              Message
              <textarea
                name="message"
                value={formState.message}
                onChange={handleChange}
                rows="6"
                placeholder="Tell us a little about your question or project..."
                className="w-full resize-none rounded-2xl border border-[var(--color-surface-border)] bg-[rgba(8,14,28,0.72)] px-4 py-3 text-white outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[rgba(34,211,238,0.18)]"
              />
            </label>

            {submitted && (
              <div className="rounded-xl border border-[rgba(34,211,238,0.28)] bg-[rgba(34,211,238,0.08)] px-4 py-3 text-sm text-[var(--color-text)]">
                Thanks. Your message is ready to send. Connect this form to your backend when you&apos;re ready.
              </div>
            )}

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-2))] px-6 py-3 font-semibold text-slate-950 shadow-[0_18px_40px_rgba(34,211,238,0.18)] transition hover:brightness-110"
            >
              <FaPaperPlane />
              Send message
            </button>
          </form>
        </motion.div>
      </div>
    </section>
  );
};

export default Contact;
