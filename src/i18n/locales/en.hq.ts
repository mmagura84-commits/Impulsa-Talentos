/**
 * English dictionary — Headquarters (admin) dashboard.
 * Full visibility into platform metrics: users, jobs, applications, companies.
 */
import type { Dict } from '../types'

const enHq: Dict = {
  // ── Page meta ──────────────────────────────────────────────────────
  'hq.title': 'Headquarters',
  'hq.subtitle': 'Full visibility into every signal that drives the business.',
  'hq.lastUpdated': 'Last updated {time}',
  'hq.refresh': 'Refresh',
  'hq.noAccess.title': 'Restricted area',
  'hq.noAccess.desc': 'The Headquarters dashboard is only available to platform administrators.',
  'hq.noAccess.cta': 'Back to dashboard',

  // ── KPIs ───────────────────────────────────────────────────────────
  'hq.kpi.users': 'Total users',
  'hq.kpi.usersHint': 'Candidates + employers',
  'hq.kpi.companies': 'Companies',
  'hq.kpi.companiesHint': 'Registered employers',
  'hq.kpi.jobs': 'Jobs posted',
  'hq.kpi.jobsHint': 'Open, closed, and draft',
  'hq.kpi.jobsOpen': 'of which active',
  'hq.kpi.applications': 'Applications',
  'hq.kpi.applicationsHint': 'Across all jobs',
  'hq.kpi.hires': 'Hires',
  'hq.kpi.hiresHint': 'Closed-won placements',
  'hq.kpi.conversion': 'Apply → Hire',
  'hq.kpi.conversionHint': 'End-to-end funnel',
  'hq.kpi.timeToHire': 'Avg. time-to-hire',
  'hq.kpi.timeToHireHint': 'Apply → hired',
  'hq.kpi.gmv': 'GMV (posted salary)',
  'hq.kpi.gmvHint': 'Sum of salary ranges',

  // ── Section headers ────────────────────────────────────────────────
  'hq.sections.platformHealth': 'Platform health',
  'hq.sections.applications': 'Applications funnel',
  'hq.sections.users': 'User & company growth',
  'hq.sections.jobs': 'Job market',
  'hq.sections.recent': 'Latest activity',
  'hq.sections.directory': 'Full directory',

  // ── Chart labels ───────────────────────────────────────────────────
  'hq.chart.applicationsOverTime': 'Applications — last 30 days',
  'hq.chart.usersOverTime': 'Sign-ups — last 30 days',
  'hq.chart.applicationsByStatus': 'Applications by status',
  'hq.chart.jobsByStatus': 'Jobs by status',
  'hq.chart.usersByRole': 'Users by role',
  'hq.chart.jobsByLevel': 'Jobs by seniority',
  'hq.chart.jobsByLocationType': 'Jobs by location type',
  'hq.chart.topLanguages': 'Top required languages',
  'hq.chart.topSkills': 'Top required skills',
  'hq.chart.topCompaniesByApps': 'Top companies by applications',
  'hq.chart.topCompaniesByJobs': 'Top companies by jobs posted',

  // ── Funnel ─────────────────────────────────────────────────────────
  'hq.funnel.submitted': 'Submitted',
  'hq.funnel.reviewed': 'Reviewed',
  'hq.funnel.interview': 'Interview',
  'hq.funnel.offered': 'Offered',
  'hq.funnel.hired': 'Hired',
  'hq.funnel.rejected': 'Rejected',
  'hq.funnel.reviewRate': 'Review rate',
  'hq.funnel.interviewRate': 'Interview rate',
  'hq.funnel.offerRate': 'Offer rate',
  'hq.funnel.hireRate': 'Hire rate',

  // ── Tabs ───────────────────────────────────────────────────────────
  'hq.tab.overview': 'Overview',
  'hq.tab.applications': 'Applications',
  'hq.tab.jobs': 'Jobs',
  'hq.tab.companies': 'Companies',
  'hq.tab.users': 'Users',

  // ── Tables ─────────────────────────────────────────────────────────
  'hq.table.searchPlaceholder': 'Search…',
  'hq.table.empty': 'No records yet.',
  'hq.table.col.name': 'Name',
  'hq.table.col.email': 'Email',
  'hq.table.col.role': 'Role',
  'hq.table.col.location': 'Location',
  'hq.table.col.created': 'Joined',
  'hq.table.col.title': 'Title',
  'hq.table.col.company': 'Company',
  'hq.table.col.status': 'Status',
  'hq.table.col.applications': 'Applications',
  'hq.table.col.industry': 'Industry',
  'hq.table.col.size': 'Size',
  'hq.table.col.salary': 'Salary',
  'hq.table.col.candidate': 'Candidate',
  'hq.table.col.job': 'Job',
  'hq.table.col.submitted': 'Submitted',
  'hq.table.col.actions': 'Actions',
  'hq.table.col.languages': 'Languages',
  'hq.table.col.bio': 'Bio',
  'hq.table.col.skills': 'Skills',

  // ── Actions ────────────────────────────────────────────────────────
  'hq.action.view': 'Open',
  'hq.action.changeStatus': 'Change status',
  'hq.action.closeJob': 'Close job',
  'hq.action.reopenJob': 'Reopen job',
  'hq.action.delete': 'Delete',
  'hq.action.exportCsv': 'Export CSV',
  'hq.action.copyId': 'Copy ID',
  'hq.action.copied': 'Copied',

  // ── Empty / error ──────────────────────────────────────────────────
  'hq.loading': 'Loading platform metrics…',
  'hq.error.title': 'Could not load HQ data',
  'hq.error.desc': 'One or more data sources failed. Refresh to retry.',
  // ── Moderation tab ───────────────────────────────────────────────
  'hq.tab.moderation': 'Pending Review',
  'hq.moderation.pendingTitle': 'Pending review',
  'hq.moderation.pendingDesc': 'Jobs awaiting admin review are hidden from public listings.',
  'hq.moderation.empty': 'No jobs pending review',
  'hq.moderation.approve': 'Approve',
  'hq.moderation.reject': 'Reject',
  'hq.moderation.reasonPlaceholder': 'Reason for rejection (optional)',
  'hq.moderation.confirmReject': 'Confirm',
  'hq.moderation.approved': 'Job approved and published',
  'hq.moderation.rejected': 'Job rejected',
  'hq.moderation.reportsTitle': 'Recent reports',
  'hq.moderation.reportsDesc': 'Flagged by users. Reported jobs are held for review until you decide.',
  'hq.moderation.noReports': 'No reports yet',
  'hq.moderation.reasonScam': 'Scam or fraud',
  'hq.moderation.reasonInappropriate': 'Inappropriate content',
  'hq.moderation.reasonInaccurate': 'Inaccurate details',
  'hq.moderation.reasonOther': 'Other',
  'hq.moderation.rejectedTitle': 'Rejected jobs',
  'hq.moderation.noRejected': 'No rejected jobs',
  'hq.moderation.restore': 'Restore',
  'hq.moderation.restored': 'Job restored and published',
  'hq.moderation.by': 'by',
  'hq.moderation.posted': 'Posted {date}',
  'hq.moderation.reason': 'Reason: {reason}',
  'hq.moderation.reportedReason': 'Reported: {reason}',

}
export default enHq