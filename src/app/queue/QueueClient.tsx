"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarClock, FastForward, CheckCircle, AlertTriangle, Play, ChevronDown, ChevronUp, XCircle, FileWarning } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { advanceClock, scheduleVariant, submitRuleBreaker, type RuleBreakerKind, type RuleBreakerPayload } from "@/lib/actions";
import type { Variant, PublishAttempt, ClockState, Rejection } from "@/lib/types";

export function QueueClient({
  initialVariants,
  initialAttempts,
  initialClock,
}: {
  initialVariants: Variant[];
  initialAttempts: PublishAttempt[];
  initialClock: ClockState;
}) {
  const router = useRouter();
  const [clock, setClock] = useState(initialClock);
  const [loading, setLoading] = useState(false);
  const [scheduleDates, setScheduleDates] = useState<Record<string, string>>({});
  
  // Rule breaker state
  const [customPayload, setCustomPayload] = useState<RuleBreakerPayload>({
    channel: "instagram",
    caption: "",
  });
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [showSpecs, setShowSpecs] = useState(false);

  const approvedVariants = initialVariants.filter(v => v.status === "approved");
  
  const timelineVariants = initialVariants
    .filter(v => ["scheduled", "published", "rejected"].includes(v.status))
    // We sort by something? Maybe createdAt or if scheduledFor existed.
    // For now just map them.
    .map(v => {
      // Find latest attempt to show externalId or rejection reasons
      const attempt = initialAttempts.find(a => a.variantId === v.id);
      return { ...v, latestAttempt: attempt };
    })
    .sort((a, b) => {
      const timeA = a.latestAttempt ? new Date(a.latestAttempt.attemptedAt).getTime() : new Date(a.createdAt).getTime();
      const timeB = b.latestAttempt ? new Date(b.latestAttempt.attemptedAt).getTime() : new Date(b.createdAt).getTime();
      return timeB - timeA;
    });

  const handleAdvance = async (ms: number) => {
    setLoading(true);
    try {
      const newClock = await advanceClock(ms);
      setClock(newClock);
      router.refresh();
      toast.success(`Clock advanced by ${ms / 3600000}h`);
    } catch (e: any) {
      toast.error(e.message || "Failed to advance clock");
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async (variantId: string) => {
    const dateStr = scheduleDates[variantId];
    if (!dateStr) {
      toast.error("Please select a date and time");
      return;
    }
    setLoading(true);
    try {
      await scheduleVariant(variantId, new Date(dateStr));
      toast.success("Variant scheduled successfully");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to schedule variant");
    } finally {
      setLoading(false);
    }
  };

  const handleRuleBreaker = async (kind: RuleBreakerKind) => {
    setLoading(true);
    try {
      const res = await submitRuleBreaker(kind, kind === "custom" ? customPayload : undefined);
      if (!res.ok && res.rejections?.length > 0) {
        setRejections(res.rejections);
        toast.error("Submission rejected by platform");
      } else {
        setRejections([]);
        toast.success("Submission accepted");
      }
      router.refresh(); // to update publish attempts log
    } catch (e: any) {
      toast.error(e.message || "Failed to submit rule breaker");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      {/* Left Column: Schedule & Timeline */}
      <div className="xl:col-span-2 space-y-8">
        
        {/* Clock Control */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3 border-b border-zinc-800 flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-blue-400" />
              Simulator Clock
            </CardTitle>
            <div className="text-sm font-mono text-zinc-400">
              Current: {format(new Date(clock.now), "MMM d, HH:mm")}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleAdvance(6 * 3600000)} disabled={loading} className="bg-zinc-800 border-zinc-700">
                <FastForward className="w-4 h-4 mr-2" /> +6h
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleAdvance(24 * 3600000)} disabled={loading} className="bg-zinc-800 border-zinc-700">
                <FastForward className="w-4 h-4 mr-2" /> +1d
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleAdvance(7 * 24 * 3600000)} disabled={loading} className="bg-zinc-800 border-zinc-700">
                <FastForward className="w-4 h-4 mr-2" /> +7d
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Ready to schedule */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Ready to Schedule
          </h2>
          {approvedVariants.length === 0 ? (
            <div className="p-8 text-center border border-zinc-800 rounded bg-zinc-900/50 text-zinc-500">
              No approved variants available. Go to the Review tab to approve some.
            </div>
          ) : (
            <div className="grid gap-4">
              {approvedVariants.map(v => (
                <div key={v.id} className="flex flex-col md:flex-row gap-4 p-4 rounded bg-zinc-900 border border-zinc-800 items-start md:items-center">
                  <div className="w-24 h-24 shrink-0 bg-black rounded overflow-hidden">
                    {v.assetUrl ? (
                       v.format === "video" ? (
                         <video src={v.assetUrl} className="w-full h-full object-cover opacity-80" />
                       ) : (
                         <img src={v.assetUrl} className="w-full h-full object-cover opacity-80" />
                       )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600">No Asset</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-2 mb-1">
                      <Badge variant="outline" className="text-zinc-300 uppercase">{v.channel}</Badge>
                      <Badge variant="outline" className="text-zinc-400 uppercase">{v.lang}</Badge>
                    </div>
                    <p className="text-sm text-zinc-200 truncate">{v.caption}</p>
                    <p className="text-xs text-zinc-500 font-mono mt-1">{v.id}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-4 md:mt-0 w-full md:w-auto">
                    <Input 
                      type="datetime-local" 
                      className="bg-zinc-950 border-zinc-700 [color-scheme:dark]"
                      value={scheduleDates[v.id] || ""}
                      onChange={e => setScheduleDates(prev => ({...prev, [v.id]: e.target.value}))}
                    />
                    <Button onClick={() => handleSchedule(v.id)} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                      Schedule
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeline Table */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Play className="w-5 h-5 text-purple-500" />
            Timeline
          </h2>
          <div className="border border-zinc-800 rounded overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Variant</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-900/50">
                {timelineVariants.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">No scheduled or published variants yet.</td>
                  </tr>
                ) : (
                  timelineVariants.map(v => (
                    <tr key={v.id}>
                      <td className="px-4 py-3">
                        <div className="font-mono text-zinc-300">{v.id}</div>
                        <div className="text-xs text-zinc-500 uppercase">{v.channel} · {v.lang}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`${
                          v.status === 'scheduled' ? 'bg-blue-900/50 text-blue-400' :
                          v.status === 'published' ? 'bg-purple-900/50 text-purple-400' :
                          'bg-red-900/50 text-red-400'
                        }`}>
                          {v.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {v.status === "published" && v.latestAttempt?.externalId && (
                          <span className="text-green-400 font-mono">{v.latestAttempt.externalId}</span>
                        )}
                        {v.status === "rejected" && v.latestAttempt?.reasons && (
                          <div className="flex flex-wrap gap-1">
                            {v.latestAttempt.reasons.map((r, i) => (
                              <Badge key={i} variant="outline" className="border-red-900/50 text-red-400 bg-red-950/30">
                                {r.code}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {v.status === "scheduled" && (
                          <span className="text-zinc-500">Waiting for tick...</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Right Column: Rule-breaker & Logs */}
      <div className="space-y-8">
        
        {/* Rule-breaker panel */}
        <Card className="bg-zinc-900 border-zinc-800 border-red-900/20">
          <CardHeader className="border-b border-zinc-800">
            <CardTitle className="text-lg flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Adapter "Toughest Test"
            </CardTitle>
            <p className="text-xs text-zinc-400 mt-1">Submit non-compliant payloads to test the platform adapter constraints.</p>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-zinc-300">Preset Violations</h3>
              <Button size="sm" variant="outline" onClick={() => handleRuleBreaker("wrong_ratio_video")} disabled={loading} className="w-full justify-start bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-white">
                <FileWarning className="w-4 h-4 mr-2 text-yellow-500" />
                1:1 Video to YouTube Shorts
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleRuleBreaker("oversized_image")} disabled={loading} className="w-full justify-start bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-white">
                <FileWarning className="w-4 h-4 mr-2 text-yellow-500" />
                11 MB Image to Instagram
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleRuleBreaker("long_caption")} disabled={loading} className="w-full justify-start bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-white">
                <FileWarning className="w-4 h-4 mr-2 text-yellow-500" />
                310-char Post to X
              </Button>
            </div>

            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <h3 className="text-sm font-medium text-zinc-300">Custom Submission</h3>
              <select 
                className="w-full bg-zinc-950 border-zinc-700 text-sm rounded p-2 text-zinc-200"
                value={customPayload.channel}
                onChange={e => setCustomPayload(prev => ({...prev, channel: e.target.value as any}))}
              >
                <option value="instagram">Instagram</option>
                <option value="x">X</option>
                <option value="youtube">YouTube</option>
              </select>
              <Input 
                placeholder="Caption text..." 
                className="bg-zinc-950 border-zinc-700 text-sm"
                value={customPayload.caption}
                onChange={e => setCustomPayload(prev => ({...prev, caption: e.target.value}))}
              />
              <Input
                type="file"
                className="bg-zinc-950 border-zinc-700 text-sm text-zinc-400 file:bg-zinc-800 file:text-zinc-300 file:border-0 file:rounded file:px-2 file:py-1 file:mr-2 hover:file:bg-zinc-700"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    setCustomPayload(prev => ({...prev, assetUrl: URL.createObjectURL(e.target.files![0])}));
                  }
                }}
              />
              <Button onClick={() => handleRuleBreaker("custom")} disabled={loading} className="w-full bg-red-900/50 hover:bg-red-900/80 text-red-100 border border-red-900">
                Submit Custom
              </Button>
            </div>

            {/* Rejection Results */}
            {rejections.length > 0 && (
              <div className="mt-6 space-y-2">
                <h3 className="text-sm font-medium text-red-400">Rejections ({rejections.length})</h3>
                {rejections.map((rej, i) => (
                  <div key={i} className="p-3 bg-red-950/20 border border-red-900/50 rounded space-y-1 text-sm">
                    <div className="flex justify-between items-center">
                      <strong className="text-red-400">{rej.code}</strong>
                      <span className="text-xs text-red-500">{rej.field}</span>
                    </div>
                    <p className="text-zinc-300">{rej.message}</p>
                    <div className="text-xs text-zinc-500 mt-2 font-mono flex items-center justify-between bg-black/20 p-1.5 rounded">
                      <span>Limit: {rej.limit}</span>
                      <span>Actual: <span className="text-red-400">{rej.actual}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mock Platform Specs */}
        <div className="border border-zinc-800 rounded bg-zinc-900">
          <button 
            className="w-full flex items-center justify-between p-4 text-left"
            onClick={() => setShowSpecs(!showSpecs)}
          >
            <span className="font-medium text-zinc-200 flex items-center gap-2">
              Mock Platform Specs
              <Badge variant="outline" className="text-xs font-normal text-zinc-500">Based on public limits</Badge>
            </span>
            {showSpecs ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
          </button>
          
          {showSpecs && (
            <div className="p-4 pt-0 border-t border-zinc-800 text-xs text-zinc-300 overflow-x-auto">
              <table className="w-full text-left mt-2">
                <thead className="text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="pb-2 pr-4"></th>
                    <th className="pb-2 pr-4">Instagram (feed image)</th>
                    <th className="pb-2 pr-4">X (image post)</th>
                    <th className="pb-2">YouTube Shorts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  <tr><td className="py-2 pr-4 text-zinc-500">Formats</td><td className="py-2 pr-4">JPEG, PNG</td><td className="py-2 pr-4">JPEG, PNG, WEBP</td><td className="py-2">MP4</td></tr>
                  <tr><td className="py-2 pr-4 text-zinc-500">Aspect</td><td className="py-2 pr-4">4:5 … 1.91:1</td><td className="py-2 pr-4">16:9 or 1:1</td><td className="py-2">9:16</td></tr>
                  <tr><td className="py-2 pr-4 text-zinc-500">Min dims</td><td className="py-2 pr-4">1080 wide</td><td className="py-2 pr-4">600×335</td><td className="py-2">1080×1920</td></tr>
                  <tr><td className="py-2 pr-4 text-zinc-500">Max file</td><td className="py-2 pr-4">8 MB</td><td className="py-2 pr-4">5 MB</td><td className="py-2">100 MB (mock)</td></tr>
                  <tr><td className="py-2 pr-4 text-zinc-500">Duration</td><td className="py-2 pr-4">–</td><td className="py-2 pr-4">–</td><td className="py-2">3–60 s (mock)</td></tr>
                  <tr><td className="py-2 pr-4 text-zinc-500">Caption</td><td className="py-2 pr-4">≤ 2200 chars</td><td className="py-2 pr-4">≤ 280 weighted</td><td className="py-2">title ≤ 100, desc ≤ 5000</td></tr>
                  <tr><td className="py-2 pr-4 text-zinc-500">Hashtags</td><td className="py-2 pr-4">≤ 30</td><td className="py-2 pr-4">≤ 3 (house rule)</td><td className="py-2">≤ 15 (house rule)</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Publish Attempts Log */}
        <div className="space-y-3">
          <h3 className="font-semibold text-zinc-100">Publish Attempt Log</h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {[...initialAttempts].sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime()).map(attempt => (
              <div key={attempt.id} className="text-xs p-3 rounded bg-zinc-900 border border-zinc-800 font-mono">
                <div className="flex justify-between text-zinc-500 mb-1">
                  <span>{format(new Date(attempt.attemptedAt), "HH:mm:ss")}</span>
                  <span>{attempt.variantId}</span>
                </div>
                {attempt.ok ? (
                  <div className="text-green-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> SUCCESS: {attempt.externalId}
                  </div>
                ) : (
                  <div className="text-red-400 flex items-start gap-1">
                    <XCircle className="w-3 h-3 shrink-0 mt-0.5" /> 
                    <div>
                      FAILED
                      <ul className="mt-1 space-y-0.5 text-red-500">
                        {attempt.reasons?.map((r, i) => (
                          <li key={i}>- {r.code}: {r.field} ({r.actual} vs {r.limit})</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
