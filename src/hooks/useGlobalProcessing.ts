import { useEffect, useState } from 'react'
import { subscribeOperations } from '@/lib/operation-counter'

export function useGlobalProcessing(): boolean {
  const [active, setActive] = useState(false)
  useEffect(() => {
    return subscribeOperations((count) => {
      setActive(count > 0)
    })
  }, [])
  return active
}
