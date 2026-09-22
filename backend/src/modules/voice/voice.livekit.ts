import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";

type TokenInput = { socketId: string; username: string; channelId: string; canSpeak: boolean; canStream: boolean };

/**
 * Join token for the SFU. identity = socket id, so LiveKit participants line up with the roster
 * Socket.IO already keeps. The publish grants are what makes SPEAK/STREAM enforced server-side.
 */
export function issueToken(input: TokenInput, apiKey: string, apiSecret: string) {
  const token = new AccessToken(apiKey, apiSecret, { identity: input.socketId, name: input.username, ttl: "10m" });
  const sources: TrackSource[] = [];
  if (input.canSpeak) sources.push(TrackSource.MICROPHONE);
  if (input.canStream) sources.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);
  token.addGrant({
    roomJoin: true,
    room: input.channelId,
    canSubscribe: true,
    canPublish: sources.length > 0,
    canPublishSources: sources,
  });
  return token.toJwt();
}

/** Boot check: the server answers and accepts this key/secret (an authenticated call, not a ping). */
export const checkLivekit = (url: string, apiKey: string, apiSecret: string) =>
  new RoomServiceClient(url, apiKey, apiSecret).listRooms();
