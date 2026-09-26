import { instagramAdapter } from "./instagram";
import { xAdapter } from "./x";
import { youtubeAdapter } from "./youtube";
import type { Channel, ChannelAdapter } from "./types";

export const ADAPTERS: Record<Channel, ChannelAdapter> = {
  instagram: instagramAdapter,
  x: xAdapter,
  youtube: youtubeAdapter,
};

export function getAdapter(channel: Channel): ChannelAdapter {
  return ADAPTERS[channel];
}

export { SPECS, SPEC_LABEL } from "./specs";
export { AdapterRejectedError } from "./types";
export type { PublishPayload, ChannelAdapter, ValidationResult } from "./types";
