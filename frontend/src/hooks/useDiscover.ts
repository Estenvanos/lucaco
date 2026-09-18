import { useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ROUTES } from "../constants/routes";
import { SERVER_CATEGORIES } from "../constants/server-categories";
import { debounceSearch } from "../lib/utils";
import { useDiscoverServers, useJoinServer } from "../services/servers/servers.api";

const CATEGORY_PARAM = "categoria";

/**
 * The discovery page: category lives in the URL (?categoria=gaming) so it survives a reload and
 * can be shared; the search box is debounced like the sidebar search.
 */
export function useDiscover() {
  const [params, setParams] = useSearchParams();
  const raw = params.get(CATEGORY_PARAM);
  // An unknown value in the URL means "all", never a 400 from the API.
  const category = SERVER_CATEGORIES.find((c) => c.value === raw) ?? null;

  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [search] = useState(() => debounceSearch(setQuery));
  const { data: servers = [], isFetching, isError } = useDiscoverServers(query, category?.value ?? null);

  const join = useJoinServer();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);

  return {
    category,
    pickCategory: (value: string | null) => setParams(value ? { [CATEGORY_PARAM]: value } : {}),
    value,
    onSearch: (event: ChangeEvent<HTMLInputElement>) => {
      setValue(event.target.value);
      search(event.target.value);
    },
    servers,
    isFetching,
    isError,
    // Joining a server you are already in is a no-op on the API, so the card always joins first.
    openServer: (serverId: string) =>
      join.mutate({ reference: serverId }, { onSuccess: () => navigate(ROUTES.server(serverId)) }),
    joiningId: join.isPending ? join.variables.reference : null,
    joinError: join.error?.message ?? null,
    create: () => navigate(ROUTES.newServer),
    joining,
    openJoin: () => setJoining(true),
    closeJoin: () => setJoining(false),
    onJoined: (serverId: string) => {
      setJoining(false);
      navigate(ROUTES.server(serverId));
    },
  };
}
