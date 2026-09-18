import { jest } from "@jest/globals";
import { HttpError } from "../../lib/http-error.js";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();

const mediaFile = { create: mock(), findUnique: mock() };
const putObject = mock();
const signedGetUrl = mock();
const canSendVoice = mock();
const canView = mock();
const areFriends = mock();
const dmId = (a: string, b: string) => (a < b ? `dm:${a}:${b}` : `dm:${b}:${a}`);

jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma: { mediaFile } }));
jest.unstable_mockModule("../../lib/storage.js", () => ({ putObject, signedGetUrl }));
jest.unstable_mockModule("../channels/channels.services.js", () => ({ canSendVoice, canView }));
jest.unstable_mockModule("../friends/friends.services.js", () => ({ areFriends }));
jest.unstable_mockModule("../messages/messages.services.js", () => ({ dmId }));

const media = await import("./media.services.js");

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";
const CAROL = "33333333-3333-3333-3333-333333333333";
const CHANNEL = "44444444-4444-4444-4444-444444444444";
const file = { size: 4, buffer: Buffer.from("ciph") };

beforeEach(() => {
  jest.clearAllMocks();
  areFriends.mockResolvedValue(true);
  canSendVoice.mockResolvedValue({});
  canView.mockResolvedValue({});
  signedGetUrl.mockResolvedValue("https://signed");
});

describe("upload", () => {
  it("stores the ciphertext as-is under the DM conversation", async () => {
    const { id } = await media.upload(ALICE, { peerId: BOB }, file);

    const key = `media/${dmId(ALICE, BOB)}/${id}`;
    expect(putObject).toHaveBeenCalledWith(key, file.buffer, "application/octet-stream");
    expect(mediaFile.create).toHaveBeenCalledWith({
      data: { id, uploaderId: ALICE, scope: "dm", conversationId: dmId(ALICE, BOB), storageKey: key, sizeBytes: 4 },
    });
  });

  it("refuses a DM upload to someone who is not a friend", async () => {
    areFriends.mockResolvedValue(false);

    await expect(media.upload(ALICE, { peerId: BOB }, file)).rejects.toMatchObject({ status: 403 });
    expect(putObject).not.toHaveBeenCalled();
  });

  it("needs SEND_VOICE_MESSAGES to upload to a channel", async () => {
    canSendVoice.mockRejectedValue(new HttpError(403, "Missing permission: SEND_VOICE_MESSAGES"));

    await expect(media.upload(ALICE, { channelId: CHANNEL }, file)).rejects.toMatchObject({ status: 403 });
    expect(canSendVoice).toHaveBeenCalledWith(CHANNEL, ALICE);
    expect(putObject).not.toHaveBeenCalled();
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
