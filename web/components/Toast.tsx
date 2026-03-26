'use client'

import { useState, useEffect, useRef } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
}

let toastCallback: ((message: string, type?: ToastProps['type']) => void) | null = null

export function showToast(message: string, type: ToastProps['type'] = 'info') {
  if (toastCallback) toastCallback(message, type)
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: string }>>([])
  const counterRef = useRef(0)

  useEffect(() => {
    toastCallback = (message: string, type: ToastProps['type'] = 'info') => {
      const id = ++counterRef.current
      setToasts(prev => [...prev, { id, message, type }])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 3500)
    }
    return () => { toastCallback = null }
  }, [])

  return (
    <div id="toastContainer" className="fixed bottom-6 right-6 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type} animate-slide-in`}
        >
          <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  )
}