"use client";

import { useState } from "react";
import { generateCampaign, createBrief, listVariants } from "@/lib/actions";
import type { GenerateCampaignResult } from "@/lib/actions";
import type { InsightCard, Lang, Variant, CreativePlan } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowRight, Lightbulb } from "lucide-react";
import Link from "next/link";

export function StudioClient({ initialInsights }: { initialInsights: InsightCard[] }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ variants: Variant[], languages: Lang[] } | null>(null);
  const [passcode, setPasscode] = useState("");
  
  const [selectedInsights, setSelectedInsights] = useState<Set<string>>(
    new Set(initialInsights.slice(0, 3).map(i => i.id))
  );

  const [form, setForm] = useState({
    title: "",
    show: "",
    keyMessage: "",
    audience: "",
    languages: ["bn", "en"] as Lang[],
    tone: "",
    ctaGoal: "",
    rawText: "",
    briefLang: "en" as Lang,
  });

  const toggleInsight = (id: string) => {
    const next = new Set(selectedInsights);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedInsights(next);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const brief = await createBrief({ ...form, appliedInsightIds: Array.from(selectedInsights) });
      const campaign = await generateCampaign(brief.id);
      if (!campaign.ok) {
        toast.error(campaign.error);
        return;
      }

      // Only this brief's variants, not the whole table (seeded history included).
      const generatedVariants = await listVariants({ briefId: brief.id });

      setResult({ variants: generatedVariants, languages: form.languages });
      toast.success("Campaign generated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate campaign");
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between p-6 bg-zinc-900 border border-zinc-800 rounded-lg">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Campaign Generated</h2>
            <p className="text-zinc-400 mt-1">
              Created {result.variants.length} variants across {result.languages.length} languages.
            </p>
          </div>
          <Button render={<Link href="/review" />} className="bg-red-600 hover:bg-red-700 text-white">
            Review & Approve <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {result.variants.slice(0, 3).map((v: Variant) => (
            <Card key={v.id} className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium px-2 py-1 bg-zinc-800 rounded text-zinc-300 uppercase">
                    {v.channel}
                  </span>
                  <span className="text-xs font-medium text-zinc-500 uppercase">{v.lang}</span>
                </div>
                <CardTitle className="text-sm font-medium mt-2">
                  {v.planJson?.angle || "Creative Angle"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {v.planJson?.appliedInsights && v.planJson.appliedInsights.length > 0 && (
                    <div className="text-sm space-y-2 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-md">
                      <p className="text-yellow-500/80 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5" />
                        Applied Insights
                      </p>
                      <ul className="space-y-2 pt-1">
                        {v.planJson.appliedInsights.map((ai: { howApplied: string }, idx: number) => (
                          <li key={idx} className="flex gap-2 text-zinc-200">
                            <ArrowRight className="w-4 h-4 text-yellow-500/50 shrink-0 mt-0.5" />
                            <span className="leading-snug">{ai.howApplied}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleGenerate} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
            <CardDescription>Core details for the content AI to work with.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Campaign Title</Label>
                <Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-zinc-950 border-zinc-800" placeholder="e.g. Thriller Launch" />
              </div>
              <div className="space-y-2">
                <Label>Show / Topic</Label>
                <Input required value={form.show} onChange={e => setForm({ ...form, show: e.target.value })} className="bg-zinc-950 border-zinc-800" placeholder="e.g. Byomkesh" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Key Message</Label>
              <Input required value={form.keyMessage} onChange={e => setForm({ ...form, keyMessage: e.target.value })} className="bg-zinc-950 border-zinc-800" placeholder="e.g. Premieres this Friday" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Audience</Label>
                <Input required value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })} className="bg-zinc-950 border-zinc-800" placeholder="e.g. Gen-Z suspense fans" />
              </div>
              <div className="space-y-2">
                <Label>Tone</Label>
                <Input required value={form.tone} onChange={e => setForm({ ...form, tone: e.target.value })} className="bg-zinc-950 border-zinc-800" placeholder="e.g. Dark, mysterious, urgent" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>CTA Goal</Label>
              <Input required value={form.ctaGoal} onChange={e => setForm({ ...form, ctaGoal: e.target.value })} className="bg-zinc-950 border-zinc-800" placeholder="e.g. Watch now on hoichoi" />
            </div>

            <div className="space-y-3 pt-2">
              <Label>Target Languages</Label>
              <div className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="lang-bn" 
                    checked={form.languages.includes("bn")} 
                    onCheckedChange={(c) => {
                      const next = c ? [...form.languages, "bn"] : form.languages.filter(l => l !== "bn");
                      setForm({ ...form, languages: next as Lang[] });
                    }} 
                  />
                  <label htmlFor="lang-bn" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Bengali</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="lang-en" 
                    checked={form.languages.includes("en")} 
                    onCheckedChange={(c) => {
                      const next = c ? [...form.languages, "en"] : form.languages.filter(l => l !== "en");
                      setForm({ ...form, languages: next as Lang[] });
                    }} 
                  />
                  <label htmlFor="lang-en" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">English</label>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label>Brief Content</Label>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-zinc-500">Brief Language:</span>
                  <select 
                    value={form.briefLang} 
                    onChange={e => setForm({...form, briefLang: e.target.value as Lang})}
                    className="bg-transparent text-xs text-zinc-300 border-none outline-none"
                  >
                    <option value="en">English</option>
                    <option value="bn">Bengali</option>
                  </select>
                </div>
              </div>
              <Textarea 
                value={form.rawText} 
                onChange={e => setForm({ ...form, rawText: e.target.value })} 
                className="min-h-[150px] bg-zinc-950 border-zinc-800 font-bengali resize-none" 
                placeholder="Paste the full brief here..." 
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              Insights to apply
            </CardTitle>
            <CardDescription>Select historical learnings to inject into the creative plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {initialInsights.length === 0 ? (
              <p className="text-sm text-zinc-500 italic text-center py-4">No active insights found.</p>
            ) : (
              initialInsights.map(insight => (
                <div 
                  key={insight.id} 
                  className={`p-3 rounded-md border text-sm cursor-pointer transition-colors ${
                    selectedInsights.has(insight.id) 
                      ? "bg-zinc-800 border-red-500/50 text-zinc-200" 
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  }`}
                  onClick={() => toggleInsight(insight.id)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox checked={selectedInsights.has(insight.id)} className="mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium">{insight.recommendation}</p>
                      <p className="text-xs opacity-70 line-clamp-2">{insight.statement}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Demo Passcode</Label>
              <Input 
                type="password" 
                required 
                value={passcode} 
                onChange={e => setPasscode(e.target.value)} 
                className="bg-zinc-950 border-zinc-800" 
                placeholder="Enter passcode to generate" 
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>Generate Campaign</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
