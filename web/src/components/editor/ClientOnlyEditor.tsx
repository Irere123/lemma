import { lazy, Suspense, useState, useEffect, type ComponentType } from 'react'
import type { BrainEditorProps, BrainReadOnlyEditorProps, BrainTitleProps } from './BrainEditor'

// Lazy load the editor components to prevent SSR issues with ProseMirror
const LazyBrainEditor = lazy(() =>
  import('./BrainEditor').then((mod) => ({ default: mod.BrainEditor }))
)

const LazyBrainReadOnlyEditor = lazy(() =>
  import('./BrainEditor').then((mod) => ({ default: mod.BrainReadOnlyEditor }))
)

const LazyBrainTitle = lazy(() =>
  import('./BrainEditor').then((mod) => ({ default: mod.BrainTitle }))
)

// Loading fallback component
function EditorSkeleton({ className }: { className?: string }) {
  return (
    <div className={`${className || ''} animate-pulse`}>
      <div className='h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4' />
      <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2' />
      <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 mb-2' />
      <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5' />
    </div>
  )
}

// Client-only wrapper hook
function useIsClient() {
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])
  return isClient
}

// Client-only BrainEditor
export function ClientBrainEditor(props: BrainEditorProps) {
  const isClient = useIsClient()

  if (!isClient) {
    return <EditorSkeleton className={props.className} />
  }

  return (
    <Suspense fallback={<EditorSkeleton className={props.className} />}>
      <LazyBrainEditor {...props} />
    </Suspense>
  )
}

// Client-only BrainReadOnlyEditor
export function ClientBrainReadOnlyEditor(props: BrainReadOnlyEditorProps) {
  const isClient = useIsClient()

  if (!isClient) {
    return <EditorSkeleton className={props.className} />
  }

  return (
    <Suspense fallback={<EditorSkeleton className={props.className} />}>
      <LazyBrainReadOnlyEditor {...props} />
    </Suspense>
  )
}

// Client-only BrainTitle
export function ClientBrainTitle(props: BrainTitleProps) {
  const isClient = useIsClient()

  if (!isClient) {
    return (
      <div className={`${props.className || ''} animate-pulse`}>
        <div className='h-12 bg-gray-200 dark:bg-gray-700 rounded w-2/3' />
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className={`${props.className || ''} animate-pulse`}>
          <div className='h-12 bg-gray-200 dark:bg-gray-700 rounded w-2/3' />
        </div>
      }
    >
      <LazyBrainTitle {...props} />
    </Suspense>
  )
}
