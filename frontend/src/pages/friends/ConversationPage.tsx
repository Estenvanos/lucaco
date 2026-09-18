import { useParams } from "react-router";
import { ChatView } from "../../components/chat/ChatView";

export function ConversationPage() {
  const { userId = "" } = useParams();
  // key: switching friends starts a fresh chat state instead of carrying the composer over.
  return <ChatView key={userId} peerId={userId} />;
}
