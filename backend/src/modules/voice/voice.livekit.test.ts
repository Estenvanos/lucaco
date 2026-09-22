import { describe, expect, it } from "@jest/globals";
import jwt from "jsonwebtoken";
import { issueToken } from "./voice.livekit.js";

const base = { socketId: "sock-1", username: "ana", channelId: "sala" };
const grants = async (canSpeak: boolean, canStream: boolean) => {
  const token = await issueToken({ ...base, canSpeak, canStream }, "key", "secret");
  return jwt.verify(token, "secret") as { sub: string; video: Record<string, unknown> };
};

describe("issueToken", () => {
  it("binds identity to the socket and the room to the channel", async () => {
    const { sub, video } = await grants(true, false);
    expect(sub).toBe("sock-1");
    expect(video).toMatchObject({ roomJoin: true, room: "sala", canSubscribe: true });
  });

  it("listener: subscribes only, cannot publish", async () => {
    const { video } = await grants(false, false);
    expect(video.canPublish).toBe(false);
    expect(video.canPublishSources).toEqual([]);
  });

  it("speaker may publish the microphone but not the screen", async () => {
    const { video } = await grants(true, false);
    expect(video.canPublishSources).toEqual(["microphone"]);
  });

  it("streamer may also publish the tab and its audio", async () => {
    const { video } = await grants(true, true);
    expect(video.canPublishSources).toEqual(["microphone", "screen_share", "screen_share_audio"]);
  });
});
