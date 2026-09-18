import { useState, type ChangeEvent } from "react";
import { useFriends } from "../services/friends/friends.api";

/**
 * Filters the friend list already in cache: no request per key. Matches username or display
 * name anywhere, ignoring case and accents.
 */
export function useFriendSearch() {
  const [value, setValue] = useState("");
  const { data: friends = [], isFetching } = useFriends();
  const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const query = fold(value.trim());
  const results = friends
    .map((f) => f.user)
    .filter((u) => fold(u.username).includes(query) || fold(u.displayName ?? "").includes(query));

  return {
    value,
    results,
    isFetching,
    total: friends.length,
    onChange: (event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value),
  };
}
