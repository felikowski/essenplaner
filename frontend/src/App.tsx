import { BrowserRouter, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { CurrentWeekRedirect } from './pages/CurrentWeekRedirect'
import { NotFoundPage } from './pages/NotFoundPage'
import { RecipeDetailPage } from './pages/RecipeDetailPage'
import { RecipeListPage } from './pages/RecipeListPage'
import { WeekPage } from './pages/WeekPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CurrentWeekRedirect />} />
        <Route path="woche" element={<CurrentWeekRedirect />} />
        <Route path="woche/:week" element={<WeekPage />} />
        <Route path="rezepte" element={<RecipeListPage />} />
        <Route path="rezepte/:id" element={<RecipeDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
