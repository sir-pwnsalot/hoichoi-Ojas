import type { Channel, Lang } from "../src/lib/types";

// 4 weeks of hoichoi history: 6 concepts × 3 channels × 2 langs.
// bn and en were written separately per channel (different angle, not a
// translation) — see .claude/skills/bengali-native-copy.

export interface HistPost {
  hook: string;
  caption: string;
  cta: string;
  ctaType: "question" | "comment" | "watch" | "link";
  hashtags: string[];
}

export interface HistConcept {
  key: string;
  show: string; // Latin, used on the placeholder image
  name: string;
  keyMessage: string;
  colors: [string, string];
  posts: Record<Channel, Record<Lang, HistPost>>;
}

export const HISTORY: HistConcept[] = [
  {
    key: "c1",
    show: "Byomkesh",
    name: "Byomkesh — new season trailer",
    keyMessage: "ব্যোমকেশের নতুন সিজনের ট্রেলার এসেছে, শুক্রবার থেকে স্ট্রিমিং।",
    colors: ["#1b1f3a", "#b3261e"],
    posts: {
      instagram: {
        bn: {
          hook: "সত্যান্বেষী ফিরছে।",
          caption:
            "সত্যান্বেষী ফিরছে। এবার রহস্যটা আরও গভীরে। 🔍\nট্রেলারটা দেখে বলুন তো — খুনিটা কে হতে পারে? কমেন্টে আপনার আন্দাজ লিখে যান 👇",
          cta: "কমেন্টে আন্দাজ লিখুন",
          ctaType: "question",
          hashtags: ["#hoichoi", "#Byomkesh", "#ব্যোমকেশ"],
        },
        en: {
          hook: "Satyanweshi is back.",
          caption:
            "Satyanweshi is back — and this time the rot goes all the way to the top. 🔍\nTrailer's out. New season streams Friday, only on hoichoi.",
          cta: "Watch the trailer",
          ctaType: "watch",
          hashtags: ["#hoichoi", "#Byomkesh", "#BengaliWebSeries"],
        },
      },
      x: {
        bn: {
          hook: "শুক্রবার ব্যোমকেশ।",
          caption: "শুক্রবার ব্যোমকেশ। ট্রেলার দেখে নিন — এবার সন্দেহের তালিকা কিন্তু লম্বা।",
          cta: "ট্রেলার দেখুন",
          ctaType: "link",
          hashtags: ["#hoichoi", "#Byomkesh", "#ব্যোমকেশ", "#BengaliWebSeries", "#NewSeason"],
        },
        en: {
          hook: "Nobody in that house is innocent.",
          caption: "Byomkesh returns Friday. Nobody in that house is innocent — not even the one serving tea. Trailer 👇",
          cta: "Trailer link",
          ctaType: "link",
          hashtags: ["#hoichoi", "#Byomkesh"],
        },
      },
      youtube: {
        bn: {
          hook: "শেষ ফ্রেমটা মিস করবেন না 😳 | ব্যোমকেশ",
          caption: "ব্যোমকেশের নতুন রহস্য। শেষ ফ্রেমটা দেখে কার কথা মনে হল? কমেন্টে বলুন।",
          cta: "কমেন্টে বলুন",
          ctaType: "comment",
          hashtags: ["#hoichoi", "#Byomkesh", "#Shorts"],
        },
        en: {
          hook: "Watch till the last frame 😳 | Byomkesh",
          caption: "One clue, one lie, one very calm detective. New season on hoichoi this Friday.",
          cta: "Stream Friday",
          ctaType: "watch",
          hashtags: ["#hoichoi", "#Byomkesh", "#Shorts"],
        },
      },
    },
  },
  {
    key: "c2",
    show: "Mandaar",
    name: "Mandaar — weekend binge push",
    keyMessage: "উইকেন্ডে মন্দার একটানা দেখে ফেলার ডাক।",
    colors: ["#0f2e2b", "#c9a227"],
    posts: {
      instagram: {
        bn: {
          hook: "উইকেন্ড প্ল্যান? মন্দার।",
          caption: "শনিবার রাত, বাইরে বৃষ্টি, হাতে মুড়ি। বাকিটা মন্দার সামলে নেবে। 🌧️\nপুরো সিজন এখন hoichoi-তে।",
          cta: "পুরো সিজন দেখুন",
          ctaType: "watch",
          hashtags: ["#hoichoi", "#Mandaar", "#উইকেন্ড"],
        },
        en: {
          hook: "Your weekend, sorted.",
          caption:
            "Macbeth, but make it a fishing village in Bengal. 🌊\nWhich character would you trust the least? Tell us below 👇",
          cta: "Tell us below",
          ctaType: "question",
          hashtags: ["#hoichoi", "#Mandaar", "#WeekendBinge"],
        },
      },
      x: {
        bn: {
          hook: "এই উইকেন্ডে মন্দার।",
          caption: "এই উইকেন্ডে একটাই কাজ — মন্দার শেষ করা। লিংক নিচে।",
          cta: "লিংক নিচে",
          ctaType: "link",
          hashtags: ["#hoichoi", "#Mandaar"],
        },
        en: {
          hook: "Ambition, prophecy, a lot of salt air.",
          caption: "Ambition, prophecy and a lot of salt air. Mandaar is the weekend binge you didn't plan for.",
          cta: "Binge now",
          ctaType: "link",
          hashtags: ["#hoichoi", "#Mandaar", "#Macbeth", "#WeekendBinge", "#BengaliWebSeries"],
        },
      },
      youtube: {
        bn: {
          hook: "লাইলির এই দৃশ্যটা এখনও ভোলা যায় না | মন্দার",
          caption: "মন্দারের সবচেয়ে ঠান্ডা মুহূর্ত। পুরো সিরিজ hoichoi-তে।",
          cta: "পুরো সিরিজ দেখুন",
          ctaType: "watch",
          hashtags: ["#hoichoi", "#Mandaar", "#Shorts"],
        },
        en: {
          hook: "The coldest scene in Mandaar | hoichoi",
          caption: "Thirty seconds, zero dialogue, all dread. Which scene gave you chills? Comment 👇",
          cta: "Comment your scene",
          ctaType: "comment",
          hashtags: ["#hoichoi", "#Mandaar", "#Shorts"],
        },
      },
    },
  },
  {
    key: "c3",
    show: "Feluda Pherot",
    name: "Feluda Pherot — episode drop",
    keyMessage: "ফেলুদা ফেরত-এর নতুন এপিসোড আজ রাত থেকে।",
    colors: ["#2b1a0e", "#e07a1f"],
    posts: {
      instagram: {
        bn: {
          hook: "মগজাস্ত্র রেডি?",
          caption: "মগজাস্ত্রে শান দেওয়া হয়ে গেছে। তোপসে তৈরি, জটায়ু একটু নার্ভাস। 😄\nনতুন এপিসোড আজ রাত ৮টায়।",
          cta: "আজ রাত ৮টায় দেখুন",
          ctaType: "watch",
          hashtags: ["#hoichoi", "#Feluda", "#ফেলুদা"],
        },
        en: {
          hook: "Feluda's back on the case.",
          caption:
            "Magajastra, fully charged. Topshe's taking notes, Jatayu's already lost. 😄\nWho cracks it first — you or Feluda? Drop your theory 👇",
          cta: "Drop your theory",
          ctaType: "question",
          hashtags: ["#hoichoi", "#Feluda", "#FeludaPherot"],
        },
      },
      x: {
        bn: {
          hook: "আজ রাতে ফেলুদা।",
          caption: "আজ রাত ৮টা। ফেলুদা, তোপসে আর একটা ভাঙা তালা। বাকিটা এপিসোডে।",
          cta: "এপিসোড লিংক",
          ctaType: "link",
          hashtags: ["#hoichoi", "#Feluda", "#ফেলুদা", "#FeludaPherot", "#NewEpisode"],
        },
        en: {
          hook: "A broken lock and a very sharp mind.",
          caption: "New Feluda Pherot episode tonight, 8 PM. A broken lock, a missing diary, one very sharp mind.",
          cta: "Watch tonight",
          ctaType: "link",
          hashtags: ["#hoichoi", "#Feluda"],
        },
      },
      youtube: {
        bn: {
          hook: "জটায়ুর এই লাইনটা 😂 | ফেলুদা ফেরত",
          caption: "জটায়ু যতবার মুখ খোলেন, ততবার হাসি। আপনার প্রিয় জটায়ু-লাইন কোনটা? কমেন্টে লিখুন।",
          cta: "কমেন্টে লিখুন",
          ctaType: "comment",
          hashtags: ["#hoichoi", "#Feluda", "#Shorts"],
        },
        en: {
          hook: "Jatayu never misses 😂 | Feluda Pherot",
          caption: "Lalmohan babu, timing: flawless. New episode streaming now on hoichoi.",
          cta: "Stream now",
          ctaType: "watch",
          hashtags: ["#hoichoi", "#Feluda", "#Shorts"],
        },
      },
    },
  },
  {
    key: "c4",
    show: "Dhonoda",
    name: "Dhonoda — comedy clip week",
    keyMessage: "ধনঞ্জয়-দার হাসির সিরিজ, ছোট ক্লিপ দিয়ে নতুন দর্শক টানা।",
    colors: ["#3a0f3a", "#f2b705"],
    posts: {
      instagram: {
        bn: {
          hook: "পাড়ার আড্ডায় ধনদা ঢুকলে যা হয়",
          caption: "পাড়ার আড্ডায় ধনদা ঢুকলেই প্ল্যান বদলে যায়। 😂\nআপনার পাড়ার 'ধনদা' কে? ট্যাগ করুন!",
          cta: "আপনার ধনদাকে ট্যাগ করুন",
          ctaType: "comment",
          hashtags: ["#hoichoi", "#Dhonoda", "#আড্ডা"],
        },
        en: {
          hook: "Every para has one.",
          caption: "Every para has a Dhonoda. Most of them owe you money. 😂\nFull series streaming on hoichoi.",
          cta: "Stream the series",
          ctaType: "watch",
          hashtags: ["#hoichoi", "#Dhonoda", "#BengaliComedy"],
        },
      },
      x: {
        bn: {
          hook: "ধনদা আবার ঝামেলা পাকিয়েছে।",
          caption: "ধনদা আবার ঝামেলা পাকিয়েছে। এবার গোটা পাড়া জড়িয়ে গেছে। 😂",
          cta: "দেখুন",
          ctaType: "link",
          hashtags: ["#hoichoi", "#Dhonoda"],
        },
        en: {
          hook: "Dhonoda has a plan. That's the problem.",
          caption: "Dhonoda has a plan. That's the problem. Full series on hoichoi 👇",
          cta: "Full series",
          ctaType: "link",
          hashtags: ["#hoichoi", "#Dhonoda", "#BengaliComedy", "#Comedy", "#WebSeries"],
        },
      },
      youtube: {
        bn: {
          hook: "ধনদার এই বুদ্ধি 😂 | hoichoi",
          caption: "ধনদার বুদ্ধি আর পাড়ার ধৈর্য — কে জিতবে? পুরো সিরিজ hoichoi-তে।",
          cta: "পুরো সিরিজ দেখুন",
          ctaType: "watch",
          hashtags: ["#hoichoi", "#Dhonoda", "#Shorts"],
        },
        en: {
          hook: "Dhonoda's genius plan 😂 | hoichoi",
          caption: "Forty seconds of pure para chaos. Rate this plan out of 10 in the comments.",
          cta: "Rate it in comments",
          ctaType: "question",
          hashtags: ["#hoichoi", "#Dhonoda", "#Shorts"],
        },
      },
    },
  },
  {
    key: "c5",
    show: "Montu Pilot",
    name: "Montu Pilot — season finale",
    keyMessage: "মন্টু পাইলটের ফিনালে আসছে, শেষ এপিসোডের আগে উত্তেজনা তোলা।",
    colors: ["#0b0b0b", "#d7263d"],
    posts: {
      instagram: {
        bn: {
          hook: "শেষ রাতটা মন্টুর।",
          caption: "কলকাতার রাত, শেষ ডেলিভারি, আর একটা ভুল নাম। 🌃\nফিনালের আগে বলুন — মন্টু বাঁচবে তো?",
          cta: "কমেন্টে বলুন",
          ctaType: "question",
          hashtags: ["#hoichoi", "#MontuPilot", "#মন্টুপাইলট"],
        },
        en: {
          hook: "One last run.",
          caption: "Calcutta nights, one last delivery, and a name he should never have said. 🌃\nThe finale drops Thursday.",
          cta: "Finale Thursday",
          ctaType: "watch",
          hashtags: ["#hoichoi", "#MontuPilot", "#Finale"],
        },
      },
      x: {
        bn: {
          hook: "বৃহস্পতিবার ফিনালে।",
          caption: "বৃহস্পতিবার মন্টু পাইলটের ফিনালে। হিসেব এবার মেটাতেই হবে।",
          cta: "রিমাইন্ডার সেট করুন",
          ctaType: "link",
          hashtags: ["#hoichoi", "#MontuPilot", "#মন্টুপাইলট", "#Finale", "#BengaliWebSeries"],
        },
        en: {
          hook: "Every debt gets collected.",
          caption: "Every debt in this city gets collected. Montu Pilot finale, Thursday on hoichoi.",
          cta: "Set a reminder",
          ctaType: "link",
          hashtags: ["#hoichoi", "#MontuPilot"],
        },
      },
      youtube: {
        bn: {
          hook: "মন্টুর শেষ চাল? | ফিনালে বৃহস্পতিবার",
          caption: "মন্টুর শেষ চালটা কী হবে? কমেন্টে আপনার থিওরি লিখুন। ফিনালে বৃহস্পতিবার।",
          cta: "থিওরি লিখুন",
          ctaType: "question",
          hashtags: ["#hoichoi", "#MontuPilot", "#Shorts"],
        },
        en: {
          hook: "Montu's last move | Finale Thursday",
          caption: "The city's quiet. Too quiet. Montu Pilot finale streams Thursday.",
          cta: "Stream Thursday",
          ctaType: "watch",
          hashtags: ["#hoichoi", "#MontuPilot", "#Shorts"],
        },
      },
    },
  },
  {
    key: "c6",
    show: "Pujo Specials",
    name: "Pujo specials — collection",
    keyMessage: "পুজোর ছুটিতে hoichoi-এর স্পেশাল কালেকশন।",
    colors: ["#5a0f0f", "#ffb400"],
    posts: {
      instagram: {
        bn: {
          hook: "প্যান্ডেল থেকে ফিরে কী দেখবেন?",
          caption: "ঠাকুর দেখা শেষ, পা ব্যথা, এবার সোফা। 🪔\nপুজোর স্পেশাল কালেকশন এখন hoichoi-তে। আপনার পুজো-বিঞ্জ লিস্টে প্রথম কোনটা?",
          cta: "লিস্ট কমেন্টে দিন",
          ctaType: "question",
          hashtags: ["#hoichoi", "#DurgaPujo", "#পুজো"],
        },
        en: {
          hook: "Pandal-hopping done. Now what?",
          caption: "Pandal-hopping done, feet officially retired. 🪔\nThe hoichoi Pujo collection is here — thrillers, comedies, and one very long adda.",
          cta: "Browse the collection",
          ctaType: "watch",
          hashtags: ["#hoichoi", "#DurgaPujo", "#PujoBinge"],
        },
      },
      x: {
        bn: {
          hook: "পুজোর ছুটি = hoichoi",
          caption: "পুজোর ছুটিতে ঠাকুর দেখা আর বিঞ্জ — দুটোই চলুক। স্পেশাল কালেকশন নিচে।",
          cta: "কালেকশন দেখুন",
          ctaType: "link",
          hashtags: ["#hoichoi", "#DurgaPujo"],
        },
        en: {
          hook: "Pujo plans: pandals by day, hoichoi by night.",
          caption: "Pujo plans: pandals by day, hoichoi by night. Our festive collection is live 👇",
          cta: "See the collection",
          ctaType: "link",
          hashtags: ["#hoichoi", "#DurgaPujo", "#PujoBinge", "#Festive", "#BengaliWebSeries"],
        },
      },
      youtube: {
        bn: {
          hook: "পুজোয় কী দেখবেন? ৩০ সেকেন্ডে | hoichoi",
          caption: "পুজোর ছুটির জন্য ৩টে সিরিজ, ৩০ সেকেন্ডে। আপনি কোনটা আগে দেখবেন?",
          cta: "কমেন্টে বলুন",
          ctaType: "question",
          hashtags: ["#hoichoi", "#DurgaPujo", "#Shorts"],
        },
        en: {
          hook: "Your Pujo watchlist in 30 sec | hoichoi",
          caption: "Three shows, thirty seconds, zero pandal queues. Streaming now on hoichoi.",
          cta: "Stream now",
          ctaType: "watch",
          hashtags: ["#hoichoi", "#DurgaPujo", "#Shorts"],
        },
      },
    },
  },
];

export const BRAND_KIT = {
  id: "hoichoi",
  name: "hoichoi",
  colors: { primary: "#E50914", ink: "#111111", paper: "#FFFFFF", accent: "#FFB400" },
  fonts: { bn: "Hind Siliguri", bnAlt: "Noto Sans Bengali", en: "Inter" },
  voice:
    "Witty, bold, culturally fluent Bengali OTT voice. bn: chalit, Kolkata register, আপনি by default. en: Indian-English social register, no US ad-speak. Brand always 'hoichoi' lowercase Latin.",
  logoUrl: null as string | null,
  bannedPhrases: ["আপনি কি প্রস্তুত", "প্রদর্শিত হবে", "উপলব্ধ", "Get ready for the ride of your life"],
};
