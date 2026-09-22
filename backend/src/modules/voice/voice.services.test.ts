import { jest } from "@jest/globals";

/** jest.fn() with no type argument infers `never` parameters, which breaks mockResolvedValue. */
const mock = () => jest.fn<(...args: any[]) => any>();
const canConnect = mock();
const canStream = mock();
const canViewVoice = mock();

jest.unstable_mockModule("../channels/channels.services.js", () => ({ canConnect, canStream, canViewVoice }));

const voice = await import("./voice.services.js");

type FakeSocket = {
  id: string;
  data: Record<string, unknown>;
  join: jest.Mock;
  leave: jest.Mock;
  to: jest.Mock;
  emit: jest.Mock;
};

const emit = mock();

function socket(id: string, data: Record<string, unknown> = {}): FakeSocket {
  return {
    id,
    data: { userId: `user-${id}`, username: `name-${id}`, ...data },
    join: mock(),
    leave: mock(),
    to: jest.fn(() => ({ emit })),
    emit,
  };
}

/** Enough of the Socket.IO server surface for the room bookkeeping under test. */
function server(sockets: FakeSocket[], roomMembers: FakeSocket[] = []) {
  return {
    sockets: { sockets: new Map(sockets.map((s) => [s.id, s])) },
    in: jest.fn(() => ({ fetchSockets: jest.fn(async () => roomMembers) })),
    to: jest.fn(() => ({ emit })),
  } as never;
}

describe("join", () => {
  it("returns the peers already in the room and announces the newcomer", async () => {
    const newcomer = socket("a");
    const present = socket("b", { voiceChannelId: "sala", sharing: true });
    const io = server([newcomer], [present]);

    canConnect.mockResolvedValue({ canSpeak: false, userLimit: 12 });

    const { peers, canSpeak } = await voice.join(io, "a", "user-a", "sala");

    expect(canConnect).toHaveBeenCalledWith("sala", "user-a");
    expect(canSpeak).toBe(false);
    expect(peers).toEqual([
      { socketId: "b", userId: "user-b", username: "name-b", sharing: true, viewing: null },
    ]);
    expect(newcomer.join).toHaveBeenCalledWith("voice:sala");
    expect(newcomer.data.voiceChannelId).toBe("sala");
    expect(emit).toHaveBeenCalledWith(
      "voice:peer-joined",
      expect.objectContaining({ socketId: "a", sharing: false }),
    );
  });

  it("leaves the previous room first, so a socket is never in two rooms", async () => {
    const moving = socket("a", { voiceChannelId: "antiga" });
    const io = server([moving]);

    await voice.join(io, "a", "user-a", "nova");

    expect(moving.leave).toHaveBeenCalledWith("voice:antiga");
    expect(moving.join).toHaveBeenCalledWith("voice:nova");
    expect(moving.data.voiceChannelId).toBe("nova");
  });

  it("refuses a newcomer once the channel is at its user limit", async () => {
    canConnect.mockResolvedValue({ canSpeak: true, userLimit: 1 });
    const newcomer = socket("a");
    const io = server([newcomer], [socket("b", { voiceChannelId: "sala" })]);

    await expect(voice.join(io, "a", "user-a", "sala")).rejects.toThrow("lotado");
    expect(newcomer.join).not.toHaveBeenCalled();
  });

  it("does not join an invented or forbidden channel", async () => {
    canConnect.mockRejectedValue(new Error("forbidden"));
    const newcomer = socket("a");

    await expect(voice.join(server([newcomer]), "a", "user-a", "fora-do-banco")).rejects.toThrow(
      "forbidden",
    );
    expect(newcomer.join).not.toHaveBeenCalled();
  });
});

describe("leave", () => {
  it("clears the room and the sharing flag", async () => {
    const leaving = socket("a", { voiceChannelId: "sala", sharing: true });

    await voice.leave(server([leaving]), "a");

    expect(leaving.leave).toHaveBeenCalledWith("voice:sala");
    expect(leaving.data.voiceChannelId).toBeUndefined();
    expect(leaving.data.sharing).toBe(false);
    expect(emit).toHaveBeenCalledWith("voice:peer-left", { socketId: "a" });
  });

  it("is a no-op for a socket that never joined", async () => {
    const idle = socket("a");

    await voice.leave(server([idle]), "a");

    expect(idle.leave).not.toHaveBeenCalled();
  });
});

describe("watch", () => {
  it("shows the current call roster without joining the viewer to the call", async () => {
    const viewer = socket("viewer");
    const caller = socket("caller", { voiceChannelId: "sala", sharing: true });

    const result = await voice.watch(server([viewer], [caller]), "viewer", "user-viewer", "sala");

    expect(canViewVoice).toHaveBeenCalledWith("sala", "user-viewer");
    expect(viewer.join).toHaveBeenCalledWith("voice-watchers:sala");
    expect(viewer.join).not.toHaveBeenCalledWith("voice:sala");
    expect(result).toEqual([
      { socketId: "caller", userId: "user-caller", username: "name-caller", sharing: true, viewing: null },
    ]);
  });

  it("removes only the matching roster subscription", async () => {
    const viewer = socket("viewer", {
      watchingVoiceChannelId: "sala",
      joinedVoiceWatchRoom: "sala",
    });

    voice.unwatch(server([viewer]), "viewer", "outra");
    expect(viewer.leave).not.toHaveBeenCalled();

    voice.unwatch(server([viewer]), "viewer", "sala");
    expect(viewer.leave).toHaveBeenCalledWith("voice-watchers:sala");
  });
});

describe("setSharing", () => {
  it("checks STREAM, stores the state and broadcasts it to the room", async () => {
    const sharer = socket("a", { voiceChannelId: "sala" });

    await expect(voice.setSharing(server([sharer]), "a", "user-a", true)).resolves.toBe(true);
    expect(canStream).toHaveBeenCalledWith("sala", "user-a");
    expect(sharer.data.sharing).toBe(true);
    expect(emit).toHaveBeenCalledWith("voice:screen", { socketId: "a", sharing: true });
  });

  it("fails when the socket is not in a room, which the controller turns into 409", async () => {
    const idle = socket("a");

    await expect(voice.setSharing(server([idle]), "a", "user-a", true)).resolves.toBe(false);
    expect(emit).not.toHaveBeenCalled();
  });

  it("does not announce or store a share without STREAM permission", async () => {
    canStream.mockRejectedValue(new Error("forbidden"));
    const sharer = socket("a", { voiceChannelId: "sala" });

    await expect(voice.setSharing(server([sharer]), "a", "user-a", true)).rejects.toThrow("forbidden");
    expect(sharer.data.sharing).toBeUndefined();
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("setSharing and viewers", () => {
  it("refuses to share while watching another stream", async () => {
    canStream.mockResolvedValue(undefined);
    const viewer = socket("a", { voiceChannelId: "sala", viewing: "b" });

    await expect(voice.setSharing(server([viewer]), "a", "user-a", true)).rejects.toMatchObject({ status: 409 });
    expect(viewer.data.sharing).toBeUndefined();
  });

  it("drops every viewer when the stream stops", async () => {
    const streamer = socket("a", { voiceChannelId: "sala", sharing: true });
    const viewer = socket("b", { voiceChannelId: "sala", viewing: "a" });

    await voice.setSharing(server([streamer, viewer]), "a", "user-a", false);

    expect(viewer.data.viewing).toBeUndefined();
    expect(emit).toHaveBeenCalledWith("voice:screen", { socketId: "a", sharing: false });
  });
});

describe("watchStream", () => {
  it("records the viewer and asks the streamer to send the tab to it", async () => {
    const streamer = socket("a", { voiceChannelId: "sala", sharing: true });
    const viewer = socket("b", { voiceChannelId: "sala" });
    const io = server([streamer, viewer]);

    await voice.watchStream(io, "b", "a");

    expect(viewer.data.viewing).toBe("a");
    expect(emit).toHaveBeenCalledWith("voice:viewer", { socketId: "b", watching: true });
  });

  it("does not let a sharer watch a stream", async () => {
    const streamer = socket("a", { voiceChannelId: "sala", sharing: true });
    const sharer = socket("b", { voiceChannelId: "sala", sharing: true });

    await expect(voice.watchStream(server([streamer, sharer]), "b", "a")).rejects.toMatchObject({ status: 409 });
    expect(sharer.data.viewing).toBeUndefined();
    expect(emit).not.toHaveBeenCalled();
  });

  it("requires the viewer to be in the call", async () => {
    const streamer = socket("a", { voiceChannelId: "sala", sharing: true });
    const outsider = socket("b");

    await expect(voice.watchStream(server([streamer, outsider]), "b", "a")).rejects.toMatchObject({ status: 409 });
    expect(outsider.data.viewing).toBeUndefined();
  });

  it("only opens a live stream of the same call", async () => {
    const idle = socket("a", { voiceChannelId: "sala" });
    const elsewhere = socket("c", { voiceChannelId: "outra", sharing: true });
    const viewer = socket("b", { voiceChannelId: "sala" });
    const io = server([idle, elsewhere, viewer]);

    await expect(voice.watchStream(io, "b", "a")).rejects.toMatchObject({ status: 404 });
    await expect(voice.watchStream(io, "b", "c")).rejects.toMatchObject({ status: 404 });
    await expect(voice.watchStream(io, "b", "b")).rejects.toMatchObject({ status: 404 });
    await expect(voice.watchStream(io, "b", "ghost")).rejects.toMatchObject({ status: 404 });
    expect(viewer.data.viewing).toBeUndefined();
  });

  it("watches one stream at a time: switching leaves the previous one", async () => {
    const first = socket("a", { voiceChannelId: "sala", sharing: true });
    const second = socket("c", { voiceChannelId: "sala", sharing: true });
    const viewer = socket("b", { voiceChannelId: "sala", viewing: "a" });

    await voice.watchStream(server([first, second, viewer]), "b", "c");

    expect(viewer.data.viewing).toBe("c");
    expect(emit).toHaveBeenCalledWith("voice:viewer", { socketId: "b", watching: false });
    expect(emit).toHaveBeenCalledWith("voice:viewer", { socketId: "b", watching: true });
  });
});

describe("unwatchStream", () => {
  it("clears the viewer and tells the streamer to stop sending", async () => {
    const viewer = socket("b", { voiceChannelId: "sala", viewing: "a" });

    await voice.unwatchStream(server([viewer]), "b");

    expect(viewer.data.viewing).toBeUndefined();
    expect(emit).toHaveBeenCalledWith("voice:viewer", { socketId: "b", watching: false });
  });

  it("leaving the call also leaves the stream", async () => {
    const viewer = socket("b", { voiceChannelId: "sala", viewing: "a" });

    await voice.leave(server([viewer]), "b");

    expect(viewer.data.viewing).toBeUndefined();
    expect(emit).toHaveBeenCalledWith("voice:viewer", { socketId: "b", watching: false });
  });
});

describe("canSignal", () => {
  it("allows signaling only between sockets in the same room", () => {
    const a = socket("a", { voiceChannelId: "sala" });
    const b = socket("b", { voiceChannelId: "sala" });
    const c = socket("c", { voiceChannelId: "outra" });
    const d = socket("d");
    const io = server([a, b, c, d]);

    expect(voice.canSignal(io, "a", "b")).toBe(true);
    expect(voice.canSignal(io, "a", "c")).toBe(false);
    expect(voice.canSignal(io, "a", "d")).toBe(false);
    expect(voice.canSignal(io, "d", "a")).toBe(false);
    expect(voice.canSignal(io, "a", "unknown")).toBe(false);
  });
});
