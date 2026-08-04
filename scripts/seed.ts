/**
 * Impulsa Talentos — seed script
 * ===============================
 * Populates the Supabase DB with realistic Colombian marketplace data:
 *   • 12 companies (Bogotá / Medellín / Cali)
 *   • 26 open jobs (COP salaries, bilingual requirements)
 *   • 6 sample profiles (4 candidates + 2 employers)
 *
 * Idempotent: rows are matched by a stable unique key before inserting
 * (company → name, job → title+companyId, profile → email), so re-running
 * never duplicates data.
 *
 * Usage (from the site root):
 *   bun run scripts/seed.ts
 *
 * Credentials come from env vars, defaulting to the project values:
 *   SUPABASE_URL=https://wpnkeryyhsdsislqaegb.supabase.co
 *   SUPABASE_ANON_KEY=sb_publishable_k5kORoRSOzJffgewGUZvcg_1r3igrAi
 * (Tables are created without RLS by migration 001, so the anon key can
 * read/write them. Add a service-role key for locked-down environments.)
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://wpnkeryyhsdsislqaegb.supabase.co',
  process.env.SUPABASE_ANON_KEY ||
    'sb_publishable_k5kORoRSOzJffgewGUZvcg_1r3igrAi',
)

const now = new Date().toISOString()
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

// ── Data ──────────────────────────────────────────────────
const COMPANIES = [
  { name: 'Bancolombia', industry: 'Banking & Finance', size: '1000+', location: 'Medellín, Colombia', website: 'https://www.grupobancolombia.com', contactEmail: 'talento@bancolombia.com', description: 'Largest financial group in Colombia. We hire bilingual engineers, analysts, and CX specialists for our innovation hubs in Medellín.' },
  { name: 'Rappi', industry: 'Technology / Marketplace', size: '1000+', location: 'Bogotá, Colombia', website: 'https://www.rappi.com', contactEmail: 'people@rappi.com', description: 'Latin America\'s super-app. Fast-paced teams building delivery, fintech, and logistics products used by millions.' },
  { name: 'Globant Colombia', industry: 'Technology Services', size: '1000+', location: 'Bogotá, Colombia', website: 'https://www.globant.com', contactEmail: 'talent@globant.co', description: 'Digitally-native technology services company with a strong delivery center in Bogotá serving global clients.' },
  { name: 'Sophos Solutions', industry: 'Software Development', size: '501-1000', location: 'Bogotá, Colombia', website: 'https://www.sophossolutions.com', contactEmail: 'talento@sophossolutions.com', description: 'Colombian software engineering company building banking and government platforms across Latin America.' },
  { name: 'Habia Group', industry: 'BPO / Customer Experience', size: '1000+', location: 'Medellín, Colombia', website: 'https://www.habiagroup.com', contactEmail: 'hr@habiagroup.com', description: 'Customer experience outsourcing with bilingual (EN/ES) contact centers serving US and European clients.' },
  { name: 'Endava', industry: 'Technology Services', size: '1000+', location: 'Medellín, Colombia', website: 'https://www.endava.com', contactEmail: 'careers@endava.com', description: 'Global software engineering and digital services company with a growing Medellín delivery center.' },
  { name: 'Truora', industry: 'Fintech / SaaS', size: '51-200', location: 'Cali, Colombia', website: 'https://www.truora.com', contactEmail: 'talento@truora.com', description: 'Trust and digital identity platform for Latin America, building verification APIs used across the region.' },
  { name: 'Psygnos', industry: 'IT Services', size: '201-500', location: 'Cali, Colombia', website: 'https://www.psygnos.com', contactEmail: 'jobs@psygnos.com', description: 'Software and IT services company delivering enterprise solutions from Cali for clients worldwide.' },
  { name: 'Konecta', industry: 'BPO / Customer Experience', size: '1000+', location: 'Bogotá, Colombia', website: 'https://www.konecta.com.co', contactEmail: 'seleccion@konecta.com.co', description: 'Multilingual customer management and BPO leader with operations across Colombia and LatAm.' },
  { name: 'Dentro', industry: 'Marketing Technology', size: '201-500', location: 'Medellín, Colombia', website: 'https://www.dentro.app', contactEmail: 'careers@dentro.app', description: 'B2B marketing and sales platform hiring top bilingual talent in Medellín for US markets.' },
  { name: 'Truelogic', industry: 'Technology Services', size: '201-500', location: 'Remote · Colombia', website: 'https://www.truelogic.io', contactEmail: 'talent@truelogic.io', description: 'Staff-augmentation studio connecting Colombian engineers with US startups and scale-ups.' },
  { name: 'Lean Solutions Group', industry: 'BPO / Technology', size: '1000+', location: 'Medellín, Colombia', website: 'https://www.leansolutionsgroup.com', contactEmail: 'recruiting@leangroup.com', description: 'Nearshoring talent provider for US companies — bilingual professionals across software, CX, and back-office.' },
]

const JOBS: Array<{ company: string; title: string; level: string; locationType: string; salaryMin: number; salaryMax: number; skills: string; languages: string; description: string; industry: string }> = [
  { company: 'Bancolombia', title: 'Bilingual Full Stack Developer (React + Node)', level: 'Senior', locationType: 'Hybrid · Medellín', salaryMin: 9000000, salaryMax: 14000000, skills: 'React, Node.js, TypeScript, PostgreSQL, AWS', languages: 'English C1, Spanish Native', description: 'Build and maintain digital banking products for our innovation hub. You will work in agile squads with bilingual communication.', industry: 'Technology' },
  { company: 'Bancolombia', title: 'Data Analyst — Financial Services', level: 'Mid-level', locationType: 'Hybrid · Medellín', salaryMin: 6000000, salaryMax: 9000000, skills: 'SQL, Python, Power BI, Excel', languages: 'English B2, Spanish Native', description: 'Analyze customer and operational data to support decision-making across the retail banking division.', industry: 'Finance & Insurance' },
  { company: 'Rappi', title: 'Senior Software Engineer — Delivery Platform', level: 'Senior', locationType: 'Hybrid · Bogotá', salaryMin: 12000000, salaryMax: 18000000, skills: 'Go, Kubernetes, Kafka, Microservices, AWS', languages: 'English B2+, Spanish Native', description: 'Design and scale the services that power millions of deliveries across Latin America.', industry: 'Technology' },
  { company: 'Rappi', title: 'Product Manager — Fintech', level: 'Senior', locationType: 'Hybrid · Bogotá', salaryMin: 11000000, salaryMax: 17000000, skills: 'Product Strategy, Payments, Agile, SQL', languages: 'English C1, Spanish Native', description: 'Own the roadmap of RappiPay features from discovery to launch in multiple markets.', industry: 'Finance & Insurance' },
  { company: 'Globant Colombia', title: 'QA Automation Engineer', level: 'Mid-level', locationType: 'Hybrid · Bogotá', salaryMin: 6000000, salaryMax: 9500000, skills: 'Selenium, Playwright, Java, CI/CD, Jira', languages: 'English B2+, Spanish Native', description: 'Design and maintain automated test suites for global clients in banking and retail.', industry: 'Technology' },
  { company: 'Globant Colombia', title: 'DevOps / Cloud Engineer', level: 'Senior', locationType: 'Remote', salaryMin: 10000000, salaryMax: 15000000, skills: 'AWS, Terraform, Docker, Kubernetes, Python', languages: 'English C1, Spanish Native', description: 'Build cloud infrastructure and delivery pipelines for international digital products.', industry: 'Technology' },
  { company: 'Sophos Solutions', title: 'Java Backend Developer', level: 'Mid-level', locationType: 'On-site · Bogotá', salaryMin: 5500000, salaryMax: 8500000, skills: 'Java, Spring Boot, Oracle, REST APIs', languages: 'English B2, Spanish Native', description: 'Develop backend services for banking clients across Latin America.', industry: 'Technology' },
  { company: 'Habia Group', title: 'Bilingual Customer Service Representative (EN/ES)', level: 'Junior', locationType: 'On-site · Medellín', salaryMin: 2500000, salaryMax: 3800000, skills: 'Customer Service, CRM, Communication', languages: 'English B2+, Spanish Native', description: 'Provide world-class phone and chat support for US and UK brands from our Medellín contact center.', industry: 'Customer Service' },
  { company: 'Habia Group', title: 'Bilingual Technical Support Analyst', level: 'Mid-level', locationType: 'On-site · Medellín', salaryMin: 3000000, salaryMax: 4500000, skills: 'Troubleshooting, Zendesk, Networking Basics', languages: 'English C1, Spanish Native', description: 'Resolve technical issues for software products of international clients.', industry: 'Customer Service' },
  { company: 'Endava', title: '.NET Developer', level: 'Senior', locationType: 'Hybrid · Medellín', salaryMin: 9000000, salaryMax: 13500000, skills: '.NET Core, C#, SQL Server, Azure, Microservices', languages: 'English C1, Spanish Native', description: 'Deliver enterprise software for financial and retail clients in the UK and Europe.', industry: 'Technology' },
  { company: 'Endava', title: 'Project Manager — Digital Delivery', level: 'Lead', locationType: 'Hybrid · Medellín', salaryMin: 11000000, salaryMax: 16000000, skills: 'Agile, Scrum, Stakeholder Management, Jira', languages: 'English C1, Spanish Native', description: 'Lead cross-functional delivery squads serving global enterprise clients.', industry: 'Business Administration & Operations' },
  { company: 'Truora', title: 'Frontend Engineer (React)', level: 'Mid-level', locationType: 'Remote', salaryMin: 6500000, salaryMax: 10000000, skills: 'React, TypeScript, Next.js, Tailwind', languages: 'English B2+, Spanish Native', description: 'Build identity-verification UIs used by fintechs across Latin America.', industry: 'Technology' },
  { company: 'Truora', title: 'Solutions Engineer', level: 'Mid-level', locationType: 'Hybrid · Cali', salaryMin: 6000000, salaryMax: 9000000, skills: 'API Integration, Node.js, Python, Customer Success', languages: 'English B2+, Spanish Native', description: 'Help enterprise clients integrate our verification APIs successfully.', industry: 'Technology' },
  { company: 'Psygnos', title: 'Full Stack Developer (PHP + React)', level: 'Mid-level', locationType: 'On-site · Cali', salaryMin: 5000000, salaryMax: 7500000, skills: 'PHP, Laravel, React, MySQL', languages: 'English B2, Spanish Native', description: 'Develop and maintain enterprise web applications for Colombian and US clients.', industry: 'Technology' },
  { company: 'Konecta', title: 'Bilingual Sales Agent (EN/ES)', level: 'Junior', locationType: 'On-site · Bogotá', salaryMin: 2400000, salaryMax: 3600000, skills: 'Sales, Negotiation, CRM, Outbound Calling', languages: 'English B2+, Spanish Native', description: 'Drive inbound/outbound sales campaigns for international telecommunications clients.', industry: 'Sales & Marketing' },
  { company: 'Konecta', title: 'Team Lead — Customer Experience', level: 'Senior', locationType: 'On-site · Bogotá', salaryMin: 4200000, salaryMax: 6000000, skills: 'Leadership, Coaching, KPIs, Quality', languages: 'English C1, Spanish Native', description: 'Lead a team of 20+ bilingual agents and ensure service levels for a global brand.', industry: 'Customer Service' },
  { company: 'Dentro', title: 'Bilingual Sales Development Representative', level: 'Junior', locationType: 'On-site · Medellín', salaryMin: 3500000, salaryMax: 5000000, skills: 'Outbound Sales, LinkedIn, HubSpot', languages: 'English C1, Spanish Native', description: 'Generate qualified meetings for our B2B marketing platform targeting US companies.', industry: 'Sales & Marketing' },
  { company: 'Dentro', title: 'Marketing Operations Specialist', level: 'Mid-level', locationType: 'Hybrid · Medellín', salaryMin: 5500000, salaryMax: 8000000, skills: 'HubSpot, Salesforce, Data Analysis, Marketing Automation', languages: 'English C1, Spanish Native', description: 'Own marketing data pipelines and campaign operations for a fast-growing US-focused company.', industry: 'Sales & Marketing' },
  { company: 'Truelogic', title: 'Senior React Native Engineer', level: 'Senior', locationType: 'Remote', salaryMin: 10000000, salaryMax: 16000000, skills: 'React Native, TypeScript, Redux, Mobile CI/CD', languages: 'English C1, Spanish Native', description: 'Build mobile apps for US startups from anywhere in Colombia — fully remote, US hours.', industry: 'Technology' },
  { company: 'Truelogic', title: 'Node.js Backend Engineer', level: 'Senior', locationType: 'Remote', salaryMin: 9500000, salaryMax: 15000000, skills: 'Node.js, TypeScript, PostgreSQL, Redis, AWS', languages: 'English C1, Spanish Native', description: 'Ship backend services for venture-backed US startups with a senior Colombian team.', industry: 'Technology' },
  { company: 'Lean Solutions Group', title: 'Bilingual Accounting Analyst', level: 'Mid-level', locationType: 'Remote', salaryMin: 4500000, salaryMax: 7000000, skills: 'QuickBooks, US GAAP, Excel, AP/AR', languages: 'English C1, Spanish Native', description: 'Support US accounting teams with full-cycle bookkeeping from home.', industry: 'Accounting & Finance' },
  { company: 'Lean Solutions Group', title: 'Frontend Developer (Angular)', level: 'Mid-level', locationType: 'Remote', salaryMin: 6500000, salaryMax: 10000000, skills: 'Angular, TypeScript, RxJS, SCSS', languages: 'English B2+, Spanish Native', description: 'Join a nearshore squad building enterprise web apps for a US logistics client.', industry: 'Technology' },
  { company: 'Lean Solutions Group', title: 'Recruiter (Bilingual)', level: 'Mid-level', locationType: 'Hybrid · Medellín', salaryMin: 4000000, salaryMax: 6000000, skills: 'Sourcing, Interviewing, ATS, Boolean Search', languages: 'English C1, Spanish Native', description: 'Recruit top technical talent in Colombia and LatAm for US companies.', industry: 'Human Resources & Legal' },
  { company: 'Sophos Solutions', title: 'Business Analyst (Bilingual)', level: 'Mid-level', locationType: 'On-site · Bogotá', salaryMin: 5000000, salaryMax: 7500000, skills: 'Requirements, SQL, UML, Agile, Documentation', languages: 'English B2+, Spanish Native', description: 'Bridge business and technology for banking projects across the region.', industry: 'Business Administration & Operations' },
  { company: 'Psygnos', title: 'IT Support Specialist (Bilingual)', level: 'Junior', locationType: 'On-site · Cali', salaryMin: 2800000, salaryMax: 4000000, skills: 'Windows, Networking, Active Directory, Ticketing', languages: 'English B2, Spanish Native', description: 'Provide level-1/2 IT support for enterprise clients in Spanish and English.', industry: 'Customer Service' },
  { company: 'Rappi', title: 'Data Scientist — Logistics Optimization', level: 'Senior', locationType: 'Hybrid · Bogotá', salaryMin: 12000000, salaryMax: 18000000, skills: 'Python, ML, Optimization, Spark, SQL', languages: 'English B2+, Spanish Native', description: 'Model delivery times and route optimization to make Rappi faster and cheaper.', industry: 'Technology' },
]

const PROFILES: Array<{ role: 'candidate' | 'employer'; fullName: string; email: string; phone: string; location: string; bio: string; languages: string }> = [
  { role: 'candidate', fullName: 'María Camila Rodríguez', email: 'sample.maria.rodriguez@example.co', phone: '+57 300 111 2233', location: 'Medellín, Colombia', bio: 'Full stack developer with 5 years building fintech products. Passionate about clean code and mentoring.', languages: 'English C1, Spanish Native' },
  { role: 'candidate', fullName: 'Andrés Felipe Gómez', email: 'sample.andres.gomez@example.co', phone: '+57 310 222 3344', location: 'Bogotá, Colombia', bio: 'Product manager and former engineer. I love turning complex problems into simple, valuable products.', languages: 'English C1, Spanish Native' },
  { role: 'candidate', fullName: 'Laura Valentina Pérez', email: 'sample.laura.perez@example.co', phone: '+57 320 333 4455', location: 'Cali, Colombia', bio: 'Bilingual customer experience professional with 3 years in BPO operations for US brands.', languages: 'English B2+, Spanish Native' },
  { role: 'candidate', fullName: 'Juan David Torres', email: 'sample.juan.torres@example.co', phone: '+57 301 444 5566', location: 'Medellín, Colombia', bio: 'DevOps engineer focused on AWS and Kubernetes. Ex-Bancolombia, now looking for global opportunities.', languages: 'English C1, Spanish Native' },
  { role: 'employer', fullName: 'Carolina Restrepo', email: 'sample.hr.bancolombia@example.co', phone: '+57 604 555 6677', location: 'Medellín, Colombia', bio: 'Talent acquisition lead at a major financial group.', languages: 'Spanish Native, English C1' },
  { role: 'employer', fullName: 'Santiago Ospina', email: 'sample.ceo.truelogic@example.co', phone: '+57 305 666 7788', location: 'Bogotá, Colombia', bio: 'Founder of a nearshore software studio connecting Colombian engineers with US startups.', languages: 'Spanish Native, English Native' },
]


// ── Helpers ───────────────────────────────────────────────
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c: string) => `_${c.toLowerCase()}`)
const rowToCamel = (row: Record<string, unknown>) => {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())] = v
  }
  return out
}

async function listAll(table: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase.from(table).select('*').limit(500)
  if (error) throw error
  return (data ?? []).map(rowToCamel)
}

async function createRow(table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const row: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) row[toSnake(k)] = v
  const { data: created, error } = await supabase.from(table).insert(row).select().single()
  if (error) throw error
  return rowToCamel(created as Record<string, unknown>)
}
async function updateRow(table: string, id: string, data: Record<string, unknown>): Promise<void> {
  const row: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) row[toSnake(k)] = v
  const { error } = await supabase.from(table).update(row).eq('id', id)
  if (error) throw error
}

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`)
  console.error('  Make sure SUPABASE_URL / SUPABASE_ANON_KEY are set and migration 001 has run.')
  process.exit(1)
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  console.log(`Seeding Impulsa Talentos (project: ${supabase.supabaseUrl})…`)

  // Companies (idempotent by name)
  const existingCompanies = await listAll('companies')
  const byName = new Map(existingCompanies.map((c: any) => [c.name, c]))
  let companiesCreated = 0
  const companyIdByName = new Map<string, string>()
  for (const c of COMPANIES) {
    const existing = byName.get(c.name)
    if (existing) {
      companyIdByName.set(c.name, existing.id)
      continue
    }
    const row = await createRow('companies', { ...c, employerId: `seed-employer-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, logoUrl: '' }).catch((e: any) => fail(`companies.create failed for ${c.name}: ${e?.message || e}`))
    companyIdByName.set(c.name, row.id as string)
    companiesCreated++
  }
  console.log(`  companies: ${companiesCreated} created, ${companyIdByName.size} total`)

  // Jobs (idempotent by title + company)
  const existingJobs = await listAll('jobs')
  const jobKeys = new Set(existingJobs.map((j: any) => `${j.companyId}::${j.title}`))
  let jobsCreated = 0
  for (const j of JOBS) {
    const companyId = companyIdByName.get(j.company)
    if (!companyId) continue
    const key = `${companyId}::${j.title}`
    if (jobKeys.has(key)) continue
    await createRow('jobs', {
      companyId,
      title: j.title,
      description: j.description,
      level: j.level,
      locationType: j.locationType,
      salaryMin: j.salaryMin,
      salaryMax: j.salaryMax,
      currency: 'COP',
      skillsRequired: j.skills,
      languagesRequired: j.languages,
      status: 'open',
      industry: j.industry,
    }).catch((e: any) => fail(`jobs.create failed for ${j.title}: ${e?.message || e}`))
    jobKeys.add(key)
    jobsCreated++
  }
  // Backfill industry tags on jobs created before migration 003 added the column.
  // Wraps in try/catch so a DB that hasn't had migration 003 applied yet still
  // seeds successfully (the column just won't exist until the migration runs).
  let industryTagged = 0
  for (const j of JOBS) {
    const companyId = companyIdByName.get(j.company)
    if (!companyId) continue
    const existing = existingJobs.find(
      (e: any) => `${e.companyId}::${e.title}` === `${companyId}::${j.title}`,
    )
    if (!existing || existing.industry) continue
    try {
      await updateRow('jobs', existing.id as string, { industry: j.industry })
      industryTagged++
    } catch (e: any) {
      console.warn(`  [warn] could not tag "${j.title}" with industry — is migration 003 applied? (${e?.message})`)
    }
  }
  if (industryTagged > 0) {
    console.log(`  jobs: industry tags backfilled on ${industryTagged} existing rows`)
  }
  console.log(`  jobs: ${jobsCreated} created, ${jobKeys.size} total`)

  // Profiles (idempotent by email)
  const existingProfiles = await listAll('profiles')
  const profileEmails = new Set(existingProfiles.map((p: any) => p.email))
  let profilesCreated = 0
  for (const p of PROFILES) {
    if (profileEmails.has(p.email)) continue
    await createRow('profiles', {
      userId: `seed-user-${p.email.split('@')[0]}`,
      role: p.role,
      fullName: p.fullName,
      email: p.email,
      phone: p.phone,
      location: p.location,
      bio: p.bio,
      languages: p.languages,
      avatarUrl: '',
      cvUrl: '',
    }).catch((e: any) => fail(`profiles.create failed for ${p.email}: ${e?.message || e}`))
    profileEmails.add(p.email)
    profilesCreated++
  }
  console.log(`  profiles: ${profilesCreated} created, ${profileEmails.size} total`)

  console.log('\n✓ Seed complete. Marketplace now has data for the owner and early testers.')
}

main().catch((e) => fail(e?.message || String(e)))
