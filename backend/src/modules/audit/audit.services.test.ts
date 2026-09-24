import { jest } from "@jest/globals";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();

const auditLog = { createMany: mock(), findMany: mock() };
const tx = { auditLog };
const withUser = jest.fn(async (_userId: string, fn: (t: unknown) => unknown) => fn(tx));
const requirePermission = mock();
const getProfiles = jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { id, username: `u-${id}` }])));

jest.unstable_mockModule("../../lib/prisma.js", () => ({ prisma: {}, withUser }));
jest.unstable_mockModule("../servers/servers.services.js", () => ({ requirePermission }));
jest.unstable_mockModule("../users/users.services.js", () => ({ getProfiles }));

const audit = await import("./audit.services.js");
const { AUDIT_PAGE_SIZE } = await import("./audit.schema.js");

const SERVER = "33333333-3333-3333-3333-333333333333";
const MOD = "11111111-1111-1111-1111-111111111111";
const TARGET = "22222222-2222-2222-2222-222222222222";

const row = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  serverId: SERVER,
  actorId: MOD,
  targetUserId: TARGET,
  action: "member_kick",
  details: null,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  requirePermission.mockResolvedValue(0n);
});

describe("record", () => {
  it("writes without reading the row back, so a moderator without VIEW_AUDIT_LOG can still log", async () => {
    await audit.record(tx as never, { serverId: SERVER, actorId: MOD, action: "member_ban", targetUserId: TARGET });

    expect(auditLog.createMany).toHaveBeenCalledWith({
      data: [{ serverId: SERVER, actorId: MOD, action: "member_ban", targetUserId: TARGET, details: undefined }],
    });
  });
});

describe("list", () => {
  it("returns entries with actor and target profiles, read as the caller (RLS applies)", async () => {
    auditLog.findMany.mockResolvedValue([row()]);

    const page = await audit.list(SERVER, MOD, {});

    expect(requirePermission).toHaveBeenCalledWith(SERVER, MOD, "VIEW_AUDIT_LOG");
    expect(withUser).toHaveBeenCalledWith(MOD, expect.any(Function));
    expect(page.entries[0]).toMatchObject({ action: "member_kick", actor: { id: MOD }, target: { id: TARGET } });
    expect(page.nextCursor).toBeNull();
  });

  it("403s without VIEW_AUDIT_LOG and never touches the table", async () => {
    requirePermission.mockRejectedValue(Object.assign(new Error("Missing permission"), { status: 403 }));

    await expect(audit.list(SERVER, TARGET, {})).rejects.toMatchObject({ status: 403 });
    expect(auditLog.findMany).not.toHaveBeenCalled();
  });

  it("filters by action and pages with a createdAt cursor", async () => {
    const before = new Date("2026-09-02T00:00:00Z");
    const full = Array.from({ length: AUDIT_PAGE_SIZE }, (_, i) => row({ id: `e${i}` }));
    auditLog.findMany.mockResolvedValue(full);

    const page = await audit.list(SERVER, MOD, { action: "member_ban", before });

    expect(auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { serverId: SERVER, action: "member_ban", createdAt: { lt: before } } }),
    );
    expect(page.nextCursor).toEqual(full.at(-1)!.createdAt);
  });

  it("keeps entries whose users were deleted (actor/target null)", async () => {
    auditLog.findMany.mockResolvedValue([row({ actorId: null, targetUserId: null })]);

    const page = await audit.list(SERVER, MOD, {});

    expect(page.entries[0]).toMatchObject({ actor: null, target: null });
  });
});
