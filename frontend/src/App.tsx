import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import UploadPage from "./pages/UploadPage";

// Konva is heavy (~400 kB) — load it only when the results page is needed
const ResultsPage = lazy(() => import("./pages/ResultsPage"));

function ResultsLoader() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-space">
          <p className="font-heading text-xs tracking-widest text-accent animate-pulse-soft">
            LOADING ANALYSIS…
          </p>
        </div>
      }
    >
      <ResultsPage />
    </Suspense>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <UploadPage /> },
  { path: "/results/:id", element: <ResultsLoader /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}