import { jest } from "@jest/globals";
import { HttpError } from "../../lib/http-error.js";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();

const channel = { findUnique: mock(), findMany: mock(), create: mock(), update: mock(), delete: mock() };
const requirePermission = mock();

jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma: { channel } }));
jest.unstable_mockModule("../servers/servers.services.js", () => ({ requirePermission }));

const channels = await import("./channels.services.js");

const SERVER_ID = "11111111-1111-1111-1111-111111111111";
const CHANNEL_ID = "22222222-2222-2222-2222-222222222222";
const USER_ID = "33333333-3333-3333-3333-333333333333";

const row = (over: Record<string, unknown> = {}) => ({
  id: CHANNEL_ID,
  serverId: SERVER_ID,
  type: "text",
  name: "geral",
  topic: null,
  position: 0,
  createdAt: new Date(),
  ...over,
});

beforeEach(() => {
  requirePermission.mockResolvedValue(0n);
});

describe("list", () => {
  it("needs VIEW_CHANNELS on the server", async () => {
    requirePermission.mockRejectedValue(new HttpError(403, "Missing permission: VIEW_CHANNELS"));

    await expect(channels.list(SERVER_ID, USER_ID)).rejects.toMatchObject({ status: 403 });
    expect(channel.findMany).not.toHaveBeenCalled();
  });

  it("orders by position then creation", async () => {
    channel.findMany.mockResolvedValue([row()]);

    await channels.list(SERVER_ID, USER_ID);

    expect(requirePermission).toHaveBeenCalledWith(SERVER_ID, USER_ID, "VIEW_CHANNELS");
    expect(channel.findMany).toHaveBeenCalledWith({
      where: { serverId: SERVER_ID },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  });
});

describe("create", () => {
  it("only lets someone who manages the server add a channel", async () => {
    requirePermission.mockRejectedValue(new HttpError(403, "Missing permission: MANAGE_SERVER"));

    await expect(
      channels.create(SERVER_ID, USER_ID, { name: "geral", type: "text" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(channel.create).not.toHaveBeenCalled();
  });

  it("stores the channel under the server", async () => {
    channel.create.mockResolvedValue(row());

    await channels.create(SERVER_ID, USER_ID, { name: "geral", type: "text", topic: "avisos" });

    expect(requirePermission).toHaveBeenCalledWith(SERVER_ID, USER_ID, "MANAGE_SERVER");
    expect(channel.create).toHaveBeenCalledWith({
      data: { serverId: SERVER_ID, name: "geral", type: "text", topic: "avisos", position: 0 },
    });
  });
});

describe("update", () => {
  it("404s for an unknown channel before checking permissions", async () => {
    channel.findUnique.mockResolvedValue(null);

    await expect(channels.update(CHANNEL_ID, USER_ID, { name: "novo" })).rejects.toMatchObject({
      status: 404,
    });
    expect(requirePermission).not.toHaveBeenCalled();
  });

  it("leaves untouched properties out of the update", async () => {
    channel.findUnique.mockResolvedValue(row());
    channel.update.mockResolvedValue(row({ name: "novo" }));

    await channels.update(CHANNEL_ID, USER_ID, { name: "novo" });

    expect(channel.update).toHaveBeenCalledWith({ where: { id: CHANNEL_ID }, data: { name: "novo" } });
  });

  it("clears the topic when it is sent as null", async () => {
    channel.findUnique.mockResolvedValue(row({ topic: "antigo" }));
    channel.update.mockResolvedValue(row());

    await channels.update(CHANNEL_ID, USER_ID, { topic: null });

    expect(channel.update).toHaveBeenCalledWith({ where: { id: CHANNEL_ID }, data: { topic: null } });
  });
});

describe("remove", () => {
  it("needs MANAGE_SERVER on the channel's own server", async () => {
    channel.findUnique.mockResolvedValue(row());
    requirePermission.mockRejectedValue(new HttpError(403, "Missing permission: MANAGE_SERVER"));

    await expect(channels.remove(CHANNEL_ID, USER_ID)).rejects.toMatchObject({ status: 403 });
    expect(channel.delete).not.toHaveBeenCalled();
  });
});

describe("canSend", () => {
  it("requires both VIEW_CHANNELS and SEND_MESSAGES", async () => {
    channel.findUnique.mockResolvedValue(row());

    await channels.canSend(CHANNEL_ID, USER_ID);

    expect(requirePermission.mock.calls.map((c) => c[2])).toEqual(["VIEW_CHANNELS", "SEND_MESSAGES"]);
  });

  it("refuses the voice channel: it carries no messages", async () => {
    channel.findUnique.mockResolvedValue(row({ type: "voice" }));

    await expect(channels.canSend(CHANNEL_ID, USER_ID)).rejects.toMatchObject({ status: 400 });
    expect(requirePermission).not.toHaveBeenCalledWith(SERVER_ID, USER_ID, "SEND_MESSAGES");
  });

  it("does not check SEND_MESSAGES when the user cannot even see the channel", async () => {
    channel.findUnique.mockResolvedValue(row());
    requirePermission.mockRejectedValue(new HttpError(403, "Missing permission: VIEW_CHANNELS"));

    await expect(channels.canSend(CHANNEL_ID, USER_ID)).rejects.toMatchObject({ status: 403 });
    expect(requirePermission).toHaveBeenCalledTimes(1);
  });
});
