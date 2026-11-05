import { Platform } from "react-native";

// App ID fallback or process env
const DEFAULT_AGORA_APP_ID =
  process.env.EXPO_PUBLIC_AGORA_APP_ID?.replace(/"/g, "").trim() ||
  "a0000000000000000000000000000000";

class AgoraRtcEngineManager {
  private rtcClient: any = null;
  private localAudioTrack: any = null;
  private isJoined: boolean = false;
  private agoraModule: any = null;

  private async getAgoraModule() {
    if (this.agoraModule) return this.agoraModule;
    if (typeof window !== "undefined" || Platform.OS === "web") {
      try {
        const AgoraRTC = await import("agora-rtc-sdk-ng");
        this.agoraModule = AgoraRTC.default || AgoraRTC;
        return this.agoraModule;
      } catch (err) {
        console.warn("[AgoraRtcService] Could not load agora-rtc-sdk-ng:", err);
        return null;
      }
    }
    return null;
  }

  /**
   * Join an Agora Voice RTC Channel
   */
  async joinChannel(
    channelName: string,
    uid: string,
    options?: {
      appId?: string;
      token?: string | null;
      isMuted?: boolean;
      onVolumeIndicator?: (speakers: { uid: string; level: number }[]) => void;
    }
  ): Promise<boolean> {
    try {
      const AgoraRTC = await this.getAgoraModule();
      if (!AgoraRTC) {
        console.log("[AgoraRtcService] Running in audio fallback mode (WebRTC/Firestore signaling)");
        return false;
      }

      const appId = options?.appId || DEFAULT_AGORA_APP_ID;
      const token = options?.token || null;

      // Create RTC Client
      this.rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

      // Handle Remote Audio Streams
      this.rtcClient.on("user-published", async (user: any, mediaType: string) => {
        await this.rtcClient.subscribe(user, mediaType);
        if (mediaType === "audio") {
          user.audioTrack?.play();
        }
      });

      this.rtcClient.on("user-unpublished", (user: any, mediaType: string) => {
        if (mediaType === "audio") {
          user.audioTrack?.stop();
        }
      });

      // Volume indicator for active speaking
      if (options?.onVolumeIndicator) {
        this.rtcClient.enableAudioVolumeIndicator();
        this.rtcClient.on("volume-indicator", (volumes: any[]) => {
          const speakers = volumes.map((v) => ({
            uid: String(v.uid),
            level: v.level,
          }));
          options.onVolumeIndicator?.(speakers);
        });
      }

      // Join Channel
      await this.rtcClient.join(appId, channelName, token, uid);

      // Create Local Microphone Track
      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true, // Acoustic Echo Cancellation
        ANS: true, // Automatic Noise Suppression
        AGC: true, // Automatic Gain Control
      });

      // Set initial mute state
      if (options?.isMuted) {
        await this.localAudioTrack.setEnabled(false);
      }

      // Publish local audio
      await this.rtcClient.publish([this.localAudioTrack]);
      this.isJoined = true;
      console.log(`[AgoraRtcService] Joined voice channel: ${channelName}`);
      return true;
    } catch (error) {
      console.error("[AgoraRtcService] Error joining channel:", error);
      return false;
    }
  }

  /**
   * Mute or Unmute Local Microphone
   */
  async setMuted(muted: boolean): Promise<void> {
    if (this.localAudioTrack) {
      try {
        await this.localAudioTrack.setEnabled(!muted);
        console.log(`[AgoraRtcService] Local mic ${muted ? "muted" : "unmuted"}`);
      } catch (err) {
        console.error("[AgoraRtcService] Error toggling mic:", err);
      }
    }
  }

  /**
   * Leave Agora RTC Channel
   */
  async leaveChannel(): Promise<void> {
    try {
      if (this.localAudioTrack) {
        this.localAudioTrack.close();
        this.localAudioTrack = null;
      }
      if (this.rtcClient) {
        await this.rtcClient.leave();
        this.rtcClient = null;
      }
      this.isJoined = false;
      console.log("[AgoraRtcService] Left voice channel successfully.");
    } catch (error) {
      console.error("[AgoraRtcService] Error leaving channel:", error);
    }
  }
}

export const agoraRtcService = new AgoraRtcEngineManager();
