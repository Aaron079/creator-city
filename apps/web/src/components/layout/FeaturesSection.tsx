'use client'

import { motion } from 'framer-motion'

const features = [
  {
    icon: '🏙️',
    title: 'Build Your Base',
    description:
      'Construct and upgrade your creative headquarters. Studios, labs, galleries — each building unlocks new capabilities.',
  },
  {
    icon: '🤖',
    title: 'Hire AI Agents',
    description:
      'Recruit scriptwriters, directors, composers, VFX artists and more. Each agent has unique skills and personality.',
  },
  {
    icon: '🎬',
    title: 'Produce Content',
    description:
      'Manage full production pipelines from development to distribution. Track every phase with your AI team.',
  },
  {
    icon: '🤝',
    title: 'Collaborate',
    description:
      'Invite other creators to your projects. Share assets, coordinate agents, and build something bigger together.',
  },
  {
    icon: '🏆',
    title: 'Build Reputation',
    description:
      'Earn reputation through quality work and collaboration. Rise through the ranks and unlock exclusive zones.',
  },
  {
    icon: '🌐',
    title: 'Live World',
    description:
      'A real-time 3D city where you can see other creators working. Chat, visit bases, and discover new projects.',
  },
]

export function FeaturesSection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything a creator needs
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Creator City combines world-building, AI tooling, and social collaboration into one platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              viewport={{ once: true }}
              className="city-card hover:glow cursor-default group"
            >
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-city-accent-glow transition-colors">
                {feature.title}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
