'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-24 px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto"
      >
        <div className="inline-flex items-center gap-2 bg-city-accent/10 border border-city-accent/30 rounded-full px-4 py-1.5 text-sm text-city-accent-glow mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Now in Early Access
        </div>

        <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
          Your AI{' '}
          <span className="text-gradient">Creative City</span>
          <br />
          Awaits
        </h1>

        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Build your creative base. Hire AI agents. Produce films, series, and content.
          Collaborate with creators worldwide. Rise through the ranks.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth/register"
            className="px-8 py-4 bg-city-accent hover:bg-city-accent-glow text-white font-semibold rounded-xl transition-all duration-200 glow text-lg"
          >
            Start Building Free
          </Link>
          <Link
            href="/city"
            className="px-8 py-4 border border-city-border hover:border-city-accent/50 text-white font-semibold rounded-xl transition-all duration-200 text-lg"
          >
            Explore the City
          </Link>
        </div>
      </motion.div>

      {/* Floating stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="flex justify-center gap-12 mt-16 text-center"
      >
        {[
          { label: 'Creators', value: '10K+' },
          { label: 'Projects', value: '50K+' },
          { label: 'AI Agents', value: '200K+' },
        ].map((stat) => (
          <div key={stat.label}>
            <div className="text-3xl font-bold text-gradient">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </motion.div>
    </section>
  )
}
