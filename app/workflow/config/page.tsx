'use client'

import P1ConfigFlow from '@/components/p1/P1ConfigFlow'
import { DataCard } from '@/lib/types/p1'

export default function ConfigPage() {
  const handleComplete = (card: DataCard) => {
    console.log('P1 Config completed:', card)
  }

  return <P1ConfigFlow onComplete={handleComplete} />
}
