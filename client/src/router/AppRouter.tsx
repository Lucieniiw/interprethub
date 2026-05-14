import { lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "@/components/layout/Layout";
import { RequireAuth } from "@/router/RequireAuth";
import { RequireRole } from "@/router/RequireRole";
import { PortalHome } from "@/features/dashboard/ui/PortalHome";
import { RequireInterpreter } from "@/router/RequireInterpreter";
import { CoordinatorLoginPage } from "@/features/auth/ui/CoordinatorLoginPage";
import { LinguistLoginPage } from "@/features/auth/ui/LinguistLoginPage";
import { AcceptInvitePage } from "@/features/auth/ui/AcceptInvitePage";
import { LoginOutlet } from "@/features/auth/ui/LoginOutlet";
import { LoginPortalPage } from "@/features/auth/ui/LoginPortalPage";

const ActivityPage = lazy(() =>
  import("@/features/activity/ui/ActivityPage").then((m) => ({ default: m.ActivityPage })),
);
const AssignmentsPage = lazy(() =>
  import("@/features/assignments/ui/AssignmentsPage").then((m) => ({ default: m.AssignmentsPage })),
);
const AssignmentsReportPage = lazy(() =>
  import("@/features/assignments/ui/AssignmentsReportPage").then((m) => ({
    default: m.AssignmentsReportPage,
  })),
);
const AvailabilityPage = lazy(() =>
  import("@/features/availability/ui/AvailabilityPage").then((m) => ({ default: m.AvailabilityPage })),
);
const ClientsPage = lazy(() =>
  import("@/features/clients/ui/ClientsPage").then((m) => ({ default: m.ClientsPage })),
);
const DashboardPage = lazy(() =>
  import("@/features/dashboard/ui/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const OpenJobsPage = lazy(() =>
  import("@/features/open-jobs/ui/OpenJobsPage").then((m) => ({ default: m.OpenJobsPage })),
);
const MySchedulePage = lazy(() =>
  import("@/features/schedule/ui/MySchedulePage").then((m) => ({ default: m.MySchedulePage })),
);
const EarningsPage = lazy(() =>
  import("@/features/earnings/ui/EarningsPage").then((m) => ({ default: m.EarningsPage })),
);
const CreateJobPage = lazy(() =>
  import("@/features/jobs/ui/CreateJobPage").then((m) => ({ default: m.CreateJobPage })),
);
const JobDetailPage = lazy(() =>
  import("@/features/jobs/ui/JobDetailPage").then((m) => ({ default: m.JobDetailPage })),
);
const JobFormPage = lazy(() =>
  import("@/features/jobs/ui/JobFormPage").then((m) => ({ default: m.JobFormPage })),
);
const ProfilePage = lazy(() =>
  import("@/features/profile/ui/ProfilePage").then((m) => ({ default: m.ProfilePage })),
);
const ReportsPage = lazy(() =>
  import("@/features/reports/ui/ReportsPage").then((m) => ({ default: m.ReportsPage })),
);
const SettingsRoute = lazy(() =>
  import("@/features/settings/ui/SettingsRoute").then((m) => ({ default: m.SettingsRoute })),
);
const TeamPage = lazy(() =>
  import("@/features/team/ui/TeamPage").then((m) => ({ default: m.TeamPage })),
);

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginOutlet />,
    children: [
      { index: true, element: <LoginPortalPage /> },
      { path: "linguist", element: <LinguistLoginPage /> },
      { path: "coordinator", element: <CoordinatorLoginPage /> },
    ],
  },
  {
    path: "/accept-invite",
    element: <LoginOutlet />,
    children: [{ index: true, element: <AcceptInvitePage /> }],
  },
  {
    path: "/jobs/:id/form",
    element: (
      <RequireAuth>
        <JobFormPage />
      </RequireAuth>
    ),
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <PortalHome /> },
      {
        path: "dashboard",
        element: (
          <RequireRole roles={["ADMIN", "SUPER_ADMIN"]}>
            <DashboardPage />
          </RequireRole>
        ),
      },
      {
        path: "open-jobs",
        element: (
          <RequireInterpreter>
            <OpenJobsPage />
          </RequireInterpreter>
        ),
      },
      {
        path: "schedule",
        element: (
          <RequireInterpreter>
            <MySchedulePage />
          </RequireInterpreter>
        ),
      },
      { path: "assignments", element: <AssignmentsPage /> },
      { path: "assignments/report", element: <AssignmentsReportPage /> },
      { path: "earnings", element: <EarningsPage /> },
      { path: "availability", element: <AvailabilityPage /> },
      { path: "profile", element: <ProfilePage /> },
      {
        path: "jobs/new",
        element: (
          <RequireRole roles={["ADMIN", "SUPER_ADMIN"]}>
            <CreateJobPage />
          </RequireRole>
        ),
      },
      { path: "jobs/:id", element: <JobDetailPage /> },
      {
        path: "clients",
        element: (
          <RequireRole roles={["ADMIN", "SUPER_ADMIN"]}>
            <ClientsPage />
          </RequireRole>
        ),
      },
      {
        path: "linguists",
        element: (
          <RequireRole roles={["ADMIN", "SUPER_ADMIN"]}>
            <TeamPage />
          </RequireRole>
        ),
      },
      { path: "team", element: <Navigate to="/linguists" replace /> },
      {
        path: "activity",
        element: (
          <RequireRole roles={["ADMIN", "SUPER_ADMIN"]}>
            <ActivityPage />
          </RequireRole>
        ),
      },
      {
        path: "reports",
        element: (
          <RequireRole roles={["ADMIN", "SUPER_ADMIN"]}>
            <ReportsPage />
          </RequireRole>
        ),
      },
      { path: "settings", element: <SettingsRoute /> },
    ],
  },
]);
