import { useQuery } from "@tanstack/react-query";
import { ENDPOINTS } from "../../constants/endpoints";
import { request } from "../../lib/api";
import type { PublicUser } from "../../types/users.types";
import { usersKeys } from "./users.keys";

export const fetchMe = () => request<PublicUser>(ENDPOINTS.users.me);

export const useMe = () => useQuery({ queryKey: usersKeys.me(), queryFn: fetchMe });
