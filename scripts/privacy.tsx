import { createFileRoute } from '@tanstack/react-router'
import { useI18n } from '@/i18n/I18nProvider'
import { LegalShell } from '@/routes/terms'
import type { Locale } from '@/i18n/types'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: 'Privacy Policy — Impulsa Talentos' },
      { name: 'description', content: 'Privacy Policy for Impulsa Talentos: how we collect, use, and protect personal data under Colombian law (Ley 1581 de 2012).' },
    ],
  }),
})

const CONTENT: Record<Locale, { title: string; updated: string; intro: string; sections: { title: string; body: string }[] }> = {
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: August 2026',
    intro: 'This Privacy Policy explains how Impulsa Talentos S.A.S. ("we", "us") collects, uses, stores, and protects your personal data when you use the Platform, in accordance with Colombian Law 1581 of 2012 and its regulatory decrees (Decreto 1377 de 2013).',
    sections: [
      { title: '1. Data Controller', body: 'The data controller is Impulsa Talentos S.A.S., with registered office in Medellín, Antioquia, Colombia. Contact: privacy@impulsatalentos.co.' },
      { title: '2. Data We Collect', body: 'We collect: (a) account data (name, email, phone); (b) profile data (location, languages, bio, CV, salary expectations); (c) company and job data provided by employers; and (d) usage data (pages visited, applications submitted, saved jobs).' },
      { title: '3. Purpose of Processing', body: 'We process personal data to operate the marketplace: matching candidates with jobs, sending application notifications to employers (via the application-inbox email you provide), improving our matching technology, and complying with legal obligations.' },
      { title: '4. Legal Basis', body: 'Processing is based on your express and prior authorization, which you grant by creating an account and accepting this policy, and on the performance of the service you request.' },
      { title: '5. Sharing of Data', body: 'When you apply to a job, your profile and application are shared with the employer. Employer contact data (application inbox) is used exclusively to deliver candidate notifications. We do not sell personal data to third parties.' },
      { title: '6. Data Retention', body: 'We retain personal data for as long as your account is active and for the periods required by Colombian law, after which it is securely deleted or anonymized.' },
      { title: '7. Your Rights', body: 'Under Ley 1581 de 2012 you have the right to know, update, rectify, and delete your personal data, and to revoke authorization. To exercise these rights, write to privacy@impulsatalentos.co with the subject "Habeas Data".' },
      { title: '8. Security', body: 'We apply technical and organizational measures appropriate to the sensitivity of the data, including encryption in transit and access controls. No method of transmission is 100% secure, but we work to protect your information.' },
      { title: '9. Cookies', body: 'We use essential cookies and local storage for authentication, language, and theme preferences. You can disable cookies in your browser, though some features may not work correctly.' },
      { title: '10. Changes to This Policy', body: 'We may update this policy. Material changes will be announced on the Platform. Continued use after changes take effect constitutes acceptance.' },
      { title: '11. Contact', body: 'For any privacy question or complaint, contact privacy@impulsatalentos.co. You may also file a claim with the Superintendencia de Industria y Comercio (SIC), the Colombian data-protection authority.' },
    ],
  },
  es: {
    title: 'Politica de Privacidad',
    updated: 'Ultima actualizacion: agosto 2026',
    intro: 'Esta Politica de Privacidad explica como Impulsa Talentos S.A.S. ("nosotros") recopila, usa, almacena y protege tus datos personales cuando usas la Plataforma, de conformidad con la Ley 1581 de 2012 y sus decretos reglamentarios (Decreto 1377 de 2013).',
    sections: [
      { title: '1. Responsable del Tratamiento', body: 'El responsable del tratamiento es Impulsa Talentos S.A.S., con domicilio en Medellin, Antioquia, Colombia. Contacto: privacy@impulsatalentos.co.' },
      { title: '2. Datos que Recopilamos', body: 'Recopilamos: (a) datos de cuenta (nombre, correo, telefono); (b) datos de perfil (ubicacion, idiomas, biografia, hoja de vida, expectativa salarial); (c) datos de empresa y vacantes proporcionados por empleadores; y (d) datos de uso (paginas visitadas, postulaciones, vacantes guardadas).' },
      { title: '3. Finalidad del Tratamiento', body: 'Tratamos los datos personales para operar el mercado: emparejar candidatos con vacantes, enviar notificaciones de postulacion a los empleadores (mediante el correo de bandeja de postulaciones que nos suministras), mejorar nuestra tecnologia de emparejamiento y cumplir obligaciones legales.' },
      { title: '4. Base Legal', body: 'El tratamiento se fundamenta en tu autorizacion previa y expresa, que otorgas al crear una cuenta y aceptar esta politica, y en la ejecucion del servicio que solicitas.' },
      { title: '5. Compartir Datos', body: 'Cuando te postulas a una vacante, tu perfil y postulacion se comparten con el empleador. Los datos de contacto del empleador (bandeja de postulaciones) se usan exclusivamente para notificar candidatos. No vendemos datos personales a terceros.' },
      { title: '6. Retencion de Datos', body: 'Conservamos los datos personales mientras tu cuenta este activa y por los periodos que exija la ley colombiana; luego se eliminan o anonimizan de forma segura.' },
      { title: '7. Tus Derechos', body: 'Conforme a la Ley 1581 de 2012 tienes derecho a conocer, actualizar, rectificar y suprimir tus datos, y a revocar la autorizacion. Para ejercerlos, escribe a privacy@impulsatalentos.co con el asunto "Habeas Data".' },
      { title: '8. Seguridad', body: 'Aplicamos medidas tecnicas y organizativas adecuadas a la sensibilidad de los datos, incluido cifrado en transito y controles de acceso. Ningun metodo de transmision es 100% seguro, pero trabajamos para proteger tu informacion.' },
      { title: '9. Cookies', body: 'Usamos cookies esenciales y almacenamiento local para autenticacion, idioma y preferencias de tema. Puedes deshabilitar las cookies en tu navegador; algunas funciones podrian no funcionar correctamente.' },
      { title: '10. Cambios a Esta Politica', body: 'Podemos actualizar esta politica. Los cambios materiales se anunciaran en la Plataforma. El uso continuado tras su entrada en vigor constituye aceptacion.' },
      { title: '11. Contacto', body: 'Para dudas o reclamos de privacidad: privacy@impulsatalentos.co. Tambien puedes presentar una queja ante la Superintendencia de Industria y Comercio (SIC).' },
    ],
  },
}

export default function PrivacyPage() {
  const { locale } = useI18n()
  const c = CONTENT[locale]
  return <LegalShell title={c.title} updated={c.updated} intro={c.intro} sections={c.sections} />
}
