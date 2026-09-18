import { jest } from "@jest/globals";
import { ALL_PERMISSIONS, DEFAULT_PERMISSIONS, PERMISSIONS } from "../../lib/constants.js";
import { HttpError } from "../../lib/http-error.js";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();

const channel = { findUnique: mock(), findMany: mock(), create: mock(), update: mock(), delete: mock() };
const channelRolePermission = {
  findMany: mock(), findUnique: mock(), createMany: mock(), upsert: mock(), deleteMany: mock(),
};
const channelMemberPermission = {
  findMany: mock(), findUnique: mock(), createMany: mock(), upsert: mock(), deleteMany: mock(),
};
const tx = { channel, channelRolePermission, channelMemberPermission };
const prisma = { ...tx, $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)) };

const memberPermissions = mock();
const allMemberPermissions = mock();
const requirePermission = mock();
const requireMembers = mock();
const requireRoles = mock();

jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma }));
jest.unstable_mockModule("../servers/servers.services.js", () => ({
  memberPermissions,
  allMemberPermissions,
  requirePermission,
  requireMembers,
  has: (p: bigint, n: keyof typeof PERMISSIONS) =>
    (p & (PERMISSIONS.ADMINISTRATOR | PERMISSIONS[n])) !== 0n,
}));
jest.unstable_mockModule("../roles/roles.services.js", () => ({ requireRoles }));

const channels = await import("./channels.services.js");

const SERVER_ID = "11111111-1111-1111-1111-111111111111";
const CHANNEL_ID = "22222222-2222-2222-2222-222222222222";
const USER_ID = "33333333-3333-3333-3333-333333333333";
const EVERYONE = "everyone-role";
const MOD = "mod-role";
const MEMBER = "member-1";

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

const ctx = (over: Record<string, unknown> = {}) => ({
  permissions: DEFAULT_PERMISSIONS,
  memberId: MEMBER,
  roleIds: [] as string[],
  everyoneRoleId: EVERYONE,
  ...over,
});

const hideFromEveryone = { channelId: CHANNEL_ID, roleId: EVERYONE, allow: 0n, deny: PERMISSIONS.VIEW_CHANNELS };

beforeEach(() => {
  jest.clearAllMocks();
  memberPermissions.mockResolvedValue(ctx());
  requirePermission.mockResolvedValue(DEFAULT_PERMISSIONS);
  requireRoles.mockResolvedValue(undefined);
  requireMembers.mockResolvedValue(undefined);
  channelRolePermission.findMany.mockResolvedValue([]);
  channelMemberPermission.findMany.mockResolvedValue([]);
  channel.findUnique.mockResolvedValue(row());
});

describe("resolve", () => {
  const { VIEW_CHANNELS, SEND_MESSAGES, ADMINISTRATOR } = PERMISSIONS;

  it("hides a channel when @everyone is denied VIEW_CHANNELS", () => {
    const perms = channels.resolve(DEFAULT_PERMISSIONS, { everyone: { allow: 0n, deny: VIEW_CHANNELS } });
    expect(perms & VIEW_CHANNELS).toBe(0n);
  });

  it("lets a role allow reopen what @everyone denies", () => {
    const perms = channels.resolve(DEFAULT_PERMISSIONS, {
      everyone: { allow: 0n, deny: VIEW_CHANNELS },
      roles: [{ allow: VIEW_CHANNELS, deny: 0n }],
    });
    expect(perms & VIEW_CHANNELS).toBe(VIEW_CHANNELS);
  });

  it("applies the member overwrite last, over any role", () => {
    const perms = channels.resolve(DEFAULT_PERMISSIONS, {
      roles: [{ allow: SEND_MESSAGES, deny: 0n }],
      member: { allow: 0n, deny: SEND_MESSAGES },
    });
    expect(perms & SEND_MESSAGES).toBe(0n);
  });

  it("lets administrators ignore every overwrite", () => {
    const perms = channels.resolve(ADMINISTRATOR, {
      everyone: { allow: 0n, deny: ALL_PERMISSIONS },
      member: { allow: 0n, deny: ALL_PERMISSIONS },
    });
    expect(perms).toBe(ALL_PERMISSIONS);
  });
});

describe("list", () => {
  it("needs membership in the server", async () => {
    memberPermissions.mockRejectedValue(new HttpError(403, "Not a member of this server"));

    await expect(channels.list(SERVER_ID, USER_ID)).rejects.toMatchObject({ status: 403 });
    expect(channel.findMany).not.toHaveBeenCalled();
  });

  it("leaves private channels out and says what the caller may do in the rest", async () => {
    channel.findMany.mockResolvedValue([row(), row({ id: "private", name: "admins" })]);
    channelRolePermission.findMany.mockResolvedValue([{ ...hideFromEveryone, channelId: "private" }]);

    const result = await channels.list(SERVER_ID, USER_ID);

    expect(result.map((c) => c.id)).toEqual([CHANNEL_ID]);
    expect(result[0]!.permissions).toContain("SEND_MESSAGES");
    expect(result[0]!.permissions).not.toContain("MANAGE_CHANNELS");
  });

  it("shows private channels to administrators", async () => {
    memberPermissions.mockResolvedValue(ctx({ permissions: PERMISSIONS.ADMINISTRATOR }));
    channel.findMany.mockResolvedValue([row({ id: "private" })]);
    channelRolePermission.findMany.mockResolvedValue([{ ...hideFromEveryone, channelId: "private" }]);

    await expect(channels.list(SERVER_ID, USER_ID)).resolves.toHaveLength(1);
  });
});

describe("create", () => {
  const input = { name: "geral", type: "text" as const, permissions: { roles: [], members: [] } };

  it("needs MANAGE_CHANNELS on the server", async () => {
    requirePermission.mockRejectedValue(new HttpError(403, "Missing permission: MANAGE_CHANNELS"));

    await expect(channels.create(SERVER_ID, USER_ID, input)).rejects.toMatchObject({ status: 403 });
    expect(channel.create).not.toHaveBeenCalled();
  });

  it("stores a private channel and its overwrites in one transaction", async () => {
    requirePermission.mockResolvedValue(PERMISSIONS.ADMINISTRATOR);
    channel.create.mockResolvedValue(row());

    await channels.create(SERVER_ID, USER_ID, {
      ...input,
      topic: "avisos",
      permissions: { roles: [{ roleId: EVERYONE, allow: [], deny: ["VIEW_CHANNELS"] }], members: [] },
    });

    expect(requirePermission).toHaveBeenCalledWith(SERVER_ID, USER_ID, "MANAGE_CHANNELS");
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(channel.create).toHaveBeenCalledWith({
      data: { serverId: SERVER_ID, name: "geral", type: "text", topic: "avisos", position: 0 },
    });
    expect(channelRolePermission.createMany).toHaveBeenCalledWith({
      data: [{ channelId: CHANNEL_ID, roleId: EVERYONE, allow: 0n, deny: PERMISSIONS.VIEW_CHANNELS }],
    });
  });

  it("refuses overwrites with bits the creator does not hold", async () => {
    requirePermission.mockResolvedValue(PERMISSIONS.MANAGE_CHANNELS | PERMISSIONS.MANAGE_ROLES);

    await expect(
      channels.create(SERVER_ID, USER_ID, {
        ...input,
        permissions: { roles: [{ roleId: MOD, allow: ["STREAM"], deny: [] }], members: [] },
      }),
    ).rejects.toMatchObject({ status: 403, message: "Cannot grant: STREAM" });
    expect(channel.create).not.toHaveBeenCalled();
  });

  it("404s on a role from another server", async () => {
    requirePermission.mockResolvedValue(PERMISSIONS.ADMINISTRATOR);
    requireRoles.mockRejectedValue(new HttpError(404, "Role not found"));

    await expect(
      channels.create(SERVER_ID, USER_ID, {
        ...input,
        permissions: { roles: [{ roleId: MOD, allow: ["VIEW_CHANNELS"], deny: [] }], members: [] },
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(channel.create).not.toHaveBeenCalled();
  });
});

describe("update and remove", () => {
  it("404s for an unknown channel before reading permissions", async () => {
    channel.findUnique.mockResolvedValue(null);

    await expect(channels.update(CHANNEL_ID, USER_ID, { name: "novo" })).rejects.toMatchObject({ status: 404 });
    expect(memberPermissions).not.toHaveBeenCalled();
  });

  it("needs MANAGE_CHANNELS in the channel", async () => {
    await expect(channels.remove(CHANNEL_ID, USER_ID)).rejects.toMatchObject({
      status: 403,
      message: "Missing permission: MANAGE_CHANNELS",
    });
    expect(channel.delete).not.toHaveBeenCalled();
  });

  it("honours a channel overwrite granting MANAGE_CHANNELS", async () => {
    channelMemberPermission.findMany.mockResolvedValue([
      { channelId: CHANNEL_ID, memberId: MEMBER, allow: PERMISSIONS.MANAGE_CHANNELS, deny: 0n },
    ]);
    channel.update.mockResolvedValue(row({ name: "novo" }));

    await channels.update(CHANNEL_ID, USER_ID, { name: "novo" });

    expect(channel.update).toHaveBeenCalledWith({ where: { id: CHANNEL_ID }, data: { name: "novo" } });
  });

  it("clears the topic when it is sent as null", async () => {
    memberPermissions.mockResolvedValue(ctx({ permissions: PERMISSIONS.ADMINISTRATOR }));
    channel.update.mockResolvedValue(row());

    await channels.update(CHANNEL_ID, USER_ID, { topic: null });

    expect(channel.update).toHaveBeenCalledWith({ where: { id: CHANNEL_ID }, data: { topic: null } });
  });
});

describe("channel overwrites", () => {
  const manager = PERMISSIONS.VIEW_CHANNELS | PERMISSIONS.MANAGE_ROLES | PERMISSIONS.SEND_MESSAGES;

  it("403s without MANAGE_ROLES in the channel", async () => {
    await expect(channels.getPermissions(CHANNEL_ID, USER_ID)).rejects.toMatchObject({ status: 403 });
    await expect(
      channels.setRolePermission(CHANNEL_ID, MOD, USER_ID, { allow: [], deny: ["SEND_MESSAGES"] }),
    ).rejects.toMatchObject({ status: 403 });
    expect(channelRolePermission.upsert).not.toHaveBeenCalled();
  });

  it("never lets someone allow a bit they do not hold", async () => {
    memberPermissions.mockResolvedValue(ctx({ permissions: manager }));

    await expect(
      channels.setRolePermission(CHANNEL_ID, MOD, USER_ID, { allow: ["STREAM"], deny: [] }),
    ).rejects.toMatchObject({ status: 403, message: "Cannot grant: STREAM" });
    expect(channelRolePermission.upsert).not.toHaveBeenCalled();
  });

  it("never lets someone lift a deny on a bit they do not hold", async () => {
    memberPermissions.mockResolvedValue(ctx({ permissions: manager }));
    channelMemberPermission.findUnique.mockResolvedValue({ allow: 0n, deny: PERMISSIONS.CONNECT });

    await expect(
      channels.setMemberPermission(CHANNEL_ID, "m2", USER_ID, { allow: [], deny: [] }),
    ).rejects.toMatchObject({ status: 403 });
    expect(channelMemberPermission.deleteMany).not.toHaveBeenCalled();
  });

  it("upserts an overwrite and deletes it once both lists are empty", async () => {
    memberPermissions.mockResolvedValue(ctx({ permissions: manager }));
    channelRolePermission.findUnique.mockResolvedValue(null);

    await channels.setRolePermission(CHANNEL_ID, MOD, USER_ID, { allow: [], deny: ["SEND_MESSAGES"] });
    expect(channelRolePermission.upsert).toHaveBeenCalledWith({
      where: { channelId_roleId: { channelId: CHANNEL_ID, roleId: MOD } },
      create: { channelId: CHANNEL_ID, roleId: MOD, allow: 0n, deny: PERMISSIONS.SEND_MESSAGES },
      update: { allow: 0n, deny: PERMISSIONS.SEND_MESSAGES },
    });

    await channels.setRolePermission(CHANNEL_ID, MOD, USER_ID, { allow: [], deny: [] });
    expect(channelRolePermission.deleteMany).toHaveBeenCalledWith({ where: { channelId: CHANNEL_ID, roleId: MOD } });
  });

  it("returns overwrites as permission names", async () => {
    memberPermissions.mockResolvedValue(ctx({ permissions: PERMISSIONS.ADMINISTRATOR }));
    channelRolePermission.findMany.mockResolvedValue([hideFromEveryone]);

    await expect(channels.getPermissions(CHANNEL_ID, USER_ID)).resolves.toEqual({
      roles: [{ roleId: EVERYONE, allow: [], deny: ["VIEW_CHANNELS"] }],
      members: [],
    });
  });
});

describe("canSend", () => {
  it("403s when the channel is hidden from the member", async () => {
    channelRolePermission.findMany.mockResolvedValue([hideFromEveryone]);

    await expect(channels.canSend(CHANNEL_ID, USER_ID)).rejects.toMatchObject({
      status: 403,
      message: "Missing permission: VIEW_CHANNELS",
    });
  });

  it("refuses the voice channel: it carries no messages", async () => {
    channel.findUnique.mockResolvedValue(row({ type: "voice" }));

    await expect(channels.canSend(CHANNEL_ID, USER_ID)).rejects.toMatchObject({ status: 400 });
  });

  it("needs SEND_VOICE_MESSAGES on top of SEND_MESSAGES for audio", async () => {
    memberPermissions.mockResolvedValue(
      ctx({ permissions: DEFAULT_PERMISSIONS & ~PERMISSIONS.SEND_VOICE_MESSAGES }),
    );

    await expect(channels.canSend(CHANNEL_ID, USER_ID)).resolves.toMatchObject({ id: CHANNEL_ID });
    await expect(channels.canSendVoice(CHANNEL_ID, USER_ID)).rejects.toMatchObject({
      status: 403,
      message: "Missing permission: SEND_VOICE_MESSAGES",
    });
  });
});

describe("voice permissions", () => {
  beforeEach(() => channel.findUnique.mockResolvedValue(row({ type: "voice", name: "voz" })));

  it("tells the caller whether they may speak", async () => {
    await expect(channels.canConnect(CHANNEL_ID, USER_ID)).resolves.toMatchObject({ canSpeak: true });

    channelRolePermission.findMany.mockResolvedValue([
      { channelId: CHANNEL_ID, roleId: EVERYONE, allow: 0n, deny: PERMISSIONS.SPEAK },
    ]);
    await expect(channels.canConnect(CHANNEL_ID, USER_ID)).resolves.toMatchObject({ canSpeak: false });
  });

  it("403s streaming when a role overwrite denies it", async () => {
    memberPermissions.mockResolvedValue(ctx({ roleIds: [MOD] }));
    channelRolePermission.findMany.mockResolvedValue([
      { channelId: CHANNEL_ID, roleId: MOD, allow: 0n, deny: PERMISSIONS.STREAM },
    ]);

    await expect(channels.canStream(CHANNEL_ID, USER_ID)).rejects.toMatchObject({ status: 403 });
  });

  it("lets a member view the voice roster without CONNECT", async () => {
    memberPermissions.mockResolvedValue(ctx({ permissions: PERMISSIONS.VIEW_CHANNELS }));

    await expect(channels.canViewVoice(CHANNEL_ID, USER_ID)).resolves.toMatchObject({ id: CHANNEL_ID });
    await expect(channels.canConnect(CHANNEL_ID, USER_ID)).rejects.toMatchObject({ status: 403 });
  });

  it("never treats a text channel as a voice room", async () => {
    channel.findUnique.mockResolvedValue(row());

    await expect(channels.canConnect(CHANNEL_ID, USER_ID)).rejects.toMatchObject({
      status: 400,
      message: "Not a voice channel",
    });
    expect(memberPermissions).not.toHaveBeenCalled();
  });
});

describe("viewerIds", () => {
  it("lists only members who can see the channel", async () => {
    allMemberPermissions.mockResolvedValue([
      { userId: "a", ...ctx({ memberId: "ma" }) },
      { userId: "b", ...ctx({ memberId: "mb", roleIds: [MOD] }) },
      { userId: "c", ...ctx({ memberId: "mc", permissions: PERMISSIONS.ADMINISTRATOR }) },
    ]);
    channelRolePermission.findMany.mockResolvedValue([
      hideFromEveryone,
      { channelId: CHANNEL_ID, roleId: MOD, allow: PERMISSIONS.VIEW_CHANNELS, deny: 0n },
    ]);

    await expect(channels.viewerIds(CHANNEL_ID)).resolves.toEqual(["b", "c"]);
  });
});
