import { Link } from "react-router";
import type { AuthFormFooterProps } from "../../types/ui.types";

export function AuthFormFooter({ question, to, action }: AuthFormFooterProps) {
  return (
    <p className="auth-footer">
      {question} <Link to={to}>{action}</Link>
    </p>
  );
}
