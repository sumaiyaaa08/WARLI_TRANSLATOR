// XpBurst.jsx — Floating "+N XP" burst animation shown on correct answers.

import { AnimatePresence, motion } from 'framer-motion'

export default function XpBurst({ amount = 0, burstKey = 0 }) {
  return (
    <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-50" aria-hidden="true">
      <AnimatePresence>
        {burstKey > 0 && (
          <motion.p
            key={burstKey}
            className="text-2xl font-bold"
            style={{ color: '#f97316', fontFamily: '"Baloo 2", system-ui, sans-serif' }}
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: -24, scale: 1.1 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.7 }}
          >
            +{amount} XP
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
