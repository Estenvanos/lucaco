import { useState, type FormEvent } from "react";
import { ApiError } from "../lib/api";
import { serverImageSchema, serverProfileSchema } from "../schemas/servers.schema";
import { useUpdateServer, useUpdateServerImage } from "../services/servers/servers.api";
import type { ServerImageKind } from "../types/servers.types";
import { useZodForm } from "./useZodForm";

/** Name, description and tag save on submit; icon and banner upload as soon as a file is picked. */
export function useServerProfileForm(serverId: string) {
  const update = useUpdateServer(serverId);
  const uploadImage = useUpdateServerImage();
  const [saved, setSaved] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const form = useZodForm(serverProfileSchema, async (values) => {
    setSaved(false);
    await update.mutateAsync(values);
    setSaved(true);
  });

  const onChange = (event: FormEvent<HTMLFormElement>) => {
    const field = event.target as HTMLInputElement;
    setSaved(false);
    if (field.name !== "icon" && field.name !== "banner") return;
    const parsed = serverImageSchema.safeParse(field.files?.[0]);
    if (!parsed.success) return setImageError(parsed.error.issues[0]!.message);
    setImageError(null);
    uploadImage.mutate(
      { serverId, kind: field.name as ServerImageKind, file: parsed.data },
      { onError: (err) => setImageError(err instanceof ApiError ? err.message : "Não foi possível enviar a imagem") },
    );
  };

  return {
    form: { ...form, onChange, loading: update.isPending },
    saved,
    imageError,
    uploading: uploadImage.isPending,
  };
}
