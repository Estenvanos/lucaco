import { createBrowserRouter } from "react-router";
import { ROUTES } from "./constants/routes";
import { AuthLayout } from "./layouts/AuthLayout";
import { RootLayout } from "./layouts/RootLayout";
import { SignInPage } from "./pages/auth/SignInPage";
import { SignUpPage } from "./pages/auth/SignUpPage";
import { DiscoverPage } from "./pages/discover/DiscoverPage";
import { ConversationPage } from "./pages/friends/ConversationPage";
import { FriendsPage } from "./pages/friends/FriendsPage";
import { HomePage } from "./pages/home/HomePage";
import { NewServerPage } from "./pages/servers/NewServerPage";
import { ServerPage } from "./pages/servers/ServerPage";

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: ROUTES.home, element: <HomePage /> },
      { path: ROUTES.discover, element: <DiscoverPage /> },
      { path: ROUTES.friends, element: <FriendsPage /> },
      { path: ROUTES.newServer, element: <NewServerPage /> },
      { path: ROUTES.serverPattern, element: <ServerPage /> },
      { path: ROUTES.conversationPattern, element: <ConversationPage /> },
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
