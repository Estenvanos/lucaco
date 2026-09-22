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

  it("shrinks a chat image to fit without cropping, and never enlarges a small one", async () => {
    const wide = await sharp({ create: { width: 4000, height: 1000, channels: 3, background: "#123456" } }).png().toBuffer();
    const small = await sharp({ create: { width: 100, height: 50, channels: 3, background: "#123456" } }).png().toBuffer();

    const big = await sharp(await images.toWebp({ buffer: wide }, "attachments")).metadata();
    const kept = await sharp(await images.toWebp({ buffer: small }, "attachments")).metadata();

    expect([big.width, big.height]).toEqual([IMAGE_PRESETS.attachments.width, 512]);
    expect([kept.width, kept.height]).toEqual([100, 50]);
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

  it("keeps a gif's animation in a chat image and its preview, but not in an avatar", async () => {
    // Three 64x32 frames of different colors (the gif encoder merges identical ones).
    const strip = Buffer.alloc(64 * 96 * 4);
    for (let i = 0; i < strip.length; i += 4) {
      strip[i] = Math.floor(i / 4 / 64 / 32) * 100;
      strip[i + 3] = 255;
    }
    const gif = await sharp(strip, { raw: { width: 64, height: 96, channels: 4, pageHeight: 32 } }).gif().toBuffer();
    const pages = async (folder: "attachments" | "attachmentPreviews" | "avatars") =>
      (await sharp(await images.toWebp({ buffer: gif }, folder)).metadata()).pages ?? 1;

    expect(await pages("attachments")).toBe(3);
    expect(await pages("attachmentPreviews")).toBe(3);
    expect(await pages("avatars")).toBe(1);
    expect(await images.dimensions(await images.toWebp({ buffer: gif }, "attachmentPreviews"))).toEqual({ width: 64, height: 32 });
  });

  it("goes by the real bytes, not the claimed type: an svg sent as png is refused", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');

    await expect(images.toWebp({ mimetype: "image/png", size: svg.length, buffer: svg }, "attachments")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("shrinks a chat preview to 480px", async () => {
    const big = await png(2000, 1000);
    const meta = await sharp(await images.toWebp({ buffer: big }, "attachmentPreviews")).metadata();

    expect([meta.width, meta.height]).toEqual([480, 240]);
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
