/**
 * The social accounts the candidate campaign needs, in the order to create
 * them. HQ › Campaigns › Social accounts shows this list next to a form that
 * saves each account (migration 049: hq_save_social_account).
 *
 * Bios are Spanish (Colombia first) and kept under each platform's limit.
 * Links are tracked so sign-ups are credited to the channel (see the funnel).
 */
const SITE = 'https://impulsatalentos.expert'
const tracked = (source: string, medium: string, campaign = 'bio') =>
  `${SITE}/?utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaign}`

export interface SocialAccount {
  /** marketing_channels.code */
  code: string
  priority: 'now' | 'ads' | 'later'
  platform: string
  /** What kind of account to create. */
  kind: { en: string; es: string }
  createUrl: string
  /** Suggested name and handle; fall back in order if taken. */
  name: string
  handles: string[]
  bio: string
  bioLimit: number
  link: string
  /** What to have ready before creating it. */
  needs: { en: string; es: string }
}

export const SOCIAL_ACCOUNTS: SocialAccount[] = [
  {
    code: 'instagram', priority: 'now', platform: 'Instagram',
    kind: { en: 'Professional account (Business), linked to the Facebook Page', es: 'Cuenta profesional (Empresa), vinculada a la página de Facebook' },
    createUrl: 'https://www.instagram.com/accounts/emailsignup/',
    name: 'Impulsa Talentos', handles: ['impulsatalentos', 'impulsa.talentos', 'impulsatalentosco'],
    bio: 'Empleos bilingües en Colombia 🇨🇴 Crea tu perfil gratis, sube tu hoja de vida y te mostramos las vacantes que encajan contigo 👇',
    bioLimit: 150, link: tracked('instagram', 'social'),
    needs: { en: 'Shared login email, logo (square), authenticator app for 2-step verification', es: 'Correo de acceso compartido, logo cuadrado, app de autenticación para la verificación en dos pasos' },
  },
  {
    code: 'facebook', priority: 'now', platform: 'Facebook',
    kind: { en: 'Facebook Page (category: Employment agency), managed from a personal admin profile', es: 'Página de Facebook (categoría: Agencia de empleo), administrada desde un perfil personal' },
    createUrl: 'https://www.facebook.com/pages/create',
    name: 'Impulsa Talentos', handles: ['impulsatalentos', 'impulsatalentosco'],
    bio: 'Conectamos talento bilingüe colombiano con empresas locales e internacionales. Crea tu perfil gratis, sube tu hoja de vida y recibe las vacantes que encajan contigo.',
    bioLimit: 255, link: tracked('facebook', 'social'),
    needs: { en: 'A real personal Facebook profile to be the Page admin (add a second admin), logo, cover image', es: 'Un perfil personal real de Facebook como administrador (agrega un segundo admin), logo, imagen de portada' },
  },
  {
    code: 'tiktok', priority: 'now', platform: 'TikTok',
    kind: { en: 'Business account', es: 'Cuenta de empresa' },
    createUrl: 'https://www.tiktok.com/signup',
    name: 'Impulsa Talentos', handles: ['impulsatalentos', 'impulsa.talentos', 'impulsatalentosco'],
    bio: 'Empleos bilingües en Colombia 🇨🇴 Sube tu hoja de vida gratis 👇',
    bioLimit: 80, link: tracked('tiktok', 'social'),
    needs: { en: 'Shared login email or phone; switch to a Business account in Settings so the bio link works', es: 'Correo o teléfono de acceso; cambia a cuenta de empresa en Ajustes para que funcione el enlace de la bio' },
  },
  {
    code: 'whatsapp_business', priority: 'now', platform: 'WhatsApp Business',
    kind: { en: 'WhatsApp Business app on a dedicated number', es: 'App WhatsApp Business en un número exclusivo' },
    createUrl: 'https://business.whatsapp.com/products/business-app',
    name: 'Impulsa Talentos', handles: [],
    bio: 'Empleos bilingües en Colombia. Te ayudamos a crear tu perfil y subir tu hoja de vida. Respondemos de lunes a viernes.',
    bioLimit: 139, link: tracked('whatsapp', 'messaging'),
    needs: { en: 'A Colombian SIM used only for the business (not a personal number); business hours; a short greeting message', es: 'Una SIM colombiana solo para el negocio (no un número personal); horario de atención; mensaje de bienvenida' },
  },
  {
    code: 'whatsapp_channel', priority: 'now', platform: 'WhatsApp Channel',
    kind: { en: 'Channel created from the WhatsApp Business app (Updates tab)', es: 'Canal creado desde la app WhatsApp Business (pestaña Novedades)' },
    createUrl: 'https://faq.whatsapp.com/1503459223789468',
    name: 'Impulsa Talentos · Vacantes bilingües', handles: [],
    bio: 'Cada semana: vacantes bilingües en Colombia y un consejo para tu hoja de vida. Crea tu perfil gratis en impulsatalentos.expert',
    bioLimit: 300, link: tracked('whatsapp', 'messaging', 'digest-semanal'),
    needs: { en: 'The WhatsApp Business number above', es: 'El número de WhatsApp Business de arriba' },
  },
  {
    code: 'linkedin_company', priority: 'now', platform: 'LinkedIn',
    kind: { en: 'Company Page (Staffing and recruiting)', es: 'Página de empresa (Servicios de empleo y selección)' },
    createUrl: 'https://www.linkedin.com/company/setup/new/',
    name: 'Impulsa Talentos', handles: ['impulsa-talentos', 'impulsatalentos'],
    bio: 'Conectamos talento bilingüe colombiano con empresas locales e internacionales.',
    bioLimit: 120, link: tracked('linkedin', 'social'),
    needs: { en: "A founder's personal LinkedIn profile (real name, some history) and a company email on the domain", es: 'El perfil personal de LinkedIn del fundador (nombre real, con historial) y un correo del dominio' },
  },
  {
    code: 'meta_ads', priority: 'ads', platform: 'Meta Business (ads)',
    kind: { en: 'Business portfolio with an ad account (Business Suite)', es: 'Portafolio comercial con cuenta publicitaria (Business Suite)' },
    createUrl: 'https://business.facebook.com/overview',
    name: 'Impulsa Talentos S.A.S.', handles: [],
    bio: '', bioLimit: 0, link: tracked('facebook', 'social', 'lanzamiento-ads-sem3'),
    needs: { en: 'Legal name and NIT for business verification, a payment card you add yourself, the Page and Instagram connected', es: 'Razón social y NIT para verificar el negocio, una tarjeta que agregas tú, la página y el Instagram conectados' },
  },
  {
    code: 'tiktok_ads', priority: 'ads', platform: 'TikTok Ads Manager',
    kind: { en: 'Ads Manager account (for Spark Ads on organic posts)', es: 'Cuenta de Ads Manager (para Spark Ads con publicaciones orgánicas)' },
    createUrl: 'https://ads.tiktok.com/',
    name: 'Impulsa Talentos S.A.S.', handles: [],
    bio: '', bioLimit: 0, link: tracked('tiktok', 'social', 'lanzamiento-ads-sem3'),
    needs: { en: 'Legal name, NIT, website, a payment method you add yourself; link the TikTok account', es: 'Razón social, NIT, sitio web, un medio de pago que agregas tú; vincula la cuenta de TikTok' },
  },
  {
    code: 'youtube', priority: 'later', platform: 'YouTube',
    kind: { en: 'Brand channel (re-post TikToks as Shorts)', es: 'Canal de marca (reutiliza los TikToks como Shorts)' },
    createUrl: 'https://www.youtube.com/create_channel',
    name: 'Impulsa Talentos', handles: ['impulsatalentos', 'impulsa.talentos'],
    bio: 'Empleos bilingües en Colombia: consejos para tu hoja de vida, entrevistas en inglés y vacantes reales. Crea tu perfil gratis en impulsatalentos.expert',
    bioLimit: 1000, link: tracked('youtube', 'social'),
    needs: { en: 'A Google account for the brand', es: 'Una cuenta de Google para la marca' },
  },
  {
    code: 'google_business', priority: 'later', platform: 'Google Business Profile',
    kind: { en: 'Service-area business (no public address needed)', es: 'Negocio con área de servicio (sin dirección pública)' },
    createUrl: 'https://business.google.com/create',
    name: 'Impulsa Talentos', handles: [],
    bio: 'Plataforma de empleo bilingüe que conecta talento colombiano con empresas locales e internacionales. Gratis para candidatos.',
    bioLimit: 750, link: tracked('google', 'local'),
    needs: { en: 'The brand Google account; Google will verify by phone, email or video', es: 'La cuenta de Google de la marca; Google verifica por teléfono, correo o video' },
  },
  {
    code: 'telegram_jobs', priority: 'later', platform: 'Telegram',
    kind: { en: 'Public channel mirroring the WhatsApp digest', es: 'Canal público que replica el resumen de WhatsApp' },
    createUrl: 'https://telegram.org/',
    name: 'Impulsa Talentos · Vacantes bilingües', handles: ['impulsatalentos', 'vacantesbilingues'],
    bio: 'Vacantes bilingües en Colombia cada semana. Crea tu perfil gratis 👇',
    bioLimit: 255, link: tracked('telegram', 'messaging', 'digest-semanal'),
    needs: { en: 'A phone number for the account', es: 'Un número de teléfono para la cuenta' },
  },
]
