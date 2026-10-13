# A realistic bilingual Colombian CV for testing the parse-cv function end to end.
# Fictional person; contact details included on purpose so we can confirm the
# redaction step strips them before anything reaches Claude.
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

s = getSampleStyleSheet()
h = ParagraphStyle('h', parent=s['Heading2'], spaceBefore=10, spaceAfter=4, textColor='#1f3a8a')
body = ParagraphStyle('b', parent=s['BodyText'], fontSize=9.5, leading=13)

story = [
    Paragraph('<b><font size=16>Valentina Restrepo Gómez</font></b>', s['Title']),
    Paragraph('Customer Experience Team Lead · Medellín, Colombia', body),
    Paragraph('valentina.restrepo@example.com · +57 301 555 8842 · C.C. 1.017.882.441 · linkedin.com/in/valentina-restrepo-demo', body),
    Spacer(1, 8),
    Paragraph('Professional summary', h),
    Paragraph('Bilingual customer experience lead with 7 years in BPO and SaaS support, '
              'managing teams of up to 14 agents for US and Canadian clients. Looking for a '
              'remote Customer Success Manager role with a global team.', body),
    Paragraph('Experience', h),
    Paragraph('<b>Customer Experience Team Lead</b> — Globant Colombia, Medellín (Mar 2022 – present)<br/>'
              'Lead a 14-agent bilingual support team for a US fintech client. Cut average first '
              'response time from 6h to 48 min. Built QA scorecards in Salesforce Service Cloud and '
              'weekly reporting in Looker. Onboarded and coached 9 new agents.', body),
    Paragraph('<b>Senior Support Specialist</b> — Teleperformance, Medellín (Jan 2020 – Feb 2022)<br/>'
              'Handled tier-2 email, chat and voice support in English and Spanish for a SaaS client. '
              'Maintained 96% CSAT. Wrote the Spanish knowledge base (120+ articles) in Zendesk.', body),
    Paragraph('<b>Customer Service Representative</b> — Sutherland, Bogotá (Jun 2018 – Dec 2019)<br/>'
              'Inbound billing support for a US telecom account. Promoted after 11 months.', body),
    Paragraph('Education', h),
    Paragraph('<b>Profesional en Negocios Internacionales</b> — Universidad EAFIT, Medellín (2014 – 2018)', body),
    Paragraph('<b>Diplomado en Gestión de Servicio al Cliente</b> — Universidad Pontificia Bolivariana (2021)', body),
    Paragraph('Skills', h),
    Paragraph('Salesforce Service Cloud · Zendesk · Looker · Intercom · HubSpot · QA scorecards · '
              'team coaching · SLA management · escalation handling · Excel · SQL (basic) · Jira', body),
    Paragraph('Languages', h),
    Paragraph('Spanish — native · English — C1 (IELTS 7.5, 2023) · Portuguese — A2', body),
]
SimpleDocTemplate('sample-cv-valentina-restrepo.pdf', pagesize=LETTER,
                  topMargin=0.7*inch, bottomMargin=0.7*inch).build(story)
print('written')
