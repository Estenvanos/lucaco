import type { ImagePickerProps } from "../../types/ui.types";

/** A file input dressed as its own preview: click the box, pick an image, see it in place. */
export function ImagePicker({ label, name, previewUrl, shape, error }: ImagePickerProps) {
  return (
    <label className="image-picker" data-shape={shape}>
      <span className="image-picker-label">{label}</span>
      <span className="image-picker-box" style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}>
        {!previewUrl && <span>Escolher imagem</span>}
      </span>
      <input
        className="sr-only"
        type="file"
        name={name}
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        aria-invalid={Boolean(error)}
      />
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
