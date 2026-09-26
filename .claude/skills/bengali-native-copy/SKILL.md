---
name: bengali-native-copy
description: Use when writing or changing any copy-generation prompt, the Bengali/English system prompts, the nativeness critic, the independence check, or the hoichoi brand voice. Covers how to make Bengali output native (not translated) and how to prove it.
---

# Native Bengali + English copy for hoichoi

Judges will read a Bengali brief's output specifically looking for machine-translation feel. This is the "toughest test".

## Architecture rules
- **Never translate.** For each (channel × language), make its own call with the *brief + creative plan* as input. The bn call never sees the en output, and vice versa.
- **The bn system prompt is written in Bengali** (see `prompts.md`). A Bengali instruction frame pulls the model into Bengali idiom far better than an English prompt that says "write in Bengali".
- The brief may arrive in Bengali or English. Either way, both languages generate from the brief.
- The bn and en hooks should be **different ideas**, not the same line in two languages. Tell each prompt to pick its own hook from the plan's angle.
- Output is Zod JSON: `{ hook, caption, cta, hashtags[], altText }`. Validate lengths in code against channel specs (from `channel-tailoring`), and never trust the model's own count.

## hoichoi voice
- A Bengali OTT platform: thrillers, detective series, family drama, comedy, originals. The audience is Bengalis in Kolkata, across Bengal and in the diaspora.
- Witty, bold, culturally fluent. Pop-culture nods (adda, para, Durga Pujo, Sunday lunch, rain-and-khichuri, detective-story fandom) are fine when they fit.
- Brand name is always written `hoichoi` (lowercase, Latin script), even inside Bengali copy: `hoichoi-তে`.
- Address: **আপনি** by default. **তুমি** only for playful, youth-targeted posts, and it must stay consistent within a post.

## What native Bengali social copy looks like
- **চলিত ভাষা** (colloquial standard), Kolkata register. Never সাধু forms (করিতেছে, তাহার, হইবে).
- **Natural code-mixing** in Bengali script where people actually say it: সিরিজ, ট্রেলার, এপিসোড, স্ট্রিমিং, মিস করবেন না. Avoid forced shuddho coinages nobody uses (চলচ্চিত্র-ধারাবাহিক).
- Short, punchy, spoken rhythm. Verb-final sentences. Fragments are fine: "রাত ১২টা। ফাঁকা বাড়ি।"
- Bengali numerals in bn copy (১৭ অক্টোবর), except inside hashtags.
- Idioms and colloquial particles (তো, কিন্তু, নাকি, রে, এবার) where natural. Don't overdo it.
- Hashtags: 1–2 Latin brand/show tags plus at most 1–2 Bengali tags. Bengali hashtags do get used, but sparingly.

## Translationese red flags (the critic must catch these)
| Flag | Bad (translated feel) | Native |
|---|---|---|
| Calqued question hooks | আপনি কি প্রস্তুত...? | তৈরি তো? / এবার আর ঘুম হবে না। |
| Formal Sanskritised verbs | প্রদর্শিত হবে, উপলব্ধ, সম্প্রচারিত | দেখা যাবে, পাওয়া যাবে, আসছে |
| `এবং` everywhere | রহস্য এবং রোমাঞ্চ | রহস্য আর রোমাঞ্চ |
| Pronoun-heavy English order | এটি একটি সিরিজ যেটি আপনাকে... | Drop the pronoun; restructure around the verb |
| English idiom rendered literally | এর জন্য অপেক্ষা করুন ("wait for it") | আসছে... / চোখ রাখুন |
| `এটি / সেটি` in casual copy | এটি দেখুন | এটা দেখুন / just the verb |
| Over-polite stacked verbs | দেখতে ভুলবেন না অবশ্যই | মিস করবেন না |
| Sadhu–chalit mixing | করিতেছে + করছে | chalit only |

## Nativeness critic (`lib/ai/critic.ts`)
Runs on every bn variant, in its own call, persona: "a Kolkata social-media editor who has written for Bengali OTT brands". Returns:
```json
{ "score": 1-5, "register": "chalit|sadhu|mixed", "flags": [{ "phrase": "...", "why": "...", "rewrite": "..." }], "verdict": "native|translated-feel" }
```
- score < 4 → regenerate once with the flags passed in as notes, then keep the better one. Show score and flags on the review screen.
- **Independence check:** give the judge the bn and en captions and ask "Is one a translation of the other? yes/no + reason". Store it and show it as a badge. Expected answer: no.

## English copy is native too
Indian-English social register as hoichoi's own handles write it. No generic US ad-speak ("Get ready for the ride of your life!"). Short, witty, with Bengali cultural hooks allowed in Latin script (e.g. "adda", "pujo").

See `examples.md` for few-shot examples (use them in the prompts) and `prompts.md` for the system prompts.
