import { useState, type FormEvent } from "react";
import { avatarSchema, profileSchema } from "../schemas/users.schema";
import { ApiError } from "../lib/api";
import { useUpdateAvatar, useUpdateProfile } from "../services/users/users.api";
import { useAuth } from "./useAuth";
import { useZodForm } from "./useZodForm";

/** Name and username save on submit; the avatar uploads as soon as a file is picked. */
export function useProfileForm() {
  const me = useAuth().user!; // RootLayout only renders with a user
  const update = useUpdateProfile();
  const uploadAvatar = useUpdateAvatar();
  const [saved, setSaved] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const form = useZodForm(profileSchema, async (values) => {
    setSaved(false);
    await update.mutateAsync(values);
    setSaved(true);
  });

  const onChange = (event: FormEvent<HTMLFormElement>) => {
    const field = event.target as HTMLInputElement;
    setSaved(false);
    if (field.name !== "avatar") return;
    const parsed = avatarSchema.safeParse(field.files?.[0]);
    if (!parsed.success) return setAvatarError(parsed.error.issues[0]!.message);
    setAvatarError(null);
    uploadAvatar.mutate(parsed.data, {
      onError: (err) => setAvatarError(err instanceof ApiError ? err.message : "Não foi possível enviar a imagem"),
    });
  };

  return {
    me,
    form: { ...form, onChange, loading: update.isPending },
    saved,
    avatarError,
    avatarUploading: uploadAvatar.isPending,
  };
}
