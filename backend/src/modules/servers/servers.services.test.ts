import { jest } from "@jest/globals";
import { DEFAULT_PERMISSIONS, PERMISSIONS } from "../../lib/constants.js";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();

const server = { create: mock(), findUnique: mock(), findMany: mock(), update: mock(), delete: mock() };
const serverMember = { create: mock(), findUnique: mock(), findMany: mock(), delete: mock() };
const role = { create: mock(), findFirst: mock() };
const invite = { create: mock(), findUnique: mock(), updateMany: mock() };
const prisma = {
  server,
  serverMember,
  role,
  invite,
  $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
    fn({ server, serverMember, role, invite }),
  ),
};

jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma }));
jest.unstable_mockModule("../../lib/storage.js", () => ({ signedGetUrl: jest.fn(async (k: string) => `signed:${k}`) }));
jest.unstable_mockModule("../images/images.services.js", () => ({ store: mock(), remove: mock() }));

const servers = await import("./servers.services.js");

const OWNER = "11111111-1111-1111-1111-111111111111";
const MEMBER = "22222222-2222-2222-2222-222222222222";
const SERVER = "33333333-3333-3333-3333-333333333333";

const serverRow = {
  id: SERVER,
  ownerId: OWNER,
  name: "Sala",
  iconUrl: null,
  visibility: "public" as const,
  createdAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

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

    await servers.create(OWNER, { name: "Sala", visibility: "private" });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(server.create).toHaveBeenCalledWith({
      data: { name: "Sala", visibility: "private", ownerId: OWNER },
    });
    expect(role.create).toHaveBeenCalledWith({
      data: { serverId: SERVER, name: "@everyone", permissions: DEFAULT_PERMISSIONS, isDefault: true },
    });
    expect(serverMember.create).toHaveBeenCalledWith({ data: { serverId: SERVER, userId: OWNER } });
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
    invite.create.mockImplementation(({ data }: { data: object }) => ({ ...inviteRow, ...data }));

    const result = await servers.createInvite(SERVER, OWNER, { maxUses: 3, expiresAt: null });

    expect(result.code).toHaveLength(12);
    expect(invite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ serverId: SERVER, createdBy: OWNER, maxUses: 3 }),
    });
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
  it("makes the owner an administrator without reading roles", async () => {
    server.findUnique.mockResolvedValue(serverRow);

    await expect(servers.permissionsFor(SERVER, OWNER)).resolves.toBe(PERMISSIONS.ADMINISTRATOR);
    expect(role.findFirst).not.toHaveBeenCalled();
  });

  it("ORs @everyone with every role the member holds", async () => {
    server.findUnique.mockResolvedValue(serverRow);
    serverMember.findUnique.mockResolvedValue({
      id: "m1",
      roles: [{ role: { permissions: PERMISSIONS.MANAGE_ROLES } }, { role: { permissions: PERMISSIONS.KICK_MEMBERS } }],
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
