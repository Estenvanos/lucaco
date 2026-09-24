import { HomeServers } from "../../components/home/HomeServers";
import { ConversationsList } from "../../components/shared/ConversationsList";
import { useHomePage } from "../../hooks/useHomePage";

export function HomePage() {
  const page = useHomePage();

  return (
    <div className="home">
      <h1>Olá, {page.me?.displayName ?? page.me?.username}</h1>

      <div className="home-columns">
        <section className="discover-section">
          <h2>Mensagens diretas</h2>
          <ConversationsList conversations={page.conversations} unread={page.unread} onOpen={page.openConversation} />
        </section>

        <section className="discover-section">
          <h2>Seus servers</h2>
          <HomeServers
            servers={page.servers}
            onOpen={page.openServer}
            onDiscover={page.openDiscover}
            onCreate={page.openNewServer}
          />
        </section>
      </div>
    </div>
  );
}
