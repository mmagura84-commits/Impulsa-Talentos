import{J as e,Z as t,y as n}from"./index-TwEpWIcO.js";var r={en:{subject:`We received your application — Impulsa Talentos`,preview:`Your application is now in the employer's queue.`,heading:`Application received!`,thanks:e=>`Thanks for applying to ${e}.`,body:`Your application is now in the employer's queue. They typically respond within 3–5 business days. You can track your application status in real time from your dashboard.`,receiptTitle:`Application receipt`,receiptId:`Confirmation ID`,job:`Job`,company:`Company`,status:`Status`,submittedOn:e=>`Submitted on ${e}`,resume:`Resume`,attached:`Attached`,notAttached:`Not attached`,coverNote:`Your message`,whatNext:`What happens next`,next1:`The employer reviews your resume and profile.`,next2:`If there's a fit, they'll reach out via email to schedule an interview.`,ctaDashboard:`View my applications`,ctaBrowse:`Browse more jobs`,signature:`The Impulsa Talentos team`,tagline:`Connecting bilingual talent with the world.`},es:{subject:`Recibimos tu postulación — Impulsa Talentos`,preview:`Tu postulación ya está en la cola del empleador.`,heading:`¡Postulación recibida!`,thanks:e=>`Gracias por postularte a ${e}.`,body:`Tu postulación ya está en la cola del empleador. Normalmente responden en 3–5 días hábiles. Puedes seguir el estado de tu postulación en tiempo real desde tu dashboard.`,receiptTitle:`Comprobante de postulación`,receiptId:`ID de confirmación`,job:`Vacante`,company:`Empresa`,status:`Estado`,submittedOn:e=>`Enviada el ${e}`,resume:`CV`,attached:`Adjunto`,notAttached:`No adjunto`,coverNote:`Tu mensaje`,whatNext:`Qué sigue ahora`,next1:`El empleador revisa tu CV y perfil.`,next2:`Si hay match, te contactarán por correo para agendar una entrevista.`,ctaDashboard:`Ver mis postulaciones`,ctaBrowse:`Ver más vacantes`,signature:`El equipo de Impulsa Talentos`,tagline:`Conectando talento bilingüe con el mundo.`}};function i(e,t,n){return`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Impulsa Talentos</title>
</head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${a(e)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:linear-gradient(135deg,#1f3a8a 0%,#3b82f6 100%);padding:24px 28px;">
            <span style="display:inline-block;font-family:'Lora',Georgia,serif;font-weight:700;font-size:22px;color:#ffffff;letter-spacing:-0.2px;">
              Impulsa <span style="color:#facc15;">Talentos</span>
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">${t}</td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:18px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.5;">
            <p style="margin:0 0 4px;font-weight:600;color:#0f172a;">${a(n.signature)}</p>
            <p style="margin:0;">${a(n.tagline)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`}function a(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#39;`)}function o(e){return e.replace(/"/g,`&quot;`).replace(/</g,`&lt;`)}function s(e,t){try{return new Date(e).toLocaleDateString(t===`es`?`es-CO`:`en-US`,{year:`numeric`,month:`long`,day:`numeric`})}catch{return e}}function c(e,t,n){return`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
  <tr>
    <td bgcolor="#1f3a8a" style="border-radius:8px;" align="center">
      <a href="${o(e)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;font-family:inherit;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;direction:ltr;">${a(t)}</a>
    </td>
  </tr>
</table>`}function l(e){let{locale:t,app:n,job:l,companyName:u,candidateName:d,candidateEmail:f,resumeUrl:p,coverNote:m,dashboardUrl:h,jobsUrl:g}=e,_=r[t],v=s(n.createdAt,t),y=`
    <h1 style="margin:0 0 12px;font-family:'Lora',Georgia,serif;font-size:24px;font-weight:700;color:#0f172a;line-height:1.3;">
      ${a(_.heading)}
    </h1>
    <p style="margin:0 0 16px;font-size:16px;color:#0f172a;">
      <strong>${a(d)},</strong> ${a(_.thanks(l.title))}
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
      ${a(_.body)}
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;">${a(_.receiptTitle)}</p>
        <p style="margin:0 0 12px;font-size:12px;color:#94a3b8;font-family:ui-monospace,monospace;">${a(_.receiptId)}: ${a(n.id)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#0f172a;">
          <tr><td style="padding:4px 0;color:#64748b;width:120px;">${a(_.job)}</td><td style="padding:4px 0;"><strong>${a(l.title)}</strong></td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">${a(_.company)}</td><td style="padding:4px 0;">${a(u)}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">${a(_.status)}</td><td style="padding:4px 0;">${a(_.submittedOn(v))}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">${a(_.resume)}</td><td style="padding:4px 0;">${p?`<a href="${o(p)}" style="color:#1f3a8a;text-decoration:underline;">${a(_.attached)}</a>`:a(_.notAttached)}</td></tr>
        </table>
      </td></tr>
    </table>

    ${m?`
    <p style="margin:0 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;">${a(_.coverNote)}</p>
    <blockquote style="margin:0 0 24px;padding:12px 16px;border-left:3px solid #3b82f6;background:#eff6ff;border-radius:0 8px 8px 0;font-size:14px;color:#0f172a;line-height:1.6;white-space:pre-line;">${a(m)}</blockquote>
    `:``}

    <p style="margin:24px 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;">${a(_.whatNext)}</p>
    <ol style="margin:0 0 8px;padding-left:20px;font-size:14px;color:#475569;line-height:1.7;">
      <li>${a(_.next1)}</li>
      <li>${a(_.next2)}</li>
    </ol>

    ${c(h,_.ctaDashboard,t)}
    <p style="margin:8px 0 0;font-size:13px;">
      <a href="${o(g)}" style="color:#1f3a8a;text-decoration:underline;">${a(_.ctaBrowse)}</a>
    </p>
  `,b=[`${_.heading}`,``,`${d}, ${_.thanks(l.title)}`,``,_.body,``,`--- ${_.receiptTitle} ---`,`${_.receiptId}: ${n.id}`,`${_.job}: ${l.title}`,`${_.company}: ${u}`,`${_.status}: ${_.submittedOn(v)}`,`${_.resume}: ${p??_.notAttached}`,``,m?`${_.coverNote}:\n${m}\n`:``,_.whatNext,`  1. ${_.next1}`,`  2. ${_.next2}`,``,`${_.ctaDashboard}: ${h}`,`${_.ctaBrowse}: ${g}`,``,_.signature,_.tagline].filter(Boolean).join(`
`);return{subject:_.subject,html:i(_.preview,y,_),text:b}}var u=`jobs@impulsatalentos.expert`;async function d(e){let t={candidate:{ok:!1}};try{let r=e.candidateProfile?.fullName?.trim()||`Candidate`,i=e.candidateProfile?.email?.trim()||void 0,a=e.candidateProfile?.notificationPrefs?.applicationUpdates===!1;if(i&&!a){let a={locale:e.locale,app:e.app,job:e.job,companyName:await m(e.job.companyId),candidateName:r,candidateEmail:i,resumeUrl:e.resumeUrl,coverNote:e.coverNote,dashboardUrl:e.dashboardUrl,jobsUrl:e.jobsUrl};try{await n({to:i,subject:l(a).subject,html:l(a).html,text:l(a).text}),t.candidate={ok:!0}}catch(e){t.candidate={ok:!1,error:e instanceof Error?e.message:String(e)},console.warn(`[notifyApplication] candidate email failed`,e)}}let o=await m(e.job.companyId),s=await p(e.job.id);n({to:u,subject:`[New Application] ${r} → ${e.job.title} at ${o}`,text:`${r} applied for "${e.job.title}" at ${o}. Total apps: ${s}.`,html:`<p><strong>${r}</strong> applied for <strong>${e.job.title}</strong> at ${o}.</p><p>Total: ${s}</p>`}).catch(e=>console.warn(`[notifyApplication] jobs@ notification failed`,e))}catch(e){console.warn(`[notifyApplication] unexpected error`,e)}return t}async function f(e){try{return await t(`companies`,e)??null}catch{return null}}async function p(t){try{return await e(`applications`,{jobId:t})}catch{return 1}}async function m(e){return(await f(e))?.name||`the company`}export{d as t};