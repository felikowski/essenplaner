import { Navigate } from 'react-router'
import { currentWeek } from '../lib/isoWeek'

export function CurrentWeekRedirect() {
  return <Navigate to={`/woche/${currentWeek()}`} replace />
}
