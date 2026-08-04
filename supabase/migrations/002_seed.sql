-- Impulsa Talentos — seed data (run in Supabase SQL Editor, No limit)
-- Creates 12 companies, 26 jobs, 6 sample profiles
-- Idempotent: uses ON CONFLICT to skip duplicates on re-run

DO $$
DECLARE
  v_company_id uuid;
  v_bancolombia_id uuid;
  v_rappi_id uuid;
  v_globant_id uuid;
  v_sophos_id uuid;
  v_habia_id uuid;
  v_endava_id uuid;
  v_truora_id uuid;
  v_psygnos_id uuid;
  v_konecta_id uuid;
  v_dentro_id uuid;
  v_truelogic_id uuid;
  v_lean_id uuid;
BEGIN

-- ── Companies (skip if name already exists) ──
INSERT INTO public.companies (name, industry, size, location, website, contact_email, description, employer_id, created_at, updated_at)
VALUES ('Bancolombia', 'Banking & Finance', '1000+', 'Medellín, Colombia', 'https://www.grupobancolombia.com', 'talento@bancolombia.com', 'Largest financial group in Colombia.', 'seed-bancolombia', now() - interval '20 days', now() - interval '20 days')
ON CONFLICT DO NOTHING;
SELECT id INTO v_bancolombia_id FROM public.companies WHERE name = 'Bancolombia';

INSERT INTO public.companies (name, industry, size, location, website, contact_email, description, employer_id, created_at, updated_at)
VALUES ('Rappi', 'Technology / Marketplace', '1000+', 'Bogotá, Colombia', 'https://www.rappi.com', 'people@rappi.com', 'Latin America''s super-app.', 'seed-rappi', now() - interval '20 days', now() - interval '20 days')
ON CONFLICT DO NOTHING;
SELECT id INTO v_rappi_id FROM public.companies WHERE name = 'Rappi';

INSERT INTO public.companies (name, industry, size, location, website, contact_email, description, employer_id, created_at, updated_at)
VALUES ('Globant Colombia', 'Technology Services', '1000+', 'Bogotá, Colombia', 'https://www.globant.com', 'talent@globant.co', 'Digitally-native technology services company.', 'seed-globant', now() - interval '20 days', now() - interval '20 days')
ON CONFLICT DO NOTHING;
SELECT id INTO v_globant_id FROM public.companies WHERE name = 'Globant Colombia';

INSERT INTO public.companies (name, industry, size, location, website, contact_email, description, employer_id, created_at, updated_at)
VALUES ('Sophos Solutions', 'Software Development', '501-1000', 'Bogotá, Colombia', 'https://www.sophossolutions.com', 'talento@sophossolutions.com', 'Colombian software engineering company.', 'seed-sophos', now() - interval '20 days', now() - interval '20 days')
ON CONFLICT DO NOTHING;
SELECT id INTO v_sophos_id FROM public.companies WHERE name = 'Sophos Solutions';

INSERT INTO public.companies (name, industry, size, location, website, contact_email, description, employer_id, created_at, updated_at)
VALUES ('Habia Group', 'BPO / Customer Experience', '1000+', 'Medellín, Colombia', 'https://www.habiagroup.com', 'hr@habiagroup.com', 'Customer experience outsourcing.', 'seed-habia', now() - interval '20 days', now() - interval '20 days')
ON CONFLICT DO NOTHING;
SELECT id INTO v_habia_id FROM public.companies WHERE name = 'Habia Group';

INSERT INTO public.companies (name, industry, size, location, website, contact_email, description, employer_id, created_at, updated_at)
VALUES ('Endava', 'Technology Services', '1000+', 'Medellín, Colombia', 'https://www.endava.com', 'careers@endava.com', 'Global software engineering and digital services.', 'seed-endava', now() - interval '20 days', now() - interval '20 days')
ON CONFLICT DO NOTHING;
SELECT id INTO v_endava_id FROM public.companies WHERE name = 'Endava';

INSERT INTO public.companies (name, industry, size, location, website, contact_email, description, employer_id, created_at, updated_at)
VALUES ('Truora', 'Fintech / SaaS', '51-200', 'Cali, Colombia', 'https://www.truora.com', 'talento@truora.com', 'Trust and digital identity platform.', 'seed-truora', now() - interval '20 days', now() - interval '20 days')
ON CONFLICT DO NOTHING;
SELECT id INTO v_truora_id FROM public.companies WHERE name = 'Truora';

INSERT INTO public.companies (name, industry, size, location, website, contact_email, description, employer_id, created_at, updated_at)
VALUES ('Psygnos', 'IT Services', '201-500', 'Cali, Colombia', 'https://www.psygnos.com', 'jobs@psygnos.com', 'Software and IT services company.', 'seed-psygnos', now() - interval '20 days', now() - interval '20 days')
ON CONFLICT DO NOTHING;
SELECT id INTO v_psygnos_id FROM public.companies WHERE name = 'Psygnos';

INSERT INTO public.companies (name, industry, size, location, website, contact_email, description, employer_id, created_at, updated_at)
VALUES ('Konecta', 'BPO / Customer Experience', '1000+', 'Bogotá, Colombia', 'https://www.konecta.com.co', 'seleccion@konecta.com.co', 'Multilingual customer management and BPO leader.', 'seed-konecta', now() - interval '20 days', now() - interval '20 days')
ON CONFLICT DO NOTHING;
SELECT id INTO v_konecta_id FROM public.companies WHERE name = 'Konecta';

INSERT INTO public.companies (name, industry, size, location, website, contact_email, description, employer_id, created_at, updated_at)
VALUES ('Dentro', 'Marketing Technology', '201-500', 'Medellín, Colombia', 'https://www.dentro.app', 'careers@dentro.app', 'B2B marketing and sales platform.', 'seed-dentro', now() - interval '20 days', now() - interval '20 days')
ON CONFLICT DO NOTHING;
SELECT id INTO v_dentro_id FROM public.companies WHERE name = 'Dentro';

INSERT INTO public.companies (name, industry, size, location, website, contact_email, description, employer_id, created_at, updated_at)
VALUES ('Truelogic', 'Technology Services', '201-500', 'Remote · Colombia', 'https://www.truelogic.io', 'talent@truelogic.io', 'Staff-augmentation studio.', 'seed-truelogic', now() - interval '20 days', now() - interval '20 days')
ON CONFLICT DO NOTHING;
SELECT id INTO v_truelogic_id FROM public.companies WHERE name = 'Truelogic';

INSERT INTO public.companies (name, industry, size, location, website, contact_email, description, employer_id, created_at, updated_at)
VALUES ('Lean Solutions Group', 'BPO / Technology', '1000+', 'Medellín, Colombia', 'https://www.leansolutionsgroup.com', 'recruiting@leangroup.com', 'Nearshoring talent provider for US companies.', 'seed-lean', now() - interval '20 days', now() - interval '20 days')
ON CONFLICT DO NOTHING;
SELECT id INTO v_lean_id FROM public.companies WHERE name = 'Lean Solutions Group';

-- ── Jobs (skip if title+company_id already exists) ──
INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_bancolombia_id, 'Bilingual Full Stack Developer (React + Node)', 'Build and maintain digital banking products for our innovation hub.', 'Senior', 'Hybrid · Medellín', 9000000, 14000000, 'COP', 'React, Node.js, TypeScript, PostgreSQL, AWS', 'English C1, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_bancolombia_id AND title = 'Bilingual Full Stack Developer (React + Node)');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_bancolombia_id, 'Data Analyst — Financial Services', 'Analyze customer and operational data.', 'Mid-level', 'Hybrid · Medellín', 6000000, 9000000, 'COP', 'SQL, Python, Power BI, Excel', 'English B2, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_bancolombia_id AND title = 'Data Analyst — Financial Services');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_rappi_id, 'Senior Software Engineer — Delivery Platform', 'Design and scale services powering millions of deliveries.', 'Senior', 'Hybrid · Bogotá', 12000000, 18000000, 'COP', 'Go, Kubernetes, Kafka, Microservices, AWS', 'English B2+, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_rappi_id AND title = 'Senior Software Engineer — Delivery Platform');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_rappi_id, 'Product Manager — Fintech', 'Own the roadmap of RappiPay features.', 'Senior', 'Hybrid · Bogotá', 11000000, 17000000, 'COP', 'Product Strategy, Payments, Agile, SQL', 'English C1, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_rappi_id AND title = 'Product Manager — Fintech');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_rappi_id, 'Data Scientist — Logistics Optimization', 'Model delivery times and route optimization.', 'Senior', 'Hybrid · Bogotá', 12000000, 18000000, 'COP', 'Python, ML, Optimization, Spark, SQL', 'English B2+, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_rappi_id AND title = 'Data Scientist — Logistics Optimization');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_globant_id, 'QA Automation Engineer', 'Design and maintain automated test suites.', 'Mid-level', 'Hybrid · Bogotá', 6000000, 9500000, 'COP', 'Selenium, Playwright, Java, CI/CD, Jira', 'English B2+, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_globant_id AND title = 'QA Automation Engineer');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_globant_id, 'DevOps / Cloud Engineer', 'Build cloud infrastructure and delivery pipelines.', 'Senior', 'Remote', 10000000, 15000000, 'COP', 'AWS, Terraform, Docker, Kubernetes, Python', 'English C1, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_globant_id AND title = 'DevOps / Cloud Engineer');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_sophos_id, 'Java Backend Developer', 'Develop backend services for banking clients.', 'Mid-level', 'On-site · Bogotá', 5500000, 8500000, 'COP', 'Java, Spring Boot, Oracle, REST APIs', 'English B2, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_sophos_id AND title = 'Java Backend Developer');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_sophos_id, 'Business Analyst (Bilingual)', 'Bridge business and technology for banking projects.', 'Mid-level', 'On-site · Bogotá', 5000000, 7500000, 'COP', 'Requirements, SQL, UML, Agile, Documentation', 'English B2+, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_sophos_id AND title = 'Business Analyst (Bilingual)');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_habia_id, 'Bilingual Customer Service Representative (EN/ES)', 'Provide phone and chat support for US and UK brands.', 'Junior', 'On-site · Medellín', 2500000, 3800000, 'COP', 'Customer Service, CRM, Communication', 'English B2+, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_habia_id AND title = 'Bilingual Customer Service Representative (EN/ES)');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_habia_id, 'Bilingual Technical Support Analyst', 'Resolve technical issues for international clients.', 'Mid-level', 'On-site · Medellín', 3000000, 4500000, 'COP', 'Troubleshooting, Zendesk, Networking Basics', 'English C1, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_habia_id AND title = 'Bilingual Technical Support Analyst');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_endava_id, '.NET Developer', 'Deliver enterprise software for UK and European clients.', 'Senior', 'Hybrid · Medellín', 9000000, 13500000, 'COP', '.NET Core, C#, SQL Server, Azure, Microservices', 'English C1, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_endava_id AND title = '.NET Developer');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_endava_id, 'Project Manager — Digital Delivery', 'Lead cross-functional delivery squads for global clients.', 'Lead', 'Hybrid · Medellín', 11000000, 16000000, 'COP', 'Agile, Scrum, Stakeholder Management, Jira', 'English C1, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_endava_id AND title = 'Project Manager — Digital Delivery');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_truora_id, 'Frontend Engineer (React)', 'Build identity-verification UIs for fintechs.', 'Mid-level', 'Remote', 6500000, 10000000, 'COP', 'React, TypeScript, Next.js, Tailwind', 'English B2+, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_truora_id AND title = 'Frontend Engineer (React)');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_truora_id, 'Solutions Engineer', 'Help enterprise clients integrate verification APIs.', 'Mid-level', 'Hybrid · Cali', 6000000, 9000000, 'COP', 'API Integration, Node.js, Python, Customer Success', 'English B2+, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_truora_id AND title = 'Solutions Engineer');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_psygnos_id, 'Full Stack Developer (PHP + React)', 'Develop enterprise web applications.', 'Mid-level', 'On-site · Cali', 5000000, 7500000, 'COP', 'PHP, Laravel, React, MySQL', 'English B2, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_psygnos_id AND title = 'Full Stack Developer (PHP + React)');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_psygnos_id, 'IT Support Specialist (Bilingual)', 'Provide level-1/2 IT support for enterprise clients.', 'Junior', 'On-site · Cali', 2800000, 4000000, 'COP', 'Windows, Networking, Active Directory, Ticketing', 'English B2, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_psygnos_id AND title = 'IT Support Specialist (Bilingual)');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_konecta_id, 'Bilingual Sales Agent (EN/ES)', 'Drive inbound/outbound sales for international clients.', 'Junior', 'On-site · Bogotá', 2400000, 3600000, 'COP', 'Sales, Negotiation, CRM, Outbound Calling', 'English B2+, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_konecta_id AND title = 'Bilingual Sales Agent (EN/ES)');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_konecta_id, 'Team Lead — Customer Experience', 'Lead a team of 20+ bilingual agents.', 'Senior', 'On-site · Bogotá', 4200000, 6000000, 'COP', 'Leadership, Coaching, KPIs, Quality', 'English C1, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_konecta_id AND title = 'Team Lead — Customer Experience');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_dentro_id, 'Bilingual Sales Development Representative', 'Generate qualified meetings for our B2B platform.', 'Junior', 'On-site · Medellín', 3500000, 5000000, 'COP', 'Outbound Sales, LinkedIn, HubSpot', 'English C1, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_dentro_id AND title = 'Bilingual Sales Development Representative');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_dentro_id, 'Marketing Operations Specialist', 'Own marketing data pipelines and campaign operations.', 'Mid-level', 'Hybrid · Medellín', 5500000, 8000000, 'COP', 'HubSpot, Salesforce, Data Analysis, Marketing Automation', 'English C1, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_dentro_id AND title = 'Marketing Operations Specialist');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_truelogic_id, 'Senior React Native Engineer', 'Build mobile apps for US startups.', 'Senior', 'Remote', 10000000, 16000000, 'COP', 'React Native, TypeScript, Redux, Mobile CI/CD', 'English C1, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_truelogic_id AND title = 'Senior React Native Engineer');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_truelogic_id, 'Node.js Backend Engineer', 'Ship backend services for venture-backed US startups.', 'Senior', 'Remote', 9500000, 15000000, 'COP', 'Node.js, TypeScript, PostgreSQL, Redis, AWS', 'English C1, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_truelogic_id AND title = 'Node.js Backend Engineer');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_lean_id, 'Bilingual Accounting Analyst', 'Support US accounting teams with full-cycle bookkeeping.', 'Mid-level', 'Remote', 4500000, 7000000, 'COP', 'QuickBooks, US GAAP, Excel, AP/AR', 'English C1, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_lean_id AND title = 'Bilingual Accounting Analyst');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_lean_id, 'Frontend Developer (Angular)', 'Join a nearshore squad building enterprise web apps.', 'Mid-level', 'Remote', 6500000, 10000000, 'COP', 'Angular, TypeScript, RxJS, SCSS', 'English B2+, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_lean_id AND title = 'Frontend Developer (Angular)');

INSERT INTO public.jobs (company_id, title, description, level, location_type, salary_min, salary_max, currency, skills_required, languages_required, status, created_at, updated_at)
SELECT v_lean_id, 'Recruiter (Bilingual)', 'Recruit top technical talent for US companies.', 'Mid-level', 'Hybrid · Medellín', 4000000, 6000000, 'COP', 'Sourcing, Interviewing, ATS, Boolean Search', 'English C1, Spanish Native', 'open', now() - interval '5 days', now() - interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = v_lean_id AND title = 'Recruiter (Bilingual)');

-- ── Profiles (skip if email already exists) ──
INSERT INTO public.profiles (user_id, role, full_name, email, phone, location, bio, languages, avatar_url, cv_url, created_at, updated_at)
VALUES ('seed-maria', 'candidate', 'María Camila Rodríguez', 'sample.maria.rodriguez@example.co', '+57 300 111 2233', 'Medellín, Colombia', 'Full stack developer with 5 years building fintech products.', 'English C1, Spanish Native', '', '', now() - interval '15 days', now() - interval '2 days')
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (user_id, role, full_name, email, phone, location, bio, languages, avatar_url, cv_url, created_at, updated_at)
VALUES ('seed-andres', 'candidate', 'Andrés Felipe Gómez', 'sample.andres.gomez@example.co', '+57 310 222 3344', 'Bogotá, Colombia', 'Product manager and former engineer.', 'English C1, Spanish Native', '', '', now() - interval '15 days', now() - interval '2 days')
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (user_id, role, full_name, email, phone, location, bio, languages, avatar_url, cv_url, created_at, updated_at)
VALUES ('seed-laura', 'candidate', 'Laura Valentina Pérez', 'sample.laura.perez@example.co', '+57 320 333 4455', 'Cali, Colombia', 'Bilingual customer experience professional.', 'English B2+, Spanish Native', '', '', now() - interval '15 days', now() - interval '2 days')
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (user_id, role, full_name, email, phone, location, bio, languages, avatar_url, cv_url, created_at, updated_at)
VALUES ('seed-juan', 'candidate', 'Juan David Torres', 'sample.juan.torres@example.co', '+57 301 444 5566', 'Medellín, Colombia', 'DevOps engineer focused on AWS and Kubernetes.', 'English C1, Spanish Native', '', '', now() - interval '15 days', now() - interval '2 days')
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (user_id, role, full_name, email, phone, location, bio, languages, avatar_url, cv_url, created_at, updated_at)
VALUES ('seed-carolina', 'employer', 'Carolina Restrepo', 'sample.hr.bancolombia@example.co', '+57 604 555 6677', 'Medellín, Colombia', 'Talent acquisition lead at a major financial group.', 'Spanish Native, English C1', '', '', now() - interval '15 days', now() - interval '2 days')
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (user_id, role, full_name, email, phone, location, bio, languages, avatar_url, cv_url, created_at, updated_at)
VALUES ('seed-santiago', 'employer', 'Santiago Ospina', 'sample.ceo.truelogic@example.co', '+57 305 666 7788', 'Bogotá, Colombia', 'Founder of a nearshore software studio.', 'Spanish Native, English Native', '', '', now() - interval '15 days', now() - interval '2 days')
ON CONFLICT DO NOTHING;

END $$;
