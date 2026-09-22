import { jest } from "@jest/globals";
import { HttpError } from "../../lib/http-error.js";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();

const mediaFile = { create: mock(), findUnique: mock() };
const putObject = mock();
const signedGetUrl = mock();
const canSendVoice = mock();
const canAttach = mock();
const toWebp = mock();
const dimensions = mock();
const canView = mock();
const areFriends = mock();
const dmId = (a: string, b: string) => (a < b ? `dm:${a}:${b}` : `dm:${b}:${a}`);

jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma: { mediaFile } }));
jest.unstable_mockModule("../../lib/storage.js", () => ({ putObject, signedGetUrl }));
jest.unstable_mockModule("../channels/channels.services.js", () => ({ canSendVoice, canAttach, canView }));
jest.unstable_mockModule("../images/images.services.js", () => ({ toWebp, dimensions }));
jest.unstable_mockModule("../friends/friends.services.js", () => ({ areFriends }));
jest.unstable_mockModule("../messages/messages.services.js", () => ({ dmId }));

const media = await import("./media.services.js");
const { mediaFileSchema, isAllowedFormat } = await import("./media.schema.js");

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";
const CAROL = "33333333-3333-3333-3333-333333333333";
const CHANNEL = "44444444-4444-4444-4444-444444444444";
const file = { size: 4, buffer: Buffer.from("ciph"), mimetype: "application/octet-stream", originalname: "clip.mp4" };

beforeEach(() => {
  jest.clearAllMocks();
  areFriends.mockResolvedValue(true);
  canSendVoice.mockResolvedValue({});
  canAttach.mockResolvedValue({});
  canView.mockResolvedValue({});
  signedGetUrl.mockResolvedValue("https://signed");
});

describe("upload", () => {
  it("stores the ciphertext as-is under the DM conversation", async () => {
    const { id } = await media.upload(ALICE, { peerId: BOB }, "voice", file);

    const key = `media/${dmId(ALICE, BOB)}/${id}`;
    expect(putObject).toHaveBeenCalledWith(key, file.buffer, "application/octet-stream");
    expect(mediaFile.create).toHaveBeenCalledWith({
      data: {
        id,
        uploaderId: ALICE,
        scope: "dm",
        conversationId: dmId(ALICE, BOB),
        storageKey: key,
        kind: "voice",
        sizeBytes: 4,
      },
    });
  });

  it("refuses a DM upload to someone who is not a friend", async () => {
    areFriends.mockResolvedValue(false);

    await expect(media.upload(ALICE, { peerId: BOB }, "voice", file)).rejects.toMatchObject({ status: 403 });
    expect(putObject).not.toHaveBeenCalled();
  });

  it("needs SEND_VOICE_MESSAGES to upload to a channel", async () => {
    canSendVoice.mockRejectedValue(new HttpError(403, "Missing permission: SEND_VOICE_MESSAGES"));

    await expect(media.upload(ALICE, { channelId: CHANNEL }, "voice", file)).rejects.toMatchObject({ status: 403 });
    expect(canSendVoice).toHaveBeenCalledWith(CHANNEL, ALICE);
    expect(putObject).not.toHaveBeenCalled();
  });
});

describe("upload of files and images", () => {
  it("needs ATTACH_FILES, not SEND_VOICE_MESSAGES, for a file in a channel", async () => {
    canAttach.mockRejectedValue(new HttpError(403, "Missing permission: ATTACH_FILES"));

    await expect(media.upload(ALICE, { channelId: CHANNEL }, "file", file)).rejects.toMatchObject({ status: 403 });
    expect(canSendVoice).not.toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
  });

  it("keeps documents and videos as the ciphertext they arrived as", async () => {
    const { id, mime } = await media.upload(ALICE, { channelId: CHANNEL }, "video", file);

    expect(mime).toBe("application/octet-stream");
    expect(toWebp).not.toHaveBeenCalled();
    expect(putObject).toHaveBeenCalledWith(`media/${CHANNEL}/${id}`, file.buffer, "application/octet-stream");
  });

  it("stores an image as webp plus a small preview, and returns the preview's size", async () => {
    const webp = Buffer.from("webp!");
    const small = Buffer.from("tiny");
    toWebp.mockImplementation(async (_file: unknown, folder: string) => (folder === "attachments" ? webp : small));
    dimensions.mockResolvedValue({ width: 480, height: 270 });

    const result = await media.upload(ALICE, { peerId: BOB }, "image", { ...file, mimetype: "image/png" });

    const key = `media/${dmId(ALICE, BOB)}/${result.id}`;
    expect(putObject).toHaveBeenCalledWith(key, webp, "image/webp");
    expect(putObject).toHaveBeenCalledWith(`${key}.preview`, small, "image/webp");
    expect(dimensions).toHaveBeenCalledWith(small);
    expect(mediaFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "image", sizeBytes: 5, storageKey: key, previewKey: `${key}.preview` }),
    });
    expect(result).toEqual({ id: result.id, mime: "image/webp", size: 5, width: 480, height: 270 });
  });

  it("stores nothing when the image bytes are not a real image", async () => {
    toWebp.mockRejectedValue(new HttpError(400, "Invalid or unsupported image"));

    await expect(
      media.upload(ALICE, { peerId: BOB }, "image", { ...file, mimetype: "image/png" }),
    ).rejects.toMatchObject({ status: 400 });
    expect(putObject).not.toHaveBeenCalled();
    expect(mediaFile.create).not.toHaveBeenCalled();
  });
});

describe("mediaFileSchema", () => {
  const MB = 1024 * 1024;
  const size = (kind: "voice" | "image" | "file" | "video", bytes: number, mimetype = "image/png") => {
    const [name, mime] = kind === "file" ? ["a.pdf", "application/pdf"] : kind === "video" ? ["a.mp4", "video/mp4"] : ["a", ""];
    return mediaFileSchema(kind, mime).safeParse({ size: bytes, buffer: Buffer.alloc(1), mimetype, originalname: name }).success;
  };

  it("caps images at 15 MB, documents at 30 MB, videos at 100 MB and voice at 5 MB", () => {
    expect([size("image", 15 * MB), size("image", 15 * MB + 1)]).toEqual([true, false]);
    expect([size("file", 30 * MB), size("file", 30 * MB + 1)]).toEqual([true, false]);
    expect([size("video", 100 * MB), size("video", 100 * MB + 1)]).toEqual([true, false]);
    expect([size("voice", 5 * MB), size("voice", 5 * MB + 1)]).toEqual([true, false]);
  });

  it("only takes an image of a known type", () => {
    expect(size("image", 10, "image/svg+xml")).toBe(false);
    expect(size("image", 10, "application/pdf")).toBe(false);
  });
});

describe("document and video formats", () => {
  const accepts = (kind: "file" | "video", originalname: string, mime: string) =>
    mediaFileSchema(kind, mime).safeParse({ size: 1, buffer: Buffer.alloc(1), mimetype: "application/octet-stream", originalname }).success;

  it("takes listed documents and videos", () => {
    expect(accepts("file", "report.PDF", "application/pdf")).toBe(true);
    expect(accepts("video", "clip.mp4", "video/mp4")).toBe(true);
  });

  it("refuses executables and scripts, whatever type they claim", () => {
    expect(accepts("file", "setup.exe", "application/x-msdownload")).toBe(false);
    expect(accepts("file", "setup.exe", "application/pdf")).toBe(false);
    expect(accepts("file", "run.sh", "")).toBe(false);
    expect(accepts("file", "page.html", "text/html")).toBe(false);
  });

  it("refuses a listed extension hiding behind another one", () => {
    expect(accepts("file", "invoice.pdf.exe", "application/pdf")).toBe(false);
  });

  it("refuses a type that does not match the extension", () => {
    expect(accepts("file", "notes.pdf", "text/html")).toBe(false);
    expect(accepts("video", "clip.mkv", "video/x-matroska")).toBe(false);
    expect(accepts("video", "clip.mp4", "")).toBe(false);
  });

  it("lets a document the browser left untyped through on its extension", () => {
    expect(isAllowedFormat("file", "README.md", "")).toBe(true);
    expect(isAllowedFormat("file", "noextension", "")).toBe(false);
  });
});

describe("getUrl", () => {
  const dmFile = { id: "m", scope: "dm", uploaderId: ALICE, conversationId: dmId(ALICE, BOB), storageKey: "k" };

  it("404s an unknown file", async () => {
    mediaFile.findUnique.mockResolvedValue(null);

    await expect(media.getUrl("m", BOB)).rejects.toMatchObject({ status: 404 });
  });

  it("gives both sides of the DM a short-lived link", async () => {
    mediaFile.findUnique.mockResolvedValue(dmFile);

    await expect(media.getUrl("m", BOB)).resolves.toEqual({ url: "https://signed" });
    await expect(media.getUrl("m", ALICE)).resolves.toEqual({ url: "https://signed" });
    expect(signedGetUrl).toHaveBeenCalledWith("k", 300);
  });

  it("adds an hour-long preview link for an image", async () => {
    mediaFile.findUnique.mockResolvedValue({ ...dmFile, kind: "image", previewKey: "k.preview" });
    signedGetUrl.mockImplementation(async (key: string) => `https://signed/${key}`);

    await expect(media.getUrl("m", BOB)).resolves.toEqual({
      url: "https://signed/k",
      previewUrl: "https://signed/k.preview",
    });
    expect(signedGetUrl).toHaveBeenCalledWith("k.preview", 3600);
  });

  it("gives no preview link for an image sent before previews existed", async () => {
    mediaFile.findUnique.mockResolvedValue({ ...dmFile, kind: "image", previewKey: null });

    await expect(media.getUrl("m", BOB)).resolves.toEqual({ url: "https://signed" });
  });

  it("refuses anyone outside the DM", async () => {
    mediaFile.findUnique.mockResolvedValue(dmFile);

    await expect(media.getUrl("m", CAROL)).rejects.toMatchObject({ status: 403 });
    expect(signedGetUrl).not.toHaveBeenCalled();
  });

  it("refuses a channel file to someone who cannot view the channel", async () => {
    mediaFile.findUnique.mockResolvedValue({ ...dmFile, scope: "channel", conversationId: CHANNEL });
    canView.mockRejectedValue(new HttpError(403, "Missing permission: VIEW_CHANNELS"));

    await expect(media.getUrl("m", CAROL)).rejects.toMatchObject({ status: 403 });
    expect(signedGetUrl).not.toHaveBeenCalled();
  });
});
