import { motion } from "framer-motion";

// components/DestinationCard.tsx
export function DestinationCard({ city, onSelect }: any) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect(city)}
      className="cursor-pointer rounded-2xl shadow-lg"
    >
      {/* …thumbnail + summary… */}
    </motion.div>
  )
}
