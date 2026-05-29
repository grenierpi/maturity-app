import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import CampaignList     from './pages/CampaignList'
import CampaignNew      from './pages/CampaignNew'
import CampaignDetail   from './pages/CampaignDetail'
import Interview        from './pages/Interview'
import Synthesis        from './pages/Synthesis'
import PlanQualification from './pages/PlanQualification'
import PlanSelection    from './pages/PlanSelection'
import Roadmap          from './pages/Roadmap'
import Gantt            from './pages/Gantt'
import Sheets           from './pages/Sheets'
import TemplateList     from './pages/admin/TemplateList'
import TemplateEdit     from './pages/admin/TemplateEdit'
import FrameworkAdmin  from './pages/admin/FrameworkAdmin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/campaigns" replace />} />
          <Route path="campaigns"                            element={<CampaignList />} />
          <Route path="campaigns/new"                        element={<CampaignNew />} />
          <Route path="campaigns/:id"                        element={<CampaignDetail />} />
          <Route path="campaigns/:id/interview"              element={<Interview />} />
          <Route path="campaigns/:id/interview/:questionId"  element={<Interview />} />
          <Route path="campaigns/:id/synthesis"              element={<Synthesis />} />
          <Route path="campaigns/:id/plan-selection"         element={<PlanSelection />} />
          <Route path="campaigns/:id/plan"                   element={<PlanQualification />} />
          <Route path="campaigns/:id/roadmap"                element={<Roadmap />} />
          <Route path="campaigns/:id/gantt"                  element={<Gantt />} />
          <Route path="campaigns/:id/sheets"                 element={<Sheets />} />
          <Route path="admin/templates"                      element={<TemplateList />} />
          <Route path="admin/templates/:id"                  element={<TemplateEdit />} />
          <Route path="admin/framework"                          element={<FrameworkAdmin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
