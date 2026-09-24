import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ROUTES } from "../constants/routes";
import { createServerSchema } from "../schemas/servers.schema";
import { useCreateServer, useUpdateServerImage } from "../services/servers/servers.api";
import type { DiscoveredServer, ServerDraft } from "../types/servers.types";
import { useZodForm } from "./useZodForm";

const EMPTY_DRAFT: ServerDraft = { name: "", description: "", iconUrl: null, bannerUrl: null };

/**
 * The create-server page. The form stays uncontrolled (useZodForm reads it on submit); `draft`
 * only mirrors what the live card preview needs, updated from the form's change events.
 */
export function useNewServer() {
  const navigate = useNavigate();
  const create = useCreateServer();
  const uploadImage = useUpdateServerImage();
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const form = useZodForm(createServerSchema, async ({ icon, banner, ...input }) => {
    const server = await create.mutateAsync(input);
    // ponytail: an upload failing after the create leaves the server without that image — re-upload
    // from server settings once that screen exists.
    if (icon) await uploadImage.mutateAsync({ serverId: server.id, kind: "icon", file: icon });
    if (banner) await uploadImage.mutateAsync({ serverId: server.id, kind: "banner", file: banner });
    navigate(ROUTES.server(server.id));
  });

  const onChange = (event: FormEvent<HTMLFormElement>) => {
    const field = event.target as HTMLInputElement;
    if (field.name === "name" || field.name === "description") {
      setDraft({ ...draft, [field.name]: field.value });
    } else if (field.name === "icon" || field.name === "banner") {
      const key = field.name === "icon" ? "iconUrl" : "bannerUrl";
      // The previous preview URL holds the old file in memory until revoked.
      if (draft[key]) URL.revokeObjectURL(draft[key]);
      const file = field.files?.[0];
      setDraft({ ...draft, [key]: file ? URL.createObjectURL(file) : null });
    }
  };

  const preview: DiscoveredServer = {
    id: "preview",
    ownerId: "",
    name: draft.name.trim() || "Nome do server",
    description: draft.description.trim() || null,
    category: "other",
    iconUrl: draft.iconUrl,
    bannerUrl: draft.bannerUrl,
    tag: null,
    visibility: "public",
    createdAt: "",
    memberCount: 1,
  };

  return {
    form: { ...form, onChange, loading: create.isPending || uploadImage.isPending },
    preview,
    cancel: () => navigate(-1),
  };
}
