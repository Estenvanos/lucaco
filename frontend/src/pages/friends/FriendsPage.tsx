import { AddFriendForm } from "../../components/friends/AddFriendForm";
import { ConversationsList } from "../../components/friends/ConversationsList";
import { FriendsTabs } from "../../components/friends/FriendsTabs";
import { InboxList } from "../../components/friends/InboxList";
import { SentRequestsList } from "../../components/friends/SentRequestsList";
import { useFriendsPage } from "../../hooks/useFriendsPage";

export function FriendsPage() {
  const page = useFriendsPage();

  return (
    <div className="discover">
      <FriendsTabs
        tab={page.tab}
        onChange={page.setTab}
        inboxCount={page.inbox.length}
        unreadCount={page.unread.size}
      />
      <section className="friends-body">
        {page.tab === "add" ? (
          <AddFriendForm form={page.add} onDiscover={page.openDiscover} />
        ) : page.tab === "conversations" ? (
          <ConversationsList conversations={page.conversations} unread={page.unread} onOpen={page.openConversation} />
        ) : page.tab === "sent" ? (
          <SentRequestsList requests={page.sent} busy={page.busy} onCancel={page.onDecline} />
        ) : (
          <InboxList
            notifications={page.inbox}
            busy={page.busy}
            onAccept={page.onAccept}
            onDecline={page.onDecline}
          />
        )}
      </section>
    </div>
  );
}
