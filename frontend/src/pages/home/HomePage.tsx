import { useMe } from "../../services/users/users.api";

export function HomePage() {
  const { data: me } = useMe();

  return (
    <section className="card">
      <h2>Olá, {me?.displayName ?? me?.username}</h2>
      <p>Servers, DMs e o canal de voz entram aqui.</p>
    </section>
  );
}
