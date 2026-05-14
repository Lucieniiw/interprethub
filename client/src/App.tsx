import { Suspense } from "react";
import { RouterProvider } from "react-router";
import { AppProviders } from "@/providers/AppProviders";
import { router } from "@/router/AppRouter";
import { SessionSpinner } from "@/router/SessionSpinner";

export function App() {
  return (
    <AppProviders>
      <Suspense fallback={<SessionSpinner />}>
        <RouterProvider router={router} />
      </Suspense>
    </AppProviders>
  );
}
