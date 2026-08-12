import { createFileRoute, Link } from '@tanstack/react-router'
import { useI18n } from '@/i18n/I18nProvider'
import { LanguageToggle } from '@/components/LanguageToggle'
import { PublicHeader } from '@/components/PublicHeader'
import type { Locale } from '@/i18n/types'

export const Route = createFileRoute('/terms')({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: 'Terms of Service — Impulsa Talentos' },
      { name: 'description', content: 'Terms of Service for Impulsa Talentos, a bilingual job marketplace connecting Colombian talent with global employers.' },
    ],
  }),
})

interface Section { title: string; body: string }

const CONTENT: Record<'en' | 'es', { title: string; updated: string; intro: string; sections: Section[] }> = {
  en: {
    title: 'Terms of Service',
    updated: 'Last updated: August 2026',
    intro: 'These Terms of Service ("Terms") govern your use of the Impulsa Talentos platform ("the Platform"), operated by Impulsa Talentos S.A.S., a company organized under the laws of the Republic of Colombia. By creating an account, posting a job, or applying to a position, you agree to these Terms.',
    sections: [
      { title: '1. Service Description', body: 'Impulsa Talentos is a bilingual (English/Spanish) job marketplace that connects job seekers in Colombia with local and international employers. The Platform provides job listings, AI-assisted matching, application management, and employer dashboards.' },
      { title: '2. Eligibility', body: 'You must be at least 18 years old and legally able to enter into contracts under Colombian law (Código Civil, Ley 1564 de 2012) to use the Platform. Employers must be authorized to hire in Colombia or engage independent contractors in compliance with applicable labor law.' },
      { title: '3. Accounts and Accuracy', body: 'You are responsible for the accuracy of the information you provide, including your profile, company details, and job postings. You agree to keep your credentials confidential and to notify us immediately of unauthorized use of your account.' },
      { title: '4. Job Postings and Applications', body: 'Employers must post truthful job descriptions, including accurate salary ranges, location, and requirements. Job seekers apply voluntarily, and any employment relationship formed is between the candidate and the employer. Impulsa Talentos is a marketplace intermediary and is not a party to any employment contract.' },
      { title: '5. Prohibited Conduct', body: 'You may not use the Platform to post fraudulent, discriminatory, illegal, or misleading content; to harass users; to collect data without authorization; or to circumvent applicable labor and data-protection regulations.' },
      { title: '6. Fees and Payments', body: 'Job posting packages may be subject to fees. Fees are displayed before purchase and are non-refundable except as required by Colombian consumer law (Ley 1480 de 2011, Estatuto del Consumidor).' },
      { title: '7. Intellectual Property', body: 'The Platform, including its software, branding, and proprietary matching technology, is owned by Impulsa Talentos S.A.S. You retain ownership of the content you post, granting us a limited license to operate and display it on the Platform.' },
      { title: '8. Limitation of Liability', body: 'To the maximum extent permitted by law, Impulsa Talentos is not liable for indirect, incidental, or consequential damages arising from your use of the Platform, hiring outcomes, or reliance on listings. Nothing in these Terms limits rights granted by Colombian mandatory law.' },
      { title: '9. Governing Law and Jurisdiction', body: 'These Terms are governed by the laws of the Republic of Colombia. Any dispute arising out of or relating to these Terms shall be submitted to the courts of Medellín, Antioquia, Colombia, unless otherwise required by mandatory consumer protection provisions.' },
      { title: '10. Changes to These Terms', body: 'We may update these Terms from time to time. Material changes will be notified through the Platform. Continued use after changes take effect constitutes acceptance of the revised Terms.' },
      { title: '11. Contact', body: 'Questions about these Terms may be sent to legal@impulsatalentos.co. Impulsa Talentos S.A.S., Medellín, Colombia.' },
    ],
  },
  es: {
    title: 'Terminos de Servicio',
    updated: 'Ultima actualizacion: agosto 2026',
    intro: 'Estos Terminos de Servicio ("Terminos") regulan el uso de la plataforma Impulsa Talentos ("la Plataforma"), operada por Impulsa Talentos S.A.S., una sociedad organizada bajo las leyes de la Republica de Colombia. Al crear una cuenta, publicar una vacante o postularte a un cargo, aceptas estos Terminos.',
    sections: [
      { title: '1. Descripcion del Servicio', body: 'Impulsa Talentos es un mercado laboral bilingue (ingles/español) que conecta a buscadores de empleo en Colombia con empleadores locales e internacionales. La Plataforma ofrece vacantes, emparejamiento asistido por IA, gestion de postulaciones y paneles para empleadores.' },
      { title: '2. Elegibilidad', body: 'Debes tener al menos 18 años y estar legalmente habilitado para contratar conforme a la ley colombiana (Codigo Civil, Ley 1564 de 2012). Los empleadores deben estar autorizados para contratar en Colombia o vincular contratistas independientes de conformidad con la normativa laboral aplicable.' },
      { title: '3. Cuentas y Exactitud', body: 'Eres responsable de la exactitud de la informacion que proporcionas, incluidos tu perfil, los datos de la empresa y las vacantes. Te comprometes a mantener confidenciales tus credenciales y a notificarnos inmediatamente cualquier uso no autorizado.' },
      { title: '4. Vacantes y Postulaciones', body: 'Los empleadores deben publicar descripciones veraces, con rangos salariales, ubicacion y requisitos precisos. Los candidatos se postulan voluntariamente; la relacion laboral que se forme es entre el candidato y el empleador. Impulsa Talentos es un intermediario del mercado y no es parte de ningun contrato laboral.' },
      { title: '5. Conducta Prohibida', body: 'No podras usar la Plataforma para publicar contenido fraudulento, discriminatorio, ilegal o enganoso; acosar usuarios; recolectar datos sin autorizacion; o evadir las normas laborales y de proteccion de datos aplicables.' },
      { title: '6. Tarifas y Pagos', body: 'Los paquetes de publicacion de vacantes pueden tener tarifas, que se muestran antes de la compra. No son reembolsables salvo lo dispuesto por la Ley 1480 de 2011 (Estatuto del Consumidor).' },
      { title: '7. Propiedad Intelectual', body: 'La Plataforma, incluidos su software, marca y tecnologia de emparejamiento, pertenecen a Impulsa Talentos S.A.S. Conservas la titularidad del contenido que publicas y nos otorgas una licencia limitada para operarlo y mostrarlo.' },
      { title: '8. Limitacion de Responsabilidad', body: 'En la maxima medida permitida por la ley, Impulsa Talentos no sera responsable por danos indirectos, incidentales o consecuentes derivados del uso de la Plataforma, de resultados de contratacion o de la confianza en las publicaciones. Nada en estos Terminos limita derechos conferidos por normas colombianas de orden publico.' },
      { title: '9. Ley Aplicable y Jurisdiccion', body: 'Estos Terminos se rigen por las leyes de la Republica de Colombia. Toda controversia se sometera a los juzgados de Medellin, Antioquia, Colombia, salvo disposicion imperativa en materia de proteccion al consumidor.' },
      { title: '10. Cambios a Estos Terminos', body: 'Podemos actualizar estos Terminos periodicamente. Los cambios materiales se notificaran a traves de la Plataforma. El uso continuado tras la entrada en vigor constituye aceptacion.' },
      { title: '11. Contacto', body: 'Dudas sobre estos Terminos: legal@impulsatalentos.co. Impulsa Talentos S.A.S., Medellin, Colombia.' },
    ],
  },
}

export default function TermsPage() {
  const { locale } = useI18n()
  const c = CONTENT[locale === 'en' ? 'en' : 'es']
  return <LegalShell updated={c.updated} title={c.title} intro={c.intro} sections={c.sections} />
}

export function LegalShell({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: Section[] }) {
  return (
    <><PublicHeader transparentOnTop={false} /><div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border sticky top-0 bg-background/90 backdrop-blur z-10">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/" className="font-serif font-bold text-lg">Impulsa Talentos</Link>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="font-serif text-3xl font-bold mb-1">{title}</h1>
        <p className="text-xs text-muted-foreground mb-6">{updated}</p>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">{intro}</p>
        <div className="space-y-6">
          {sections.map(s => (
            <section key={s.title}>
              <h2 className="font-semibold text-base mb-1.5">{s.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>
      </main>
      <footer className="border-t border-border py-6 px-5 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Impulsa Talentos. Medellín, Colombia.
        </p>
      </footer>
    </div></>
  )
}
