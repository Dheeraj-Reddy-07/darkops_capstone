import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { queryClient } from "./lib/queryClient";

export const getRouter = () => {
  // Use the single shared QueryClient (the same instance main.tsx provides and
  // that login/logout/mutations clear + invalidate). A second `new QueryClient()`
  // here previously meant route components read a different cache than the one
  // being cleared on sign-in/out — so a prior account's identity bled into the
  // next login until a full page refresh.
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
