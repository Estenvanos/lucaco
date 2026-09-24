import { jest } from "@jest/globals";
import { DEFAULT_PERMISSIONS, PERMISSIONS } from "../../lib/constants.js";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();

const server = { create: mock(), findUnique: mock(), findMany: mock(), update: mock(), delete: mock() };
const serverMember = { create: mock(), findUnique: mock(), findMany: mock(), delete: mock() };
const role = { create: mock(), findFirst: mock() };
const invite = { create: mock(), findUnique: mock(), updateMany: mock() };
const channel = { createMany: mock() };
const serverBan = { findUnique: mock(), upsert: mock(), findMany: mock(), deleteMany: mock() };
const tx = { server, serverMember, role, invite, channel, serverBan };
const prisma = {
  server,
  serverMember,
  role,
  invite,
  serverBan,
  $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
};
const withUser = jest.fn(async (_userId: string, fn: (tx: unknown) => unknown) => fn(tx));
const emitToUser = mock();
const record = mock();
const notify = mock();
const getProfiles = jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { id, username: `u-${id}` }])));

jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma, withUser }));
jest.unstable_mockModule("../audit/audit.services.js", () => ({ record }));
jest.unstable_mockModule("../notifications/notifications.services.js", () => ({ notify }));
jest.unstable_mockModule("../users/users.services.js", () => ({ getProfiles }));
jest.unstable_mockModule("../../lib/storage.js", () => ({ signedGetUrl: jest.fn(async (k: string) => `signed:${k}`) }));
jest.unstable_mockModule("../images/images.services.js", () => ({ store: mock(), remove: mock() }));
jest.unstable_mockModule("../../lib/socket.js", () => ({ emitToUser }));

const imagesService = await import("../images/images.services.js");
const servers = await import("./servers.services.js");

const OWNER = "11111111-1111-1111-1111-111111111111";
const MEMBER = "22222222-2222-2222-2222-222222222222";
const SERVER = "33333333-3333-3333-3333-333333333333";

const serverRow = {
  id: SERVER,
  ownerId: OWNER,
  name: "Sala",
  description: null,
  category: "other",
  iconUrl: null,
  bannerUrl: null,
  tag: null,
  visibility: "public" as const,
  createdAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  // Nobody to notify unless a test lists members (admin notices read every membership).
  serverMember.findMany.mockResolvedValue([]);
});

describe("has", () => {
  it("grants only the requested bit", () => {
    expect(servers.has(PERMISSIONS.CONNECT, "CONNECT")).toBe(true);
    expect(servers.has(PERMISSIONS.CONNECT, "STREAM")).toBe(false);
    expect(servers.has(0n, "CONNECT")).toBe(false);
  });

  it("treats ADMINISTRATOR as every permission", () => {
    for (const name of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) {
      expect(servers.has(PERMISSIONS.ADMINISTRATOR, name)).toBe(true);
    }
  });

  it("gives @everyone voice and streaming but nothing administrative", () => {
    expect(servers.has(DEFAULT_PERMISSIONS, "CONNECT")).toBe(true);
    expect(servers.has(DEFAULT_PERMISSIONS, "STREAM")).toBe(true);
    expect(servers.has(DEFAULT_PERMISSIONS, "MANAGE_ROLES")).toBe(false);
    expect(servers.has(DEFAULT_PERMISSIONS, "ADMINISTRATOR")).toBe(false);
  });
});

describe("create", () => {
  it("creates server, @everyone and the owner membership in one transaction", async () => {
    server.create.mockResolvedValue(serverRow);

    await servers.create(OWNER, { name: "Sala", visibility: "private", category: "gaming", description: "Jogos" });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(server.create).toHaveBeenCalledWith({
      data: { name: "Sala", visibility: "private", category: "gaming", description: "Jogos", ownerId: OWNER },
    });
    expect(role.create).toHaveBeenCalledWith({
      data: { serverId: SERVER, name: "@everyone", permissions: DEFAULT_PERMISSIONS, isDefault: true },
    });
    expect(serverMember.create).toHaveBeenCalledWith({ data: { serverId: SERVER, userId: OWNER } });
  });

  it("opens every new server with a geral text channel and its single voz voice channel", async () => {
    server.create.mockResolvedValue(serverRow);

    await servers.create(OWNER, { name: "Sala", visibility: "public", category: "other" });

    expect(channel.createMany).toHaveBeenCalledWith({
      data: [
        { serverId: SERVER, type: "text", name: "geral" },
        { serverId: SERVER, type: "voice", name: "voz" },
      ],
    });
  });
});

describe("listMembers", () => {
  it("shows each member's status and signed avatar, never the email or hash", async () => {
    serverMember.findMany.mockResolvedValue([
      {
        id: "m1",
        userId: MEMBER,
        nickname: null,
        joinedAt: new Date(),
        roles: [],
        user: {
          username: "person",
          displayName: null,
          avatarUrl: "images/avatars/a.webp",
          status: "dnd",
          email: "person@example.com",
          passwordHash: "argon2id$secret",
        },
      },
    ]);
    server.findUnique.mockResolvedValue(serverRow);

    const [member] = await servers.listMembers(SERVER);

    expect(member).toMatchObject({ userId: MEMBER, status: "dnd", avatarUrl: "signed:images/avatars/a.webp" });
    expect(JSON.stringify(member)).not.toMatch(/argon2id|example\.com/);
  });

  it("flags the owner and holders of an ADMINISTRATOR role as admins", async () => {
    const user = { username: "u", displayName: null, avatarUrl: null, status: "online" };
    serverMember.findMany.mockResolvedValue([
      { id: "m0", userId: OWNER, nickname: null, joinedAt: new Date(), roles: [], user },
      {
        id: "m1",
        userId: MEMBER,
        nickname: null,
        joinedAt: new Date(),
        roles: [{ roleId: "r1", role: { permissions: PERMISSIONS.ADMINISTRATOR } }],
        user,
      },
      { id: "m2", userId: "x", nickname: null, joinedAt: new Date(), roles: [{ roleId: "r2", role: { permissions: PERMISSIONS.KICK_MEMBERS } }], user },
    ]);
    server.findUnique.mockResolvedValue(serverRow);

    const members = await servers.listMembers(SERVER);

    expect(members.map((m) => m.isAdmin)).toEqual([true, true, false]);
  });
});

describe("join", () => {
  it("lets anyone join a public server", async () => {
    server.findUnique.mockResolvedValue(serverRow);
    serverMember.findUnique.mockResolvedValue(null);
    serverMember.create.mockResolvedValue({ id: "m1", serverId: SERVER, userId: MEMBER });

    await expect(servers.join(SERVER, MEMBER)).resolves.toMatchObject({ id: "m1" });
    expect(serverMember.create).toHaveBeenCalledWith({ data: { serverId: SERVER, userId: MEMBER } });
  });

  it("requires an invite for a private server", async () => {
    server.findUnique.mockResolvedValue({ ...serverRow, visibility: "private" });
    serverMember.findUnique.mockResolvedValue(null);

    await expect(servers.join(SERVER, MEMBER)).rejects.toMatchObject({
      status: 403,
      message: "Invite required for private server",
    });
    expect(serverMember.create).not.toHaveBeenCalled();
  });

  it("refuses a banned user with 403", async () => {
    server.findUnique.mockResolvedValue(serverRow);
    serverMember.findUnique.mockResolvedValue(null);
    serverBan.findUnique.mockResolvedValueOnce({ id: "b1" });

    await expect(servers.join(SERVER, MEMBER)).rejects.toMatchObject({
      status: 403,
      message: "You are banned from this server",
    });
    expect(serverMember.create).not.toHaveBeenCalled();
  });

  it("keeps joining idempotent after a server becomes private", async () => {
    const membership = { id: "m1", serverId: SERVER, userId: MEMBER };
    server.findUnique.mockResolvedValue({ ...serverRow, visibility: "private" });
    serverMember.findUnique.mockResolvedValue(membership);

    await expect(servers.join(SERVER, MEMBER)).resolves.toBe(membership);
  });
});

describe("invites", () => {
  const inviteRow = {
    code: "Abcd_efgh-12",
    serverId: SERVER,
    createdBy: OWNER,
    maxUses: null,
    uses: 0,
    expiresAt: null,
    createdAt: new Date(),
  };

  it("lets the owner create an invite", async () => {
    server.findUnique.mockResolvedValue(serverRow);
    serverMember.findUnique.mockResolvedValue({ id: "m0", roles: [] });
    invite.create.mockImplementation(({ data }: { data: object }) => ({ ...inviteRow, ...data }));

    const result = await servers.createInvite(SERVER, OWNER, { maxUses: 3, expiresAt: null });

    expect(result.code).toHaveLength(12);
    expect(invite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ serverId: SERVER, createdBy: OWNER, maxUses: 3 }),
    });
  });

  it("refuses a banned user even with a valid invite, without spending a use", async () => {
    invite.findUnique.mockResolvedValue(inviteRow);
    serverMember.findUnique.mockResolvedValue(null);
    serverBan.findUnique.mockResolvedValueOnce({ id: "b1" });

    await expect(servers.acceptInvite(inviteRow.code, MEMBER)).rejects.toMatchObject({ status: 403 });
    expect(invite.updateMany).not.toHaveBeenCalled();
    expect(serverMember.create).not.toHaveBeenCalled();
  });

  it("accepts a valid invite and consumes one use atomically", async () => {
    invite.findUnique.mockResolvedValue(inviteRow);
    invite.updateMany.mockResolvedValue({ count: 1 });
    serverMember.findUnique.mockResolvedValue(null);
    serverMember.create.mockResolvedValue({ id: "m1", serverId: SERVER, userId: MEMBER });

    await expect(servers.acceptInvite(inviteRow.code, MEMBER)).resolves.toMatchObject({ id: "m1" });
    expect(invite.updateMany).toHaveBeenCalledWith({
      where: { code: inviteRow.code },
      data: { uses: { increment: 1 } },
    });
    expect(serverMember.create).toHaveBeenCalledWith({ data: { serverId: SERVER, userId: MEMBER } });
  });

  it("rejects unknown, expired and exhausted invites without adding a member", async () => {
    invite.findUnique.mockResolvedValueOnce(null);
    await expect(servers.acceptInvite(inviteRow.code, MEMBER)).rejects.toMatchObject({ status: 404 });

    invite.findUnique.mockResolvedValueOnce({ ...inviteRow, expiresAt: new Date(0) });
    serverMember.findUnique.mockResolvedValue(null);
    await expect(servers.acceptInvite(inviteRow.code, MEMBER)).rejects.toMatchObject({ status: 410 });

    invite.findUnique.mockResolvedValueOnce({ ...inviteRow, maxUses: 1, uses: 1 });
    invite.updateMany.mockResolvedValue({ count: 0 });
    await expect(servers.acceptInvite(inviteRow.code, MEMBER)).rejects.toMatchObject({ status: 410 });
    expect(serverMember.create).not.toHaveBeenCalled();
  });

  it("does not consume another use when the invited user is already a member", async () => {
    const membership = { id: "m1", serverId: SERVER, userId: MEMBER };
    invite.findUnique.mockResolvedValue(inviteRow);
    serverMember.findUnique.mockResolvedValue(membership);

    await expect(servers.acceptInvite(inviteRow.code, MEMBER)).resolves.toBe(membership);
    expect(invite.updateMany).not.toHaveBeenCalled();
  });
});

describe("permissionsFor", () => {
  it("makes the owner an administrator whatever roles they hold", async () => {
    server.findUnique.mockResolvedValue(serverRow);
    serverMember.findUnique.mockResolvedValue({ id: "m0", roles: [] });
    role.findFirst.mockResolvedValue({ id: "everyone", permissions: 0n });

    const permissions = await servers.permissionsFor(SERVER, OWNER);

    expect(servers.has(permissions, "MANAGE_SERVER")).toBe(true);
  });

  it("ORs @everyone with every role the member holds", async () => {
    server.findUnique.mockResolvedValue(serverRow);
    serverMember.findUnique.mockResolvedValue({
      id: "m1",
      roles: [
        { roleId: "r1", role: { permissions: PERMISSIONS.MANAGE_ROLES } },
        { roleId: "r2", role: { permissions: PERMISSIONS.KICK_MEMBERS } },
      ],
    });
    role.findFirst.mockResolvedValue({ permissions: DEFAULT_PERMISSIONS });

    const permissions = await servers.permissionsFor(SERVER, MEMBER);

    expect(servers.has(permissions, "CONNECT")).toBe(true);
    expect(servers.has(permissions, "MANAGE_ROLES")).toBe(true);
    expect(servers.has(permissions, "KICK_MEMBERS")).toBe(true);
    expect(servers.has(permissions, "MANAGE_SERVER")).toBe(false);
  });

  it("rejects a non-member with 403", async () => {
    server.findUnique.mockResolvedValue(serverRow);
    serverMember.findUnique.mockResolvedValue(null);

    await expect(servers.permissionsFor(SERVER, MEMBER)).rejects.toMatchObject({ status: 403 });
  });
});

describe("memberPermissions", () => {
  it("returns what channel overwrites need: member, role ids and @everyone", async () => {
    server.findUnique.mockResolvedValue(serverRow);
    serverMember.findUnique.mockResolvedValue({ id: "m1", roles: [{ roleId: "r1", role: { permissions: 0n } }] });
    role.findFirst.mockResolvedValue({ id: "everyone", permissions: DEFAULT_PERMISSIONS });

    await expect(servers.memberPermissions(SERVER, MEMBER)).resolves.toEqual({
      permissions: DEFAULT_PERMISSIONS,
      memberId: "m1",
      roleIds: ["r1"],
      everyoneRoleId: "everyone",
    });
  });
});

describe("requirePermission", () => {
  it("passes for a member that holds it and 403s otherwise", async () => {
    server.findUnique.mockResolvedValue(serverRow);
    serverMember.findUnique.mockResolvedValue({ id: "m1", roles: [] });
    role.findFirst.mockResolvedValue({ permissions: DEFAULT_PERMISSIONS });

    await expect(servers.requirePermission(SERVER, MEMBER, "CONNECT")).resolves.toBe(DEFAULT_PERMISSIONS);
    await expect(servers.requirePermission(SERVER, MEMBER, "MANAGE_ROLES")).rejects.toMatchObject({
      status: 403,
      message: "Missing permission: MANAGE_ROLES",
    });
  });
});

describe("leave", () => {
  it("refuses to strand a server without its owner", async () => {
    server.findUnique.mockResolvedValue(serverRow);

    await expect(servers.leave(SERVER, OWNER)).rejects.toMatchObject({ status: 409 });
    expect(serverMember.delete).not.toHaveBeenCalled();
  });

  it("removes a regular member", async () => {
    server.findUnique.mockResolvedValue(serverRow);
    serverMember.findUnique.mockResolvedValue({ id: "m1", roles: [] });

    await servers.leave(SERVER, MEMBER);

    expect(serverMember.delete).toHaveBeenCalledWith({
      where: { serverId_userId: { serverId: SERVER, userId: MEMBER } },
    });
  });
});

describe("admin notices", () => {
  const ADMIN = "55555555-5555-5555-5555-555555555555";
  const TARGET = "44444444-4444-4444-4444-444444444444";
  const adminRole = { roleId: "ra", role: { permissions: PERMISSIONS.ADMINISTRATOR } };
  const KICKER = "88888888-8888-8888-8888-888888888888";
  const BANNER = "99999999-9999-9999-9999-999999999999";
  /** Owner, an admin, the acting moderator, a kick-only and a ban-only moderator, a plain member. */
  const membersWithAdmin = [
    { id: "mo", userId: OWNER, roles: [] },
    { id: "ma", userId: ADMIN, roles: [adminRole] },
    { id: "mm", userId: MEMBER, roles: [adminRole] },
    { id: "mk", userId: KICKER, roles: [{ roleId: "rk", role: { permissions: PERMISSIONS.KICK_MEMBERS } }] },
    { id: "mb", userId: BANNER, roles: [{ roleId: "rb", role: { permissions: PERMISSIONS.BAN_MEMBERS } }] },
    { id: "mp", userId: "77777777-7777-7777-7777-777777777777", roles: [] },
  ];

  beforeEach(() => {
    serverMember.findUnique.mockReset();
    server.findUnique.mockResolvedValue(serverRow);
    role.findFirst.mockResolvedValue({ id: "everyone", permissions: DEFAULT_PERMISSIONS });
    serverMember.findMany.mockResolvedValue(membersWithAdmin);
  });

  it("tells the owner, admins and kick/ban moderators who joined, not the newcomer or plain members", async () => {
    serverMember.findUnique.mockResolvedValue(null);
    serverMember.create.mockResolvedValue({ id: "m9", serverId: SERVER, userId: TARGET });

    await servers.join(SERVER, TARGET);

    const receivers = notify.mock.calls.map(([n]) => n.receiverId).sort();
    expect(receivers).toEqual([OWNER, ADMIN, MEMBER, KICKER, BANNER].sort());
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ tag: "server_activity", ownerId: TARGET, serverId: SERVER, subtitle: "Sala", title: `u-${TARGET} entrou no server` }),
    );
  });

  it("says who kicked whom, and never notifies the moderator who did it", async () => {
    serverMember.findUnique
      .mockResolvedValueOnce({ id: "mm", roles: [adminRole] })
      .mockResolvedValueOnce({ id: "t1", userId: TARGET, roles: [] });

    await servers.kick(SERVER, TARGET, MEMBER);

    const receivers = notify.mock.calls.map(([n]) => n.receiverId);
    expect(receivers).not.toContain(MEMBER);
    expect(receivers.sort()).toEqual([OWNER, ADMIN, KICKER, BANNER].sort());
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: `u-${MEMBER} expulsou u-${TARGET}` }));
  });

  it("announces bans and departures too", async () => {
    serverMember.findUnique
      .mockResolvedValueOnce({ id: "mm", roles: [adminRole] })
      .mockResolvedValueOnce({ id: "t1", userId: TARGET, roles: [] });
    await servers.ban(SERVER, TARGET, MEMBER);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: `u-${MEMBER} baniu u-${TARGET}` }));

    serverMember.findUnique.mockResolvedValue({ id: "t1", roles: [] });
    await servers.leave(SERVER, TARGET);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: `u-${TARGET} saiu do server` }));
  });

  it("keeps the action when a notice fails", async () => {
    serverMember.findUnique.mockResolvedValue(null);
    serverMember.create.mockResolvedValue({ id: "m9", serverId: SERVER, userId: TARGET });
    notify.mockRejectedValue(new Error("db down"));
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(servers.join(SERVER, TARGET)).resolves.toMatchObject({ id: "m9" });
    error.mockRestore();
    notify.mockReset();
  });
});

describe("getById", () => {
  it("404s for an unknown server", async () => {
    server.findUnique.mockResolvedValue(null);
    await expect(servers.getById(SERVER)).rejects.toMatchObject({ status: 404 });
  });
});

describe("toPublicServer", () => {
  it("signs the icon key and leaves null alone", async () => {
    await expect(servers.toPublicServer({ ...serverRow, iconUrl: "images/servers/x.webp" })).resolves.toMatchObject({
      iconUrl: "signed:images/servers/x.webp",
    });
    await expect(servers.toPublicServer(serverRow)).resolves.toMatchObject({ iconUrl: null });
    await expect(servers.toPublicServer(serverRow)).resolves.toMatchObject({ visibility: "public" });
  });
});

describe("search", () => {
  const named = (...names: string[]) =>
    server.findMany.mockResolvedValue(names.map((name, i) => ({ ...serverRow, id: `id-${i}`, name })));

  it("searches only the servers the user is a member of", async () => {
    named("Sala");

    await servers.search(MEMBER, "sala");

    expect(server.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { members: { some: { userId: MEMBER } } } }),
    );
  });

  it("lists every server when the query is blank", async () => {
    named("Pixel Club", "Sala");

    const found = await servers.search(OWNER, "   ");

    expect(found.map((s) => s.name)).toEqual(["Pixel Club", "Sala"]);
  });

  it("ignores case and accents", async () => {
    named("São Paulo FC", "Rio");

    const found = await servers.search(OWNER, "SAO paulo");

    expect(found.map((s) => s.name)).toEqual(["São Paulo FC"]);
  });

  it("still finds a name through a typo", async () => {
    named("Pixel Club", "Sala de estudos");

    const found = await servers.search(OWNER, "pixl");

    expect(found.map((s) => s.name)).toEqual(["Pixel Club"]);
  });

  it("ranks prefix over word prefix over substring over typo", async () => {
    named("Time do sabado", "Clube da tarde", "Tarde livre", "Sabatarde", "Tardi");

    const found = await servers.search(OWNER, "tarde");

    expect(found.map((s) => s.name)).toEqual(["Tarde livre", "Clube da tarde", "Sabatarde", "Tardi"]);
  });

  it("drops servers with nothing in common with the query", async () => {
    named("Pixel Club", "Sala");

    expect(await servers.search(OWNER, "xyzw")).toEqual([]);
  });
});

describe("discover", () => {
  const withMembers = (members: number) => ({ ...serverRow, _count: { members } });

  it("lists only public servers", async () => {
    server.findMany.mockResolvedValue([]);

    await servers.discover({ q: "" });

    expect(server.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { visibility: "public" } }),
    );
  });

  it("filters by category and name when given", async () => {
    server.findMany.mockResolvedValue([]);

    await servers.discover({ q: "pixel", category: "gaming" });

    expect(server.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          visibility: "public",
          category: "gaming",
          name: { contains: "pixel", mode: "insensitive" },
        },
      }),
    );
  });

  it("returns the member count instead of the raw _count", async () => {
    server.findMany.mockResolvedValue([withMembers(42)]);

    const [found] = await servers.discover({ q: "" });

    expect(found).toMatchObject({ id: SERVER, memberCount: 42 });
    expect(found).not.toHaveProperty("_count");
  });
});

describe("updateBanner", () => {
  const file = { mimetype: "image/png" as const, size: 10, buffer: Buffer.from("x") };

  it("stores the banner in its own folder and removes the previous one", async () => {
    server.findUnique.mockResolvedValue({ ...serverRow, bannerUrl: "images/banners/old.webp" });
    serverMember.findUnique.mockResolvedValue({ id: "m0", roles: [] });
    jest.mocked(imagesService.store).mockResolvedValue("images/banners/new.webp");
    jest.mocked(imagesService.remove).mockResolvedValue(undefined);
    server.update.mockResolvedValue({ ...serverRow, bannerUrl: "images/banners/new.webp" });

    const updated = await servers.updateBanner(SERVER, OWNER, file);

    expect(imagesService.store).toHaveBeenCalledWith(file, "banners", SERVER);
    expect(server.update).toHaveBeenCalledWith({
      where: { id: SERVER },
      data: { bannerUrl: "images/banners/new.webp" },
    });
    expect(imagesService.remove).toHaveBeenCalledWith("images/banners/old.webp");
    expect(updated.bannerUrl).toBe("images/banners/new.webp");
  });

  it("refuses members without MANAGE_SERVER", async () => {
    server.findUnique.mockResolvedValue(serverRow);
    serverMember.findUnique.mockResolvedValue({ id: "m1", roles: [] });
    role.findFirst.mockResolvedValue({ permissions: DEFAULT_PERMISSIONS });

    await expect(servers.updateBanner(SERVER, MEMBER, file)).rejects.toMatchObject({ status: 403 });
    expect(imagesService.store).not.toHaveBeenCalled();
  });
});

describe("toPublicServer banner", () => {
  it("signs the banner key and leaves null alone", async () => {
    await expect(
      servers.toPublicServer({ ...serverRow, bannerUrl: "images/banners/b.webp" }),
    ).resolves.toMatchObject({ bannerUrl: "signed:images/banners/b.webp" });
    await expect(servers.toPublicServer(serverRow)).resolves.toMatchObject({ bannerUrl: null });
  });
});

describe("kick and ban", () => {
  const TARGET = "44444444-4444-4444-4444-444444444444";
  const actorWith = (permissions: bigint) => ({ id: "a1", roles: [{ roleId: "r", role: { permissions } }] });
  const target = (permissions = 0n) => ({ id: "t1", userId: TARGET, roles: [{ roleId: "r", role: { permissions } }] });

  beforeEach(() => serverMember.findUnique.mockReset());

  /** First findUnique is the actor (permission check), the second the target. */
  const setup = (actor: unknown, targetMember: unknown) => {
    server.findUnique.mockResolvedValue(serverRow);
    role.findFirst.mockResolvedValue({ id: "everyone", permissions: DEFAULT_PERMISSIONS });
    serverMember.findUnique.mockResolvedValueOnce(actor).mockResolvedValueOnce(targetMember);
  };

  it("lets a moderator kick a member, who is told live and can come back", async () => {
    setup(actorWith(PERMISSIONS.KICK_MEMBERS), target());

    await servers.kick(SERVER, TARGET, MEMBER);

    expect(serverMember.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
    expect(serverBan.upsert).not.toHaveBeenCalled();
    expect(emitToUser).toHaveBeenCalledWith(TARGET, "server:removed", { serverId: SERVER });
  });

  it("records the kick in the audit log inside the same transaction", async () => {
    setup(actorWith(PERMISSIONS.KICK_MEMBERS), target());

    await servers.kick(SERVER, TARGET, MEMBER);

    expect(record).toHaveBeenCalledWith(tx, {
      serverId: SERVER,
      actorId: MEMBER,
      action: "member_kick",
      targetUserId: TARGET,
    });
  });

  it("403s a kick without KICK_MEMBERS", async () => {
    setup(actorWith(0n), target());

    await expect(servers.kick(SERVER, TARGET, MEMBER)).rejects.toMatchObject({ status: 403 });
    expect(serverMember.delete).not.toHaveBeenCalled();
  });

  it("never removes the owner", async () => {
    setup(actorWith(PERMISSIONS.ADMINISTRATOR), null);
    await expect(servers.kick(SERVER, OWNER, MEMBER)).rejects.toMatchObject({ status: 403 });

    serverMember.findUnique.mockReset();
    setup(actorWith(PERMISSIONS.ADMINISTRATOR), null);
    await expect(servers.ban(SERVER, OWNER, MEMBER)).rejects.toMatchObject({ status: 403 });
    expect(serverMember.delete).not.toHaveBeenCalled();
  });

  it("lets only the owner remove an administrator", async () => {
    setup(actorWith(PERMISSIONS.ADMINISTRATOR), target(PERMISSIONS.ADMINISTRATOR));
    await expect(servers.kick(SERVER, TARGET, MEMBER)).rejects.toMatchObject({ status: 403 });
    expect(serverMember.delete).not.toHaveBeenCalled();

    setup({ id: "m0", roles: [] }, target(PERMISSIONS.ADMINISTRATOR));
    await servers.kick(SERVER, TARGET, OWNER);
    expect(serverMember.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
  });

  it("409s removing yourself (that is leave)", async () => {
    await expect(servers.kick(SERVER, MEMBER, MEMBER)).rejects.toMatchObject({ status: 409 });
  });

  it("404s a target that is not a member", async () => {
    setup(actorWith(PERMISSIONS.KICK_MEMBERS), null);

    await expect(servers.kick(SERVER, TARGET, MEMBER)).rejects.toMatchObject({ status: 404 });
  });

  it("bans: removes the member and records the ban", async () => {
    setup(actorWith(PERMISSIONS.BAN_MEMBERS), target());

    await servers.ban(SERVER, TARGET, MEMBER);

    expect(serverMember.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
    expect(serverBan.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { serverId: SERVER, userId: TARGET, bannedBy: MEMBER } }),
    );
    expect(emitToUser).toHaveBeenCalledWith(TARGET, "server:removed", { serverId: SERVER });
    expect(record).toHaveBeenCalledWith(tx, expect.objectContaining({ action: "member_ban", targetUserId: TARGET }));
  });

  it("403s a ban with only KICK_MEMBERS", async () => {
    setup(actorWith(PERMISSIONS.KICK_MEMBERS), target());

    await expect(servers.ban(SERVER, TARGET, MEMBER)).rejects.toMatchObject({ status: 403 });
    expect(serverBan.upsert).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});

describe("bans list and unban", () => {
  const TARGET = "44444444-4444-4444-4444-444444444444";
  beforeEach(() => serverMember.findUnique.mockReset());
  const actorWith = (permissions: bigint) => {
    server.findUnique.mockResolvedValue(serverRow);
    role.findFirst.mockResolvedValue({ id: "everyone", permissions: DEFAULT_PERMISSIONS });
    serverMember.findUnique.mockResolvedValue({ id: "a1", roles: [{ roleId: "r", role: { permissions } }] });
  };

  it("lists bans with both profiles, as the caller (RLS applies)", async () => {
    actorWith(PERMISSIONS.BAN_MEMBERS);
    serverBan.findMany.mockResolvedValue([{ userId: TARGET, bannedBy: MEMBER, createdAt: new Date() }]);

    const bans = await servers.listBans(SERVER, MEMBER);

    expect(withUser).toHaveBeenCalledWith(MEMBER, expect.any(Function));
    expect(bans[0]).toMatchObject({ user: { id: TARGET }, bannedBy: { id: MEMBER } });
  });

  it("403s listing bans without BAN_MEMBERS", async () => {
    actorWith(PERMISSIONS.KICK_MEMBERS);

    await expect(servers.listBans(SERVER, MEMBER)).rejects.toMatchObject({ status: 403 });
    expect(serverBan.findMany).not.toHaveBeenCalled();
  });

  it("unbans and records it", async () => {
    actorWith(PERMISSIONS.BAN_MEMBERS);
    serverBan.deleteMany.mockResolvedValue({ count: 1 });

    await servers.unban(SERVER, TARGET, MEMBER);

    expect(serverBan.deleteMany).toHaveBeenCalledWith({ where: { serverId: SERVER, userId: TARGET } });
    expect(record).toHaveBeenCalledWith(tx, expect.objectContaining({ action: "member_unban", targetUserId: TARGET }));
  });

  it("404s unbanning someone who is not banned", async () => {
    actorWith(PERMISSIONS.BAN_MEMBERS);
    serverBan.deleteMany.mockResolvedValue({ count: 0 });

    await expect(servers.unban(SERVER, TARGET, MEMBER)).rejects.toMatchObject({ status: 404 });
    expect(record).not.toHaveBeenCalled();
  });

  it("403s an unban without BAN_MEMBERS", async () => {
    actorWith(0n);

    await expect(servers.unban(SERVER, TARGET, MEMBER)).rejects.toMatchObject({ status: 403 });
    expect(serverBan.deleteMany).not.toHaveBeenCalled();
  });
});

describe("update", () => {
  it("saves the profile and records which fields changed", async () => {
    server.findUnique.mockResolvedValue(serverRow);
    serverMember.findUnique.mockResolvedValue({ id: "m0", roles: [] });
    role.findFirst.mockResolvedValue({ permissions: DEFAULT_PERMISSIONS });
    server.update.mockResolvedValue({ ...serverRow, tag: "LUC" });

    const updated = await servers.update(SERVER, OWNER, { name: "Nova", tag: "LUC" });

    expect(server.update).toHaveBeenCalledWith({ where: { id: SERVER }, data: { name: "Nova", tag: "LUC" } });
    expect(record).toHaveBeenCalledWith(tx, expect.objectContaining({ action: "server_update", details: { fields: ["name", "tag"] } }));
    expect(updated.tag).toBe("LUC");
  });

  it("403s without MANAGE_SERVER", async () => {
    server.findUnique.mockResolvedValue(serverRow);
    serverMember.findUnique.mockResolvedValue({ id: "m1", roles: [] });
    role.findFirst.mockResolvedValue({ permissions: DEFAULT_PERMISSIONS });

    await expect(servers.update(SERVER, MEMBER, { name: "Nova" })).rejects.toMatchObject({ status: 403 });
    expect(server.update).not.toHaveBeenCalled();
  });
});

describe("getMemberById", () => {
  it("404s a membership from another server", async () => {
    serverMember.findUnique.mockResolvedValue({ id: "m1", serverId: "99999999-9999-9999-9999-999999999999" });

    await expect(servers.getMemberById(SERVER, "m1")).rejects.toMatchObject({ status: 404 });
  });

  it("returns the membership of this server", async () => {
    serverMember.findUnique.mockResolvedValue({ id: "m1", serverId: SERVER, userId: MEMBER });

    await expect(servers.getMemberById(SERVER, "m1")).resolves.toMatchObject({ userId: MEMBER });
  });
});

describe("toPublicServer tag", () => {
  it("exposes the tag", async () => {
    await expect(servers.toPublicServer({ ...serverRow, tag: "LUC" })).resolves.toMatchObject({ tag: "LUC" });
  });
});
