import { Navigate, Route, Routes, useLocation } from "react-router-dom"

import Osgfa from "@/layouts/Osgfa.jsx"
import CashierLayout from "@/layouts/CashierLayout.jsx"
import Batches from "@/pages/osgfa/batches.jsx"
import AddGrantees from "@/pages/osgfa/addGrantees.jsx"
import ArchivePage from "@/pages/osgfa/archive.jsx"
import ArchiveBatch from "@/pages/osgfa/archiveBatch.jsx"
import BatchInfo from "@/pages/osgfa/batchInfo.jsx"
import Dashboard from "@/pages/osgfa/dashboard.jsx"
import LoginPage from "@/pages/auth/login.jsx"
import ResetPasswordPage from "@/pages/auth/reset-password.jsx"
import LandingPage from "@/pages/landingpage.jsx"
import LandingPageBatch from "@/pages/osgfa/landingpageBatch.jsx"
import ViewAllBatch from "@/pages/viewAllBatch.jsx"
import NotificationPage from "@/pages/osgfa/notification.jsx"
import AnnouncementPage from "@/pages/osgfa/announcement.jsx"
import Setting from "@/pages/osgfa/setting.jsx"
import ProgramWorkspace from "@/pages/osgfa/programWorkspace.jsx"
import CashierArchive from "@/pages/cashier/archive.jsx"
import CashierArchiveBatch from "@/pages/cashier/archiveBatch.jsx"
import CashierClaimHistory from "@/pages/cashier/claimHistory.jsx"
import CashierBatchInfo from "@/pages/cashier/batchInfo.jsx"
import CashierBatches from "@/pages/cashier/batches.jsx"
import CashierDashboard from "@/pages/cashier/dashboard.jsx"
import CashierNotification from "@/pages/cashier/notification.jsx"
import CashierSetting from "@/pages/cashier/setting.jsx"

import { ProtectedRoute } from "@/components/protected-route"

function AdminToOsgfaRedirect() {
  const location = useLocation()
  const target = `${location.pathname.replace(/^\/admin/, "/osgfa")}${location.search}${location.hash}`
  return <Navigate to={target} replace />
}

function RegistrarToCashierRedirect() {
  const location = useLocation()
  const target = `${location.pathname.replace(/^\/registrar/, "/cashier")}${location.search}${location.hash}`
  return <Navigate to={target} replace />
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}

      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/landing-batch" element={<LandingPageBatch />} />
      <Route path="/view-all-batches" element={<ViewAllBatch />} />

      {/* Legacy /admin URLs → /osgfa */}
      <Route path="/admin/*" element={<AdminToOsgfaRedirect />} />

      {/* Legacy /registrar URLs → /cashier */}
      <Route path="/registrar/*" element={<RegistrarToCashierRedirect />} />

      {/* Protected OSGFA Routes (Only accessible by 'osgfa' role) */}
      <Route
        path="/osgfa"
        element = {
          <ProtectedRoute allowedRoles={["osgfa"]}>
            <Osgfa />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/osgfa/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="setting" element={<Setting />} />
        <Route path="batches" element={<Batches />} />
        <Route path="add-batch-grantee" element={<Navigate to="/osgfa/batches" replace />} />
        <Route path="batch-info" element={<BatchInfo />} />
        <Route path="archive-batch" element={<ArchiveBatch />} />
        <Route path="add-grantees" element={<AddGrantees />} />
        <Route path="add-scholar" element={<Navigate to="/osgfa/add-grantees" replace />} />
        <Route path="add-beneficiaries" element={<Navigate to="/osgfa/batches" replace />} />
        <Route path="tes" element={<Navigate to="/osgfa/programs/tes" replace />} />
        <Route path="tdp" element={<Navigate to="/osgfa/programs/tdp" replace />} />
        <Route path="programs/:programSlug" element={<ProgramWorkspace />} />
        <Route path="announcement" element={<AnnouncementPage />} />
        <Route path="archive" element={<ArchivePage />} />
        <Route path="notification" element={<NotificationPage />} />
      </Route>

      {/* Protected Cashier Routes (Only accessible by 'cashier' role) */}
      <Route
        path="/cashier"
        element={
          <ProtectedRoute allowedRoles={["cashier"]}>
            <CashierLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/cashier/dashboard" replace />} />
        <Route path="dashboard" element={<CashierDashboard />} />
        <Route path="batches" element={<CashierBatches />} />
        <Route path="batch-info" element={<CashierBatchInfo />} />
        <Route path="tes" element={<Navigate to="/cashier/batches" replace />} />
        <Route path="tdp" element={<Navigate to="/cashier/batches" replace />} />
        <Route path="archive" element={<CashierArchive />} />
        <Route path="archive-batch" element={<CashierArchiveBatch />} />
        <Route path="claim-history" element={<CashierClaimHistory />} />
        <Route path="setting" element={<CashierSetting />} />
        <Route path="notification" element={<CashierNotification />} />
      </Route>

      {/* Catch-all fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App