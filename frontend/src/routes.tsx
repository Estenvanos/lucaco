import { createBrowserRouter } from "react-router";
import { ROUTES } from "./constants/routes";
import { AuthLayout } from "./layouts/AuthLayout";
import { RootLayout, rootLoader } from "./layouts/RootLayout";
import { SignInPage } from "./pages/auth/SignInPage";
import { SignUpPage } from "./pages/auth/SignUpPage";
import { HomePage } from "./pages/home/HomePage";
import { ServerPage } from "./pages/servers/ServerPage";

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    loader: rootLoader,
    children: [
      { path: ROUTES.home, element: <HomePage /> },
      { path: ROUTES.serverPattern, element: <ServerPage /> },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: ROUTES.signIn, element: <SignInPage /> },
      { path: ROUTES.signUp, element: <SignUpPage /> },
    ],
  },
]);
