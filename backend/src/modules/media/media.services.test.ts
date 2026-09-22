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
const canView = mock();
const areFriends = mock();
const dmId = (a: string, b: string) => (a < b ? `dm:${a}:${b}` : `dm:${b}:${a}`);

jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma: { mediaFile } }));
jest.unstable_mockModule("../../lib/storage.js", () => ({ putObject, signedGetUrl }));
jest.unstable_mockModule("../channels/channels.services.js", () => ({ canSendVoice, canAttach, canView }));
jest.unstable_mockModule("../images/images.services.js", () => ({ toWebp }));
jest.unstable_mockModule("../friends/friends.services.js", () => ({ areFriends }));
jest.unstable_mockModule("../messages/messages.services.js", () => ({ dmId }));

const media = await import("./media.services.js");
const { mediaFileSchema } = await import("./media.schema.js");

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";
const CAROL = "33333333-3333-3333-3333-333333333333";
const CHANNEL = "44444444-4444-4444-4444-444444444444";
const file = { size: 4, buffer: Buffer.from("ciph"), mimetype: "application/octet-stream" };

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

  it("converts an image to webp and stores the converted bytes", async () => {
    const webp = Buffer.from("webp!");
    toWebp.mockResolvedValue(webp);

    const { id, mime, size } = await media.upload(ALICE, { peerId: BOB }, "image", { ...file, mimetype: "image/png" });

    expect(toWebp).toHaveBeenCalledWith(expect.anything(), "attachments");
    expect(putObject).toHaveBeenCalledWith(`media/${dmId(ALICE, BOB)}/${id}`, webp, "image/webp");
    expect(mediaFile.create).toHaveBeenCalledWith({ data: expect.objectContaining({ kind: "image", sizeBytes: 5 }) });
    expect({ mime, size }).toEqual({ mime: "image/webp", size: 5 });
  });
});

describe("mediaFileSchema", () => {
  const MB = 1024 * 1024;
  const size = (kind: "voice" | "image" | "file" | "video", bytes: number, mimetype = "image/png") =>
    mediaFileSchema(kind).safeParse({ size: bytes, buffer: Buffer.alloc(1), mimetype }).success;

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
