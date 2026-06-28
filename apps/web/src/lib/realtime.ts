import { useEffect, useRef, useState } from 'react'

/** Build a ws(s):// URL on the API origin from the http(s) backend URL. */
export function realtimeUrl(path: string): string {
  const base = import.meta.env.VITE_PUBLIC_BACKEND_URL as string
  const wsBase = base.replace(/^http/, 'ws')
  return `${wsBase}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Subscribe to a backend realtime channel (a Durable Object WebSocket).
 *
 * Handles connect, keep-alive pings, and reconnect with backoff. `onMessage` is
 * read through a ref so passing an inline callback doesn't tear down the socket
 * on every render — the effect only re-runs when `path` changes. Pass `null` to
 * stay disconnected. Cookies authenticate the upgrade, same as the rest of the API.
 */
export function useRealtimeChannel(
  path: string | null,
  onMessage: (message: { type: string; data?: unknown }) => void
): { connected: boolean } {
  const [connected, setConnected] = useState(false)
  const handlerRef = useRef(onMessage)
  handlerRef.current = onMessage

  useEffect(() => {
    if (!path || typeof window === 'undefined') return

    let socket: WebSocket | null = null
    let stopped = false
    let attempt = 0
    let pingTimer: ReturnType<typeof setInterval> | undefined
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined

    const open = () => {
      socket = new WebSocket(realtimeUrl(path))

      socket.onopen = () => {
        setConnected(true)
        attempt = 0
        pingTimer = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }))
          }
        }, 25_000)
      }

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string)
          if (message?.type === 'pong') return
          handlerRef.current(message)
        } catch {
          // ignore malformed frames
        }
      }

      socket.onerror = () => socket?.close()

      socket.onclose = () => {
        setConnected(false)
        if (pingTimer) clearInterval(pingTimer)
        if (stopped) return
        attempt += 1
        reconnectTimer = setTimeout(open, Math.min(1000 * 2 ** attempt, 15_000))
      }
    }

    open()

    return () => {
      stopped = true
      if (pingTimer) clearInterval(pingTimer)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [path])

  return { connected }
}
