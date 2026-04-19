import { motion, AnimatePresence } from 'framer-motion';
import TiltCard from './TiltCard';
import StatBar from './StatBar';

const FeaturesDisplay = ({ phase, active, f, stats, Icon, features }) => {
  return (
    <>
      <AnimatePresence>
        {phase === 'features' && (
          <motion.div
            key="feat-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              zIndex: 12,
              padding: '0 5vw',
            }}
          >
            <div style={{ flex: '0 0 52%', paddingRight: '3vw' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`gn-${active}`}
                  initial={{ x: -40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    fontFamily: "'Courier New',monospace",
                    fontSize: 'clamp(90px,14vw,190px)',
                    fontWeight: 900,
                    lineHeight: 1,
                    WebkitTextStroke: `1.5px ${f.accent}`,
                    WebkitTextFillColor: 'transparent',
                    opacity: 0.11,
                    position: 'absolute',
                    top: '4%',
                    left: '4vw',
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}
                >
                  {f.label}
                </motion.div>
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.p
                  key={`sub-${active}`}
                  initial={{ y: 14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ duration: 0.38 }}
                  style={{
                    fontFamily: "'Courier New',monospace",
                    fontSize: 9,
                    letterSpacing: 5,
                    color: f.accent,
                    marginBottom: 16,
                    textTransform: 'uppercase',
                  }}
                >
                  {f.sub}
                </motion.p>
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.h3
                  key={`t-${active}`}
                  initial={{ y: 32, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    fontFamily: "'Georgia',serif",
                    fontSize: 'clamp(38px,5.5vw,78px)',
                    fontWeight: 900,
                    fontStyle: 'italic',
                    color: '#fff',
                    lineHeight: 1.02,
                    marginBottom: 20,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {f.title}
                </motion.h3>
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.div
                  key={`ln-${active}`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  exit={{ scaleX: 0 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  style={{
                    transformOrigin: 'left',
                    height: 2,
                    width: 100,
                    background: f.grad,
                    marginBottom: 18,
                    borderRadius: 2,
                    boxShadow: `0 0 12px ${f.accent}99`,
                  }}
                />
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.p
                  key={`d-${active}`}
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ delay: 0.07, duration: 0.45 }}
                  style={{
                    fontFamily: "'Georgia',serif",
                    fontSize: 'clamp(13px,1.2vw,16px)',
                    color: 'rgba(255,255,255,0.58)',
                    lineHeight: 1.88,
                    maxWidth: 450,
                  }}
                >
                  {f.description}
                </motion.p>
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.button
                  key={`cta-${active}`}
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.13, duration: 0.4 }}
                  whileHover={{ scale: 1.04, boxShadow: `0 0 28px ${f.accent}77` }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    marginTop: 26,
                    padding: '12px 32px',
                    background: f.grad,
                    border: 'none',
                    borderRadius: 3,
                    color: '#04080f',
                    fontFamily: "'Courier New',monospace",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 3,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    boxShadow: `0 0 18px ${f.accent}44`,
                  }}
                >
                  Explore Feature →
                </motion.button>
              </AnimatePresence>
            </div>

            <div style={{ flex: '0 0 48%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`card-${active}`}
                  initial={{ opacity: 0, x: 50, rotateY: 18 }}
                  animate={{ opacity: 1, x: 0, rotateY: 0 }}
                  exit={{ opacity: 0, x: -30, rotateY: -12 }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <TiltCard>
                    <div
                      style={{
                        width: 'clamp(268px,33vw,430px)',
                        height: 'clamp(308px,37vw,470px)',
                        background: 'rgba(255,255,255,0.025)',
                        border: `1px solid ${f.accent}28`,
                        borderRadius: 20,
                        backdropFilter: 'blur(18px)',
                        boxShadow: `0 28px 72px rgba(0,0,0,0.55), 0 0 44px ${f.accent}18`,
                        padding: '32px 32px 26px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 18,
                        position: 'relative',
                        overflow: 'hidden',
                        transformStyle: 'preserve-3d',
                      }}
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
                        style={{
                          position: 'absolute',
                          top: -52,
                          right: -52,
                          width: 150,
                          height: 150,
                          borderRadius: '50%',
                          border: `1px solid ${f.accent}22`,
                          pointerEvents: 'none',
                        }}
                      />
                      <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                        style={{
                          position: 'absolute',
                          top: -32,
                          right: -32,
                          width: 94,
                          height: 94,
                          borderRadius: '50%',
                          border: `1px solid ${f.accent}38`,
                          pointerEvents: 'none',
                        }}
                      />

                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ position: 'relative' }}>
                          <Icon />
                          <motion.div
                            animate={{ scale: [1, 2.4], opacity: [0.35, 0] }}
                            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                            style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%,-50%)',
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: f.accent,
                              pointerEvents: 'none',
                            }}
                          />
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontFamily: "'Courier New',monospace", fontSize: 8, letterSpacing: 3, color: 'rgba(255,255,255,0.28)', marginBottom: 2 }}>FEATURE</p>
                          <p style={{ fontFamily: "'Courier New',monospace", fontSize: 20, fontWeight: 700, color: f.accent, lineHeight: 1 }}>{f.label}</p>
                        </div>
                      </div>

                      <div>
                        <p
                          style={{
                            fontFamily: "'Georgia',serif",
                            fontSize: 'clamp(17px,2vw,24px)',
                            fontWeight: 700,
                            fontStyle: 'italic',
                            color: '#fff',
                            lineHeight: 1.2,
                            whiteSpace: 'pre-line',
                          }}
                        >
                          {f.title}
                        </p>
                      </div>

                      <div style={{ flex: 1 }}>
                        {stats.map((s, i) => (
                          <StatBar key={`${active}-${i}`} label={s.l} pct={s.p} accent={f.accent} delay={0.1 + i * 0.12} />
                        ))}
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                          <span style={{ fontFamily: "'Courier New',monospace", fontSize: 8, letterSpacing: 3, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Progress</span>
                          <span style={{ fontFamily: "'Courier New',monospace", fontSize: 11, color: f.accent }}>{active + 1} / {features.length}</span>
                        </div>
                        <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                          <motion.div
                            animate={{ width: `${((active + 1) / features.length) * 100}%` }}
                            transition={{ duration: 0.65, ease: 'easeOut' }}
                            style={{ height: '100%', background: f.grad, borderRadius: 3, boxShadow: `0 0 8px ${f.accent}` }}
                          />
                        </div>
                      </div>
                    </div>
                  </TiltCard>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'features' && (
        <div
          style={{
            position: 'absolute',
            right: '2.5vw',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            zIndex: 25,
          }}
        >
          {features.map((feat, i) => (
            <motion.div
              key={i}
              animate={{
                width: active === i ? 28 : 7,
                background: active === i ? feat.accent : 'rgba(255,255,255,0.18)',
                boxShadow: active === i ? `0 0 10px ${feat.accent}` : 'none',
              }}
              transition={{ duration: 0.3 }}
              style={{ height: 7, borderRadius: 4 }}
            />
          ))}
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, display: 'flex', zIndex: 30 }}>
        {features.map((feat, i) => (
          <motion.div
            key={i}
            animate={{ opacity: i <= active && phase === 'features' ? 1 : 0.15 }}
            transition={{ duration: 0.4 }}
            style={{ flex: 1, background: feat.grad }}
          />
        ))}
      </div>

      {phase === 'features' && active < features.length - 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.55, 0] }}
          transition={{ duration: 3, repeat: Infinity, delay: 0.6 }}
          style={{
            position: 'absolute',
            bottom: 18,
            right: '5.5vw',
            fontFamily: "'Courier New',monospace",
            fontSize: 8,
            letterSpacing: 4,
            color: 'rgba(255,255,255,0.32)',
            textTransform: 'uppercase',
            zIndex: 20,
          }}
        >
          Scroll ↓
        </motion.div>
      )}
    </>
  );
};

export default FeaturesDisplay;
