import type { ChannelViewProps } from "../../types/ui.types";

export function ChannelView({ channel }: ChannelViewProps) {
  return (
    <section className="chat-main">
      <header className="chat-header">
        <h1>
          <span className="server-hash" aria-hidden>
            #
          </span>
          {channel.name}
        </h1>
        {channel.topic && <span className="chat-header-typing">{channel.topic}</span>}
      </header>
      <div className="chat-scroll">
        <div className="chat-messages">
          <div className="chat-start">
            <strong>Bem-vindo a #{channel.name}</strong>
            <p>Este é o começo do canal.</p>
          </div>
        </div>
      </div>
      {/* ponytail: channel messages need the group E2E key (keyEpoch) on top of the DM flow —
          the composer turns on when the messages module learns scope "channel". */}
      <div className="chat-composer">
        <div className="chat-composer-box">
          <textarea rows={1} placeholder={`Conversar em #${channel.name}`} aria-label="Mensagem" disabled />
        </div>
      </div>
    </section>
  );
}
