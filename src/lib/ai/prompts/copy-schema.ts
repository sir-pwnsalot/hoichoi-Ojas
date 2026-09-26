import { z } from "zod";

// Shared output contract for both the bn and en copy calls, per
// bengali-native-copy skill: `{ hook, caption, cta, hashtags[], altText }`.
export const copySchema = z.object({
  hook: z.string().min(1),
  caption: z.string().min(1),
  cta: z.string().min(1),
  hashtags: z.array(z.string()),
  altText: z.string().min(1),
});

export type CopyResult = z.infer<typeof copySchema>;
