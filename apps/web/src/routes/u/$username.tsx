import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { IconCalendar } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/u/$username')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <main className='grid grid-cols-2 w-full h-screen'>
      <div className='flex flex-col max-w-md mx-auto w-full py-4'>
        <h2 className='text-2xl font-bold'>Lemma</h2>

        <div className='pt-10'>
          <Avatar className='rounded-full size-20'>
            <AvatarImage
              alt='User'
              src='https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=128&h=128&dpr=2&q=80'
            />
            <AvatarFallback>AV</AvatarFallback>
          </Avatar>
          <div className='flex flex-col text-sm gap-2'>
            <p className='font-semibold text-lg'>Irere Emmanuel</p>
            <div className='flex items-center gap-2 text-muted-foreground'>
              <IconCalendar size={16} />
              <p>Joined in 2024</p>
            </div>
            <p>
              I'm a software engineer based in Kigali, working on platform and product experiences
              with
              <span className='underline underline-offset-4'> TypeScript</span>, React, and edge
              runtimes. I enjoy building DX-focused systems and reliable infrastructure that feels
              simple.
            </p>
            <div />
          </div>
        </div>
      </div>
      <div className='bg-neutral-100'>
        <div className='flex justify-end gap-2 p-2'>
          <Avatar className='rounded-full size-9'>
            <AvatarImage
              alt='User'
              src='https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=128&h=128&dpr=2&q=80'
            />
            <AvatarFallback>AV</AvatarFallback>
          </Avatar>
        </div>
        <Tabs defaultValue='latest'>
          <div className='border-b'>
            <TabsList variant='underline'>
              <TabsTab value='latest'>Latest</TabsTab>
              <TabsTab value='popular'>Popular</TabsTab>
              <TabsTab value='saved'>Saved</TabsTab>
            </TabsList>
          </div>
          <TabsPanel value='latest'>
            <p className='p-4 text-center text-muted-foreground text-xs'>Tab 1 content</p>
          </TabsPanel>
          <TabsPanel value='popular'>
            <p className='p-4 text-center text-muted-foreground text-xs'>Tab 2 content</p>
          </TabsPanel>
          <TabsPanel value='saved'>
            <p className='p-4 text-center text-muted-foreground text-xs'>Tab 3 content</p>
          </TabsPanel>
        </Tabs>
      </div>
    </main>
  )
}
