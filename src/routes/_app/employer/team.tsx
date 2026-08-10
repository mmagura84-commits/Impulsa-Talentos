import { createFileRoute } from '@tanstack/react-router'
import { AuthGate } from '@/components/AuthGate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useCompany } from '@/hooks/useCompanies'
import { useI18n } from '@/i18n/I18nProvider'
import {
  useTeamMembers,
  useInviteTeamMember,
  useUpdateTeamMember,
  useRemoveTeamMember,
} from '@/hooks/useTeamMembers'
import type { TeamMemberRole } from '@/types'
import {
  Users, UserPlus, Shield, Trash2, Clock, CheckCircle2,
  XCircle, Loader2, Mail,
} from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/_app/employer/team')({ component: EmployerTeam })

const STATUS_ICONS: Record<string, React.ReactNode> = {
  active:  <CheckCircle2 className="size-3.5 text-emerald-500" />,
  pending: <Clock className="size-3.5 text-amber-500" />,
  declined: <XCircle className="size-3.5 text-destructive" />,
}

function EmployerTeam() {
  const { user } = useAuth()
  const { data: company, isLoading: companyLoading } = useCompany(user?.id)
  const { data: members, isLoading: membersLoading } = useTeamMembers(company?.id)
  const inviteMutation = useInviteTeamMember()
  const updateMutation = useUpdateTeamMember()
  const removeMutation = useRemoveTeamMember()
  const { t } = useI18n()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamMemberRole>('member')

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company?.id || !user?.id || !inviteEmail) return
    await inviteMutation.mutateAsync({
      companyId: company.id,
      inviteEmail,
      role: inviteRole,
      invitedBy: user.id,
    })
    setInviteEmail('')
  }

  const isLoading = companyLoading || membersLoading

  return (
    <AuthGate fallbackKey="auth.fallback.employerDashboard" fallbackDescKey="auth.fallback.employerDashboardDesc">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <h1 className="font-serif text-2xl font-bold flex items-center gap-2">
          <Users className="size-6 text-primary" />
          {t('team.title')}
        </h1>

        {isLoading ? (
          <div className="h-64 rounded bg-muted animate-pulse" />
        ) : !company ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {t('team.noCompany')}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Invite form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="size-4" />
                  {t('team.inviteTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-xs text-muted-foreground mb-1 block">
                      {t('team.emailLabel')}
                    </label>
                    <Input
                      type="email"
                      placeholder={t('team.emailPlaceholder')}
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="w-36">
                    <label className="text-xs text-muted-foreground mb-1 block">
                      {t('team.roleLabel')}
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as TeamMemberRole)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-10"
                    >
                      <option value="owner">{t('team.role.owner')}</option>
                      <option value="admin">{t('team.role.admin')}</option>
                      <option value="member">{t('team.role.member')}</option>
                    </select>
                  </div>
                  <Button type="submit" disabled={inviteMutation.isPending}>
                    {inviteMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Mail className="size-4 mr-1.5" />
                    )}
                    {t('team.sendInvite')}
                  </Button>
                </form>
                {inviteMutation.isError && (
                  <p className="text-xs text-destructive mt-2">
                    {(inviteMutation.error as Error)?.message || t('team.inviteFailed')}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Team list */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="size-4" />
                  {t('team.membersTitle')}
                  {members && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      ({members.length})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!members || members.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {t('team.emptyState')}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-left">
                          <th className="py-2 px-2">{t('team.emailLabel')}</th>
                          <th className="py-2 px-2">{t('team.roleLabel')}</th>
                          <th className="py-2 px-2">{t('team.statusLabel')}</th>
                          <th className="py-2 px-2 w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m) => (
                          <tr key={m.id} className="border-b border-border/60 hover:bg-muted/30 text-xs">
                            <td className="py-2.5 px-2 font-medium">
                              {m.inviteEmail || m.userId}
                              {m.status === 'pending' && (
                                <span className="text-[10px] text-amber-500 ml-1.5">
                                  ({t('team.pendingLabel')})
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-2">
                              <select
                                value={m.role}
                                onChange={(e) => {
                                  updateMutation.mutate({
                                    id: m.id,
                                    data: { role: e.target.value as TeamMemberRole },
                                  })
                                }}
                                disabled={m.role === 'owner' || updateMutation.isPending}
                                className="rounded border border-border bg-background px-1.5 py-0.5 text-xs disabled:opacity-50"
                              >
                                <option value="owner">{t('team.role.owner')}</option>
                                <option value="admin">{t('team.role.admin')}</option>
                                <option value="member">{t('team.role.member')}</option>
                              </select>
                            </td>
                            <td className="py-2.5 px-2">
                              <span className="inline-flex items-center gap-1">
                                {STATUS_ICONS[m.status] || m.status}
                                <span className="capitalize">
                                  {t(`team.status.${m.status}`)}
                                </span>
                              </span>
                            </td>
                            <td className="py-2.5 px-2">
                              {m.role !== 'owner' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm(t('team.removeConfirm'))) {
                                      removeMutation.mutate({ id: m.id, companyId: company.id })
                                    }
                                  }}
                                  disabled={removeMutation.isPending}
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AuthGate>
  )
}
