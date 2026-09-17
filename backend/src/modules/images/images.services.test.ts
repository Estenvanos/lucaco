import { jest } from "@jest/globals";
import sharp from "sharp";
import { IMAGE_PRESETS } from "./images.schema.js";

const putObject = jest.fn<(...args: unknown[]) => Promise<void>>();
const deleteObject = jest.fn<(key: string) => Promise<void>>();

jest.unstable_mockModule("../../lib/storage.js", () => ({ putObject, deleteObject }));

const images = await import("./images.services.js");

const OWNER = "11111111-1111-1111-1111-111111111111";

const png = async (width = 1024, height = 1024) =>
  sharp({ create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .png()
    .toBuffer();

const file = async (over: Record<string, unknown> = {}) => {
  const buffer = await png();
  return { mimetype: "image/png" as const, size: buffer.length, buffer, ...over };
};

beforeEach(() => {
  putObject.mockResolvedValue(undefined);
});

describe("toWebp", () => {
  it("resizes to the preset and converts to webp", async () => {
    const output = await images.toWebp(await file(), "avatars");
    const meta = await sharp(output).metadata();

    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(IMAGE_PRESETS.avatars.width);
    expect(meta.height).toBe(IMAGE_PRESETS.avatars.height);
  });

  it("uses the smaller server icon preset", async () => {
    const meta = await sharp(await images.toWebp(await file(), "servers")).metadata();

    expect(meta.width).toBe(IMAGE_PRESETS.servers.width);
    expect(meta.height).toBe(IMAGE_PRESETS.servers.height);
  });

  // EXIF can carry GPS coordinates; the output must not keep it.
  it("drops metadata such as EXIF", async () => {
    const withExif = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#123456" } })
      .withExif({ IFD0: { Copyright: "someone", Software: "camera" } })
      .jpeg()
      .toBuffer();

    const meta = await sharp(await images.toWebp({ mimetype: "image/jpeg", size: withExif.length, buffer: withExif }, "avatars")).metadata();

    expect(meta.exif).toBeUndefined();
  });

  it("turns an unreadable buffer into a 400 instead of crashing", async () => {
    await expect(
      images.toWebp({ mimetype: "image/png", size: 4, buffer: Buffer.from("nope") }, "avatars"),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("store", () => {
  it("writes images/<folder>/<ownerId>/<uuid>.webp and returns that key", async () => {
    const key = await images.store(await file(), "avatars", OWNER);

    expect(key).toMatch(
      new RegExp(`^images/avatars/${OWNER}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.webp$`),
    );
    expect(putObject).toHaveBeenCalledWith(key, expect.any(Buffer), "image/webp");
  });

  it("gives every upload its own key", async () => {
    const first = await images.store(await file(), "avatars", OWNER);
    const second = await images.store(await file(), "avatars", OWNER);

    expect(first).not.toBe(second);
  });
});
