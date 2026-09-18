import { useState, type ChangeEvent } from "react";
import { debounceSearch } from "../lib/utils";
import { useSearchServers } from "../services/servers/servers.api";

/** The search box: the input updates on every key, the API only once typing pauses. */
export function useServerSearch() {
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  // Created once: a new debounced function per render would forget the pending timer.
  const [search] = useState(() => debounceSearch(setQuery));
  const { data: results = [], isFetching } = useSearchServers(query);

  return {
    value,
    results,
    isFetching,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      setValue(event.target.value);
      search(event.target.value);
    },
  };
}
