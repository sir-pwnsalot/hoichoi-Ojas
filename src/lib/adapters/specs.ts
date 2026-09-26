import type { AssetFormat, Channel } from "./types";

// Mock spec based on public platform limits (show this label in the UI).
export const SPEC_LABEL = "mock spec based on public platform limits";

export interface ChannelSpec {
  channel: Channel;
  label: string;
  formats: AssetFormat[];
  // Allowed aspect ratios (w/h). Either a set of exact targets or a [min, max] range; ±1% tolerance.
  aspect: { targets: number[]; label: string } | { min: number; max: number; label: string };
  minWidth: number;
  minHeight: number;
  maxBytes: number;
  duration: { minSec: number; maxSec: number } | null;
  caption: { max: number; counting: "graphemes" | "twitter-weighted"; field: string };
  title: { max: number } | null;
  maxHashtags: number;
}

export const ASPECT_TOLERANCE = 0.01;
const MB = 1024 * 1024;

export const SPECS: Record<Channel, ChannelSpec> = {
  instagram: {
    channel: "instagram",
    label: "Instagram (feed image)",
    formats: ["jpeg", "png"],
    aspect: { min: 4 / 5, max: 1.91, label: "4:5 … 1.91:1" },
    minWidth: 1080,
    minHeight: 0,
    maxBytes: 8 * MB,
    duration: null,
    caption: { max: 2200, counting: "graphemes", field: "caption" },
    title: null,
    maxHashtags: 30,
  },
  x: {
    channel: "x",
    label: "X (image post)",
    formats: ["jpeg", "png", "webp"],
    aspect: { targets: [16 / 9], label: "16:9" },
    minWidth: 600,
    minHeight: 335,
    maxBytes: 5 * MB,
    duration: null,
    caption: { max: 280, counting: "twitter-weighted", field: "text" },
    title: null,
    maxHashtags: 3, // house rule
  },
  youtube: {
    channel: "youtube",
    label: "YouTube Shorts",
    formats: ["mp4"],
    aspect: { targets: [9 / 16], label: "9:16" },
    minWidth: 1080,
    minHeight: 1920,
    maxBytes: 100 * MB, // mock
    duration: { minSec: 3, maxSec: 60 }, // mock
    caption: { max: 5000, counting: "graphemes", field: "description" },
    title: { max: 100 },
    maxHashtags: 15, // house rule
  },
};
