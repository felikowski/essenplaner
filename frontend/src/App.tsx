import { BrowserRouter, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { CurrentWeekRedirect } from './pages/CurrentWeekRedirect'
import { NotFoundPage } from './pages/NotFoundPage'
import { RecipeDetailPage } from './pages/RecipeDetailPage'
import { RecipeEditPage } from './pages/RecipeEditPage'
import { RecipeListPage } from './pages/RecipeListPage'
import { IngredientSearchPage } from './pages/IngredientSearchPage'
import { SettingsPage } from './pages/SettingsPage'
import { ShoppingPage } from './pages/ShoppingPage'
import { StaplesPage } from './pages/StaplesPage'
import { WeekPage } from './pages/WeekPage'
import { MenusPage } from './pages/MenusPage'
import { MenuDetailPage } from './pages/MenuDetailPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CurrentWeekRedirect />} />
        <Route path="woche" element={<CurrentWeekRedirect />} />
        <Route path="woche/:week" element={<WeekPage />} />
        <Route path="rezepte" element={<RecipeListPage />} />
        <Route path="rezepte/neu" element={<RecipeEditPage />} />
        <Route path="rezepte/zutaten" element={<IngredientSearchPage />} />
        <Route path="rezepte/:id" element={<RecipeDetailPage />} />
        <Route path="rezepte/:id/bearbeiten" element={<RecipeEditPage />} />
        <Route path="einkauf" element={<ShoppingPage />} />
        <Route path="einkauf/vorrat" element={<StaplesPage />} />
        <Route path="menues" element={<MenusPage />} />
        <Route path="menues/:id" element={<MenuDetailPage />} />
        <Route path="einstellungen" element={<SettingsPage />} />
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
