import type { Scope } from '@lemma/common/scopes'

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RESOURCES } from '@/utils/scopes'

type Props = {
  selectedScopes: Scope[]
  onResourceScopeChange: (resourceKey: string, scope: string) => void
  description?: string
  height?: string
  errorMessage?: string
}

export function ScopeSelector({
  selectedScopes,
  onResourceScopeChange,
  description = 'Select which scopes this application can request access to.',
  height = 'max-h-[300px]',
  errorMessage,
}: Props) {
  // Helper function to get the selected scope for a resource
  const getResourceScope = (resourceKey: string): string => {
    const resource = RESOURCES.find((r) => r.key === resourceKey)
    if (!resource) return ''

    // Find which scope from this resource is currently selected
    for (const scope of resource.scopes) {
      if (selectedScopes.includes(scope.scope as Scope)) {
        return scope.scope
      }
    }
    return ''
  }

  return (
    <div className='space-y-4'>
      <p className='text-sm font-medium text-[#878787]'>{description}</p>

      <ScrollArea className={`flex flex-col text-sm ${height}`}>
        {RESOURCES.map((resource) => (
          <div className='flex items-center justify-between py-4 border-b' key={resource.key}>
            <div className='flex items-center gap-1.5'>
              <span className='text-sm font-medium text-[#878787]'>{resource.name}</span>
            </div>
            <div>
              <RadioGroup
                value={getResourceScope(resource.key)}
                className='flex gap-4'
                onValueChange={(value) => onResourceScopeChange(resource.key, value)}
              >
                <div className='flex items-center space-x-2'>
                  <RadioGroupItem value='' id={`${resource.key}-none`} />
                  <label htmlFor={`${resource.key}-none`} className='text-sm'>
                    None
                  </label>
                </div>
                {resource.scopes.map((scope) => (
                  <div className='flex items-center space-x-2' key={scope.scope}>
                    <RadioGroupItem value={scope.scope} id={`${resource.key}-${scope.type}`} />
                    <label
                      htmlFor={`${resource.key}-${scope.type}`}
                      className='text-sm font-normal capitalize text-[#878787]'
                    >
                      {scope.label}
                    </label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        ))}
      </ScrollArea>

      {errorMessage && <p className='text-sm font-medium text-destructive mt-2'>{errorMessage}</p>}
    </div>
  )
}
