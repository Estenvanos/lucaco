import { createContext } from "react";
import type { AuthContextValue } from "../types/auth.types";

/** `null` outside `AuthProvider`: `useAuth` throws instead of handing out a fake session. */
export const AuthContext = createContext<AuthContextValue | null>(null);
