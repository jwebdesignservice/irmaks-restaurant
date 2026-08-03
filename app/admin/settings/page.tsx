import { adminSettings, allServicePeriods, upcomingBlackouts } from '@/lib/admin-store'
import { todayInLondon } from '@/lib/time'
import AdminNav from '@/components/AdminNav'
import SettingsView from '@/components/admin/SettingsView'
import {
  addBlackoutAction,
  removeBlackoutAction,
  saveServicePeriod,
  saveSettings,
} from '../actions'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const today = todayInLondon()
  const [settings, periods, blackouts] = await Promise.all([
    adminSettings(),
    allServicePeriods(),
    upcomingBlackouts(today),
  ])

  return (
    <>
      <AdminNav current="settings" />
      <SettingsView
        settings={settings}
        periods={periods}
        blackouts={blackouts}
        today={today}
        onSaveSettings={saveSettings}
        onSaveServicePeriod={saveServicePeriod}
        onAddBlackout={addBlackoutAction}
        onRemoveBlackout={removeBlackoutAction}
      />
    </>
  )
}
