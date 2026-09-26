"use client";

import { useState } from "react";
import { Report, InsightCard } from "@/lib/types";
import { generateWeeklyReport } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lightbulb, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { VariantDrawer } from "@/components/VariantDrawer";
import Link from "next/link";
import { toast } from "sonner";

export function ReportClient({ 
  initialReport,
  initialInsights
}: { 
  initialReport: Report | null;
  initialInsights: InsightCard[];
}) {
  const [report, setReport] = useState<Report | null>(initialReport);
  const [insights, setInsights] = useState<InsightCard[]>(initialInsights);
  const [loading, setLoading] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const newReport = await generateWeeklyReport(new Date());
      setReport(newReport);
      toast.success("Weekly report generated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const renderMarkdown = (text: string) => {
    // Basic parser for [P-xxxx]
    const parts = text.split(/(\[P-\d+\])/g);
    return parts.map((part, i) => {
      const match = part.match(/\[(P-\d+)\]/);
      if (match) {
        const id = match[1];
        return (
          <Badge 
            key={i} 
            variant="secondary" 
            className="mx-1 cursor-pointer hover:bg-zinc-700 font-mono text-xs"
            onClick={() => setSelectedVariantId(id)}
          >
            {id}
          </Badge>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="pt-6">
          <form onSubmit={handleGenerate} className="flex gap-4 items-end">
            <div className="space-y-2 flex-1">
              <label className="text-sm font-medium">Week Starting</label>
              <Input 
                type="date" 
                className="bg-zinc-950 border-zinc-800"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="space-y-2 flex-1">
              <label className="text-sm font-medium">Passcode</label>
              <Input 
                type="password" 
                required 
                value={passcode} 
                onChange={e => setPasscode(e.target.value)} 
                className="bg-zinc-950 border-zinc-800" 
                placeholder="Enter passcode" 
              />
            </div>
            <Button 
              type="submit" 
              className="bg-red-600 hover:bg-red-700 text-white w-48"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                "Generate weekly report"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {report && (
        <div className="space-y-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Report Document</CardTitle>
              {report.verified ? (
                <Badge className="bg-green-600/20 text-green-500 hover:bg-green-600/30 border-green-600/30 gap-1.5 py-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1.5 py-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Unverified (Claims dropped)
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="prose prose-invert max-w-none text-zinc-300">
                {/* Parse the markdown string block by block. Since we don't have a full MD parser, we'll split by double newline for paragraphs. */}
                {report.markdown.split('\n\n').map((paragraph, idx) => {
                  if (paragraph.startsWith('# ')) {
                    return <h1 key={idx} className="text-2xl font-bold text-white mb-4">{paragraph.slice(2)}</h1>;
                  }
                  if (paragraph.startsWith('## ')) {
                    return <h2 key={idx} className="text-xl font-bold text-white mb-3 mt-6">{paragraph.slice(3)}</h2>;
                  }
                  if (paragraph.startsWith('- ')) {
                    return (
                      <ul key={idx} className="list-disc pl-5 my-2 space-y-2">
                        {paragraph.split('\n').map((item, i) => (
                          <li key={i}>{renderMarkdown(item.replace(/^- /, ''))}</li>
                        ))}
                      </ul>
                    );
                  }
                  return <p key={idx} className="mb-4">{renderMarkdown(paragraph)}</p>;
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800 bg-zinc-950/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-yellow-500 text-lg">
                  <Lightbulb className="w-5 h-5" />
                  Extracted Insights
                </CardTitle>
                <p className="text-sm text-zinc-400 mt-1">
                  These insights were automatically extracted from the report and added to the knowledge base.
                </p>
              </div>
              <Button render={<Link href="/insights" />} variant="outline" className="text-xs">
                Manage all insights <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.map(insight => (
                  <div key={insight.id} className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <p className="font-medium text-sm text-zinc-200">
                        {insight.recommendation}
                      </p>
                      <Badge variant="outline" className="capitalize text-xs shrink-0 bg-zinc-950">
                        {insight.lever}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-400 italic line-clamp-2">
                      "{insight.statement}"
                    </p>
                    <div className="flex gap-1.5 pt-1">
                      {insight.evidencePostIds.map(id => (
                        <Badge 
                          key={id} 
                          variant="secondary" 
                          className="cursor-pointer hover:bg-zinc-700 font-mono text-[10px] px-1.5"
                          onClick={() => setSelectedVariantId(id)}
                        >
                          {id}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <Button render={<Link href="/studio" />} className="bg-zinc-800 hover:bg-zinc-700">
                  Send to next brief <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      <VariantDrawer variantId={selectedVariantId} onClose={() => setSelectedVariantId(null)} />
    </div>
  );
}
