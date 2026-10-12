import { createFileRoute } from '@tanstack/react-router'
import { useI18n } from '@/i18n/I18nProvider'
import { LegalShell } from '@/components/LegalShell'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: 'Privacy Policy — Impulsa Talentos' },
      { name: 'description', content: 'Privacy Policy for Impulsa Talentos: how we collect, use, and protect personal data under Colombian law (Ley 1581 de 2012).' },
    ],
  }),
})

const CONTENT: Record<'en' | 'es', { title: string; updated: string; intro: string; sections: { title: string; body: string }[] }> = {
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: October 2026',
    intro: 'This Privacy Policy explains how Impulsa Talentos S.A.S. ("we", "us") collects, uses, stores, and protects your personal data when you use the Platform, in accordance with Colombian Law 1581 of 2012 and its regulatory decrees (Decreto 1377 de 2013).',
    sections: [
      { title: '1. Data Controller', body: 'The data controller is Impulsa Talentos S.A.S., with registered office in Medellín, Antioquia, Colombia. Contact: info@impulsatalentos.expert.' },
      { title: '2. Data We Collect', body: 'We collect: (a) account data (name, email, phone); (b) profile data (location, languages, bio, CV, salary expectations); (c) company and job data provided by employers; and (d) usage data (pages visited, applications submitted, saved jobs).' },
      { title: '3. Purpose of Processing', body: 'We process personal data to operate the marketplace: matching candidates with jobs, employers reviewing applications exclusively through their Impulsa Talentos dashboard, improving our matching technology, and complying with legal obligations.' },
      { title: '4. Legal Basis', body: 'Processing is based on your express and prior authorization, which you grant by creating an account and accepting this policy, and on the performance of the service you request.' },
      { title: '5. Sharing of Data', body: 'When you apply to a job, your profile and application are shared with the employer. Employer contact data (application inbox) is used exclusively to deliver candidate notifications. We do not sell personal data to third parties.' },
      { title: '6. Automated Matching and AI', body: 'We calculate a match score between each candidate profile and each job from the skills, languages, experience, salary and location you provide and from the text of your CV. The same score and its reasons are shown to you and, only if you apply, to that employer. It ranks applications; it never rejects anyone automatically, and a person always makes hiring decisions. When you upload a CV, we remove email addresses, phone and ID numbers and links, and then send the remaining text to Anthropic (Claude), which acts as our processor, to suggest skills, languages and experience for your profile. Nothing is added to your profile unless you choose to add it. Removing your CV removes these suggestions. You can ask us to review any score by writing to info@impulsatalentos.expert.' },
      { title: '7. Data Retention', body: 'We retain personal data for as long as your account is active and for the periods required by Colombian law, after which it is securely deleted or anonymized.' },
      { title: '8. Your Rights', body: 'Under Ley 1581 de 2012 you have the right to know, update, rectify, and delete your personal data, and to revoke authorization. To exercise these rights, write to info@impulsatalentos.expert with the subject "Habeas Data".' },
      { title: '9. Security', body: 'We apply technical and organizational measures appropriate to the sensitivity of the data, including encryption in transit and access controls. No method of transmission is 100% secure, but we work to protect your information.' },
      { title: '10. Cookies', body: 'We use essential cookies and local storage for authentication, language, and theme preferences. You can disable cookies in your browser, though some features may not work correctly.' },
      { title: '11. Changes to This Policy', body: 'We may update this policy. Material changes will be announced on the Platform. Continued use after changes take effect constitutes acceptance.' },
      { title: '12. Contact', body: 'For any privacy question or complaint, contact info@impulsatalentos.expert. You may also file a claim with the Superintendencia de Industria y Comercio (SIC), the Colombian data-protection authority.' },
    ],
  },
  es: {
    title: 'Politica de Privacidad',
    updated: 'Ultima actualizacion: octubre 2026',
    intro: 'Esta Politica de Privacidad explica como Impulsa Talentos S.A.S. ("nosotros") recopila, usa, almacena y protege tus datos personales cuando usas la Plataforma, de conformidad con la Ley 1581 de 2012 y sus decretos reglamentarios (Decreto 1377 de 2013).',
    sections: [
      { title: '1. Responsable del Tratamiento', body: 'El responsable del tratamiento es Impulsa Talentos S.A.S., con domicilio en Medellin, Antioquia, Colombia. Contacto: info@impulsatalentos.expert.' },
      { title: '2. Datos que Recopilamos', body: 'Recopilamos: (a) datos de cuenta (nombre, correo, telefono); (b) datos de perfil (ubicacion, idiomas, biografia, hoja de vida, expectativa salarial); (c) datos de empresa y vacantes proporcionados por empleadores; y (d) datos de uso (paginas visitadas, postulaciones, vacantes guardadas).' },
      { title: '3. Finalidad del Tratamiento', body: 'Tratamos los datos personales para operar el mercado: emparejar candidatos con vacantes, enviar notificaciones de postulacion a los empleadores (mediante el correo de bandeja de postulaciones que nos suministras), mejorar nuestra tecnologia de emparejamiento y cumplir obligaciones legales.' },
      { title: '4. Base Legal', body: 'El tratamiento se fundamenta en tu autorizacion previa y expresa, que otorgas al crear una cuenta y aceptar esta politica, y en la ejecucion del servicio que solicitas.' },
      { title: '5. Compartir Datos', body: 'Cuando te postulas a una vacante, tu perfil y postulacion se comparten con el empleador. Los datos de contacto del empleador (bandeja de postulaciones) se usan exclusivamente para notificar candidatos. No vendemos datos personales a terceros.' },
      { title: '6. Emparejamiento Automatizado e IA', body: 'Calculamos un puntaje de coincidencia entre cada perfil y cada vacante a partir de las habilidades, idiomas, experiencia, salario y ubicacion que nos das y del texto de tu hoja de vida. El mismo puntaje y sus razones se te muestran a ti y, solo si te postulas, a ese empleador. Sirve para ordenar postulaciones; nunca descarta a nadie de forma automatica y las decisiones de contratacion siempre las toma una persona. Cuando subes tu hoja de vida, quitamos correos, numeros de telefono y de identificacion y enlaces, y enviamos el texto restante a Anthropic (Claude), que actua como encargado del tratamiento, para sugerir habilidades, idiomas y experiencia para tu perfil. Nada se agrega a tu perfil sin que tu lo elijas. Si eliminas tu hoja de vida, se eliminan estas sugerencias. Puedes pedir que revisemos cualquier puntaje escribiendo a info@impulsatalentos.expert.' },
      { title: '7. Retencion de Datos', body: 'Conservamos los datos personales mientras tu cuenta este activa y por los periodos que exija la ley colombiana; luego se eliminan o anonimizan de forma segura.' },
      { title: '8. Tus Derechos', body: 'Conforme a la Ley 1581 de 2012 tienes derecho a conocer, actualizar, rectificar y suprimir tus datos, y a revocar la autorizacion. Para ejercerlos, escribe a info@impulsatalentos.expert con el asunto "Habeas Data".' },
      { title: '9. Seguridad', body: 'Aplicamos medidas tecnicas y organizativas adecuadas a la sensibilidad de los datos, incluido cifrado en transito y controles de acceso. Ningun metodo de transmision es 100% seguro, pero trabajamos para proteger tu informacion.' },
      { title: '10. Cookies', body: 'Usamos cookies esenciales y almacenamiento local para autenticacion, idioma y preferencias de tema. Puedes deshabilitar las cookies en tu navegador; algunas funciones podrian no funcionar correctamente.' },
      { title: '11. Cambios a Esta Politica', body: 'Podemos actualizar esta politica. Los cambios materiales se anunciaran en la Plataforma. El uso continuado tras su entrada en vigor constituye aceptacion.' },
      { title: '12. Contacto', body: 'Para dudas o reclamos de privacidad: info@impulsatalentos.expert. Tambien puedes presentar una queja ante la Superintendencia de Industria y Comercio (SIC).' },
    ],
  },
}

function PrivacyPage() {
  const { locale } = useI18n()
  const c = CONTENT[locale === 'en' ? 'en' : 'es']
  return <LegalShell title={c.title} updated={c.updated} intro={c.intro} sections={c.sections} />
}
