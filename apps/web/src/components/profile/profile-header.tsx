import { Link } from '@tanstack/react-router'
import {
  IconBrandGithub,
  IconBrandLinkedin,
  IconBrandX,
  IconCalendar,
  IconMapPin,
  IconWorld,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FollowButton, ShareButton, SubscribeButton } from './profile-actions'

type ProfileHeaderData = {
  id: string
  name: string
  username: string | null
  image: string | null
  bio: string | null
  website: string | null
  location: string | null
  socialLinks: {
    twitter?: string
    github?: string
    linkedin?: string
    website?: string
  } | null
  createdAt: Date | null
  followerCount: number
  followingCount: number
  postCount: number
  isFollowing: boolean
}

function ensureHttp(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function SocialIcon({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={ensureHttp(href)}
      target='_blank'
      rel='noopener noreferrer'
      className='text-muted-foreground transition-colors hover:text-foreground'
    >
      {children}
    </a>
  )
}

export function ProfileHeader({
  profile,
  isOwnProfile,
}: {
  profile: ProfileHeaderData
  isOwnProfile: boolean
}) {
  const handle = profile.username ?? ''
  const joinedYear = profile.createdAt ? new Date(profile.createdAt).getFullYear() : null
  const social = profile.socialLinks ?? {}

  return (
    <div className='mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-10'>
      <Link to='/' className='font-bold text-2xl tracking-tight'>
        Lemma
      </Link>

      <Avatar className='size-20 rounded-full'>
        <AvatarImage alt={profile.name} src={profile.image ?? undefined} />
        <AvatarFallback>{profile.name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className='space-y-1'>
        <h1 className='font-semibold text-xl'>{profile.name}</h1>
        {handle && <p className='text-muted-foreground text-sm'>@{handle}</p>}
      </div>

      <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-sm'>
        {joinedYear && (
          <span className='flex items-center gap-1.5'>
            <IconCalendar size={16} /> Joined {joinedYear}
          </span>
        )}
        {profile.location && (
          <span className='flex items-center gap-1.5'>
            <IconMapPin size={16} /> {profile.location}
          </span>
        )}
        {profile.website && (
          <a
            href={ensureHttp(profile.website)}
            target='_blank'
            rel='noopener noreferrer'
            className='flex items-center gap-1.5 hover:text-foreground'
          >
            <IconWorld size={16} /> Website
          </a>
        )}
      </div>

      {profile.bio && <p className='text-sm leading-relaxed'>{profile.bio}</p>}

      <div className='flex items-center gap-4 text-sm'>
        <span>
          <strong className='font-semibold'>{profile.postCount}</strong>{' '}
          <span className='text-muted-foreground'>Posts</span>
        </span>
        <span>
          <strong className='font-semibold'>{profile.followerCount}</strong>{' '}
          <span className='text-muted-foreground'>Followers</span>
        </span>
        <span>
          <strong className='font-semibold'>{profile.followingCount}</strong>{' '}
          <span className='text-muted-foreground'>Following</span>
        </span>
      </div>

      {(social.twitter || social.github || social.linkedin || social.website) && (
        <div className='flex items-center gap-4'>
          {social.twitter && (
            <SocialIcon href={social.twitter}>
              <IconBrandX size={18} />
            </SocialIcon>
          )}
          {social.github && (
            <SocialIcon href={social.github}>
              <IconBrandGithub size={18} />
            </SocialIcon>
          )}
          {social.linkedin && (
            <SocialIcon href={social.linkedin}>
              <IconBrandLinkedin size={18} />
            </SocialIcon>
          )}
          {social.website && (
            <SocialIcon href={social.website}>
              <IconWorld size={18} />
            </SocialIcon>
          )}
        </div>
      )}

      <div className='flex items-center gap-2'>
        {isOwnProfile ? (
          <Button variant='outline' render={<Link to='/app/settings/profile'>Edit profile</Link>} />
        ) : (
          <>
            <FollowButton
              userId={profile.id}
              username={handle}
              initialIsFollowing={profile.isFollowing}
              initialFollowerCount={profile.followerCount}
            />
            <SubscribeButton username={handle} />
          </>
        )}
        <ShareButton username={handle} />
      </div>
    </div>
  )
}
