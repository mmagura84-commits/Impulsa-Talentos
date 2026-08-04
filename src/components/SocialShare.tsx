/**
 * SocialShare — share / refer a job posting.
 * Pure client-side: copies a sharable URL to the clipboard and opens native
 * share dialogs (Web Share API) where available. Falls back to platform
 * share URLs (Twitter/X, Facebook, LinkedIn, WhatsApp) and an email link.
 *
 * Two modes:
 *   - `variant="inline"` — full bar with all channels
 *   - `variant="compact"` — small icon group, used in cards / lists
 *   - `variant="floating"` — fixed bottom-right share pill (with referral copy)
 */
import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Share2,
  Link as LinkIcon,
  Mail,
  Check,
  X,
  Copy,
  Gift,
  Users,
} from 'lucide-react'

/* ── Inline brand SVG icons (lucide-react fork in this project
     doesn't ship Linkedin/Facebook/Twitter; render minimal
     wordmark icons that match the real brand colors). ── */
function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M19 0H5a5 5 0 00-5 5v14a5 5 0 005 5h14a5 5 0 005-5V5a5 5 0 00-5-5zM8 19H5V8h3v11zM6.5 6.7a1.8 1.8 0 110-3.5 1.8 1.8 0 010 3.5zM20 19h-3v-5.6c0-1.5-.5-2-1.4-2-1 0-1.6.7-1.6 2V19h-3V8h3v1.4c.4-.7 1.3-1.6 3-1.6 2.3 0 3 1.4 3 4V19z" />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 10-11.6 9.9v-7H8v-2.9h2.4V9.8c0-2.4 1.4-3.7 3.6-3.7 1 0 2.1.2 2.1.2v2.3h-1.2c-1.2 0-1.5.7-1.5 1.5V12h2.6l-.4 2.9h-2.2v7A10 10 0 0022 12z" />
    </svg>
  )
}

function TwitterXIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2H21l-6.55 7.49L22 22h-6.81l-5.34-6.97L3.7 22H1l7.04-8.04L1.5 2h6.93l4.84 6.4L18.24 2zm-1.19 18.2h1.55L7.05 3.7H5.4l11.65 16.5z" />
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4-.1-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 00-8.5 15.3L2 22l4.8-1.4A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.1l-.3-.2-3 .9.9-2.9-.2-.3A8.2 8.2 0 1112 20.2z" />
    </svg>
  )
}

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nProvider'

export interface SocialShareProps {
  /** Page title used as the default share message. */
  title: string
  /** Optional description included in the share copy. */
  description?: string
  /** URL to share. Defaults to current window location. */
  url?: string
  /** Short referral slug (e.g. candidate name) shown in the copied message. */
  referralHandle?: string
  /** "Refer a friend" mode adds a personal pitch line to the share copy. */
  referralMode?: boolean
  className?: string
  variant?: 'inline' | 'compact' | 'floating'
}

/* ── URL builders ──────────────────────────────────────── */
function buildChannelUrl(channel: 'twitter' | 'facebook' | 'linkedin' | 'whatsapp' | 'email' | 'mailto', text: string, url: string): string {
  const enc = (s: string) => encodeURIComponent(s)
  switch (channel) {
    case 'twitter':
      return `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}&quote=${enc(text)}`
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}&summary=${enc(text)}`
    case 'whatsapp':
      return `https://wa.me/?text=${enc(text + '\n\n' + url)}`
    case 'email':
    case 'mailto':
      return `mailto:?subject=${enc(text)}&body=${enc(text + '\n\n' + url)}`
  }
}

/* ── Single channel button ─────────────────────────────── */
function ChannelButton({
  href,
  label,
  icon,
  onClick,
  className,
  brandColor,
}: {
  href?: string
  label: string
  icon: ReactNode
  onClick?: () => void
  className?: string
  brandColor: string
}) {
  const inner = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:scale-110 hover:shadow-md cursor-pointer',
        className ?? 'h-9 w-9',
      )}
      aria-label={label}
      style={{ ['--brand' as string]: brandColor }}
    >
      <span className="transition-colors group-hover:text-foreground" style={{ color: brandColor }}>
        {icon}
      </span>
    </button>
  )
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex">
        {inner}
      </a>
    )
  }
  return inner
}

/* ── Toast-like copy confirmation ──────────────────────── */
function CopiedPill({ message }: { message: string }) {
  return (
    <AnimatePresence>
      <motion.span
        key="copied"
        initial={{ opacity: 0, y: 6, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.95 }}
        transition={{ duration: 0.18 }}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
      >
        <Check className="size-3" />
        {message}
      </motion.span>
    </AnimatePresence>
  )
}

/* ── Main component ────────────────────────────────────── */
export function SocialShare({
  title,
  description,
  url,
  referralHandle,
  referralMode = false,
  className,
  variant = 'inline',
}: SocialShareProps) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const [showReferralInput, setShowReferralInput] = useState(false)

  const shareUrl = (url ?? (typeof window !== 'undefined' ? window.location.href : '')).trim()
  const baseText = referralMode
    ? t('social.referralMessage', { handle: referralHandle ?? t('social.aFriend'), title })
    : title
  const fullText = description && !referralMode
    ? `${baseText} — ${description}`
    : baseText

  const copy = async () => {
    if (typeof navigator === 'undefined') return
    try {
      await navigator.clipboard.writeText(`${fullText}\n${shareUrl}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      // Clipboard blocked — silently degrade
    }
  }

  const nativeShare = async () => {
    if (typeof navigator === 'undefined' || !('share' in navigator)) return
    try {
      await navigator.share({ title, text: fullText, url: shareUrl })
    } catch {
      // user cancelled or share failed
    }
  }

  const hasNativeShare = typeof navigator !== 'undefined' && 'share' in navigator

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              aria-label={t('social.copyLink')}
            >
              {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{t('social.copyLink')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={buildChannelUrl('linkedin', fullText, shareUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              aria-label={t('social.shareLinkedin')}
            >
              <LinkedinIcon className="size-3.5" />
            </a>
          </TooltipTrigger>
          <TooltipContent side="top">{t('social.shareLinkedin')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={buildChannelUrl('whatsapp', fullText, shareUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              aria-label={t('social.shareWhatsapp')}
            >
              <WhatsAppIcon className="size-3.5" />
            </a>
          </TooltipTrigger>
          <TooltipContent side="top">{t('social.shareWhatsapp')}</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  if (variant === 'floating') {
    return (
      <div
        className={cn(
          'fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2',
          className,
        )}
      >
        {showReferralInput && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-border bg-card shadow-xl p-4 w-80"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Gift className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('social.referralTitle')}</p>
                  <p className="text-[11px] text-muted-foreground">{t('social.referralSubtitle')}</p>
                </div>
              </div>
              <button
                onClick={() => setShowReferralInput(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label={t('social.close')}
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {t('social.referralBody')}
            </p>
            <div className="flex items-center gap-2">
              <ChannelButton
                onClick={copy}
                label={t('social.copyLink')}
                icon={<LinkIcon className="size-4" />}
                className="h-9 w-9"
                brandColor="currentColor"
              />
              <ChannelButton
                href={buildChannelUrl('whatsapp', fullText, shareUrl)}
                label={t('social.shareWhatsapp')}
                icon={<WhatsAppIcon className="size-4" />}
                brandColor="#25D366"
              />
              <ChannelButton
                href={buildChannelUrl('linkedin', fullText, shareUrl)}
                label={t('social.shareLinkedin')}
                icon={<LinkedinIcon className="size-4" />}
                brandColor="#0A66C2"
              />
              <ChannelButton
                href={buildChannelUrl('twitter', fullText, shareUrl)}
                label={t('social.shareTwitter')}
                icon={<TwitterXIcon className="size-4" />}
                brandColor="#000000"
              />
              <ChannelButton
                href={buildChannelUrl('email', fullText, shareUrl)}
                label={t('social.shareEmail')}
                icon={<Mail className="size-4" />}
                brandColor="#EA4335"
              />
            </div>
            {copied && (
              <div className="mt-3">
                <CopiedPill message={t('social.linkCopied')} />
              </div>
            )}
          </motion.div>
        )}
        <Button
          onClick={() => setShowReferralInput(v => !v)}
          size="lg"
          className="rounded-full shadow-xl gap-2 font-medium px-5 h-12 cursor-pointer"
        >
          <Users className="size-4" />
          {t('social.referAFriend')}
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card p-5 sm:p-6',
        referralMode && 'ring-1 ring-accent/40 bg-gradient-to-br from-accent/5 to-transparent',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {referralMode ? (
              <Gift className="size-4 text-accent" />
            ) : (
              <Share2 className="size-4 text-primary" />
            )}
            <p className="text-sm font-semibold text-foreground">
              {referralMode ? t('social.referAFriend') : t('social.shareThisJob')}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {referralMode
              ? t('social.referralBody')
              : t('social.shareThisJobDesc')}
          </p>
        </div>
        {copied && <CopiedPill message={t('social.linkCopied')} />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={copy} variant="default" size="sm" className="gap-2 font-medium">
          <LinkIcon className="size-3.5" />
          {t('social.copyLink')}
        </Button>
        {hasNativeShare && (
          <Button onClick={nativeShare} variant="secondary" size="sm" className="gap-2 font-medium">
            <Share2 className="size-3.5" />
            {t('social.share')}
          </Button>
        )}
        <ChannelButton
          href={buildChannelUrl('linkedin', fullText, shareUrl)}
          label={t('social.shareLinkedin')}
          icon={<LinkedinIcon className="size-4" />}
          brandColor="#0A66C2"
        />
        <ChannelButton
          href={buildChannelUrl('whatsapp', fullText, shareUrl)}
          label={t('social.shareWhatsapp')}
          icon={<WhatsAppIcon className="size-4" />}
          brandColor="#25D366"
        />
        <ChannelButton
          href={buildChannelUrl('facebook', fullText, shareUrl)}
          label={t('social.shareFacebook')}
          icon={<FacebookIcon className="size-4" />}
          brandColor="#1877F2"
        />
        <ChannelButton
          href={buildChannelUrl('twitter', fullText, shareUrl)}
          label={t('social.shareTwitter')}
          icon={<TwitterXIcon className="size-4" />}
          brandColor="#000000"
        />
        <ChannelButton
          href={buildChannelUrl('email', fullText, shareUrl)}
          label={t('social.shareEmail')}
          icon={<Mail className="size-4" />}
          brandColor="#EA4335"
        />
      </div>
    </div>
  )
}
