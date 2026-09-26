"use client";

import { useState, useMemo, useEffect } from "react";
import { Concept, ComparisonRow, Variant } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VariantDrawer } from "@/components/VariantDrawer";

export function AnalyticsClient({
  concepts,
  initialData,
}: {
  concepts: Concept[];
  initialData: ComparisonRow[];
}) {
  const [selectedConcept, setSelectedConcept] = useState<string>(concepts[0]?.id || "");
  const [data, setData] = useState<ComparisonRow[]>(initialData);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // When concept changes, we would fetch new data. For now, since it's mock, we'll just use initialData.
  // In a real app we'd fetch via getComparison(selectedConcept).

  const channels = ["instagram", "x", "youtube"] as const;
  
  const metrics = [
    { key: "engagementRate", label: "Engagement Rate", isPercent: true },
    { key: "shareRate", label: "Share Rate", isPercent: true },
    { key: "saveRate", label: "Save Rate", isPercent: true },
    { key: "completionProxy", label: "Completion Proxy", isPercent: true },
  ] as const;

  const formatPercent = (val: number | null) => (val != null ? `${(val * 100).toFixed(1)}%` : "-");

  // Calculate averages per channel for highlighting the best cell
  const channelAverages = useMemo(() => {
    const avgs: Record<string, Record<string, number>> = {};
    for (const metric of metrics) {
      avgs[metric.key] = {};
      for (const ch of channels) {
        const rows = data.filter((d) => d.channel === ch);
        const valid = rows.filter((d) => d[metric.key as keyof ComparisonRow] != null);
        if (valid.length > 0) {
          const sum = valid.reduce((acc, curr) => acc + (curr[metric.key as keyof ComparisonRow] as number), 0);
          avgs[metric.key][ch] = sum / valid.length;
        } else {
          avgs[metric.key][ch] = -1;
        }
      }
    }
    return avgs;
  }, [data, metrics]);


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold">Concept Analytics</h2>
        <Select value={selectedConcept} onValueChange={(val) => val && setSelectedConcept(val)}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select Concept" />
          </SelectTrigger>
          <SelectContent>
            {concepts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Like-for-Like Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                {channels.map((ch) => (
                  <TableHead key={ch} className="capitalize">
                    {ch}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((m) => {
                const maxAvg = Math.max(...channels.map((ch) => channelAverages[m.key][ch]));
                return (
                  <TableRow key={m.key}>
                    <TableCell className="font-medium">{m.label}</TableCell>
                    {channels.map((ch) => {
                      const isBest = channelAverages[m.key][ch] === maxAvg && maxAvg > -1;
                      const bnRow = data.find((d) => d.channel === ch && d.lang === "bn");
                      const enRow = data.find((d) => d.channel === ch && d.lang === "en");
                      return (
                        <TableCell key={ch} className={isBest ? "bg-primary/10" : ""}>
                          <div className="space-y-2">
                            {bnRow && bnRow[m.key as keyof ComparisonRow] != null && (
                              <div className="flex items-center gap-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge 
                                        variant="outline" 
                                        className="cursor-pointer hover:bg-muted"
                                        onClick={() => setSelectedVariantId(bnRow.variantId)}
                                      >
                                        {bnRow.variantId} (BN)
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Raw Impressions: {bnRow.impressions.toLocaleString()}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <span className="text-sm">
                                  {formatPercent(bnRow[m.key as keyof ComparisonRow] as number)}
                                </span>
                              </div>
                            )}
                            {enRow && enRow[m.key as keyof ComparisonRow] != null && (
                              <div className="flex items-center gap-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge 
                                        variant="outline" 
                                        className="cursor-pointer hover:bg-muted"
                                        onClick={() => setSelectedVariantId(enRow.variantId)}
                                      >
                                        {enRow.variantId} (EN)
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Raw Impressions: {enRow.impressions.toLocaleString()}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <span className="text-sm">
                                  {formatPercent(enRow[m.key as keyof ComparisonRow] as number)}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Engagement Rate: BN vs EN</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-around gap-4 pt-4 border-b border-l pb-2 pr-2 relative text-sm">
              <div className="absolute top-0 left-[-30px] h-full flex flex-col justify-between text-muted-foreground text-xs py-2">
                <span>10%</span>
                <span>5%</span>
                <span>0%</span>
              </div>
              {channels.map((ch) => {
                const bnRow = data.find((d) => d.channel === ch && d.lang === "bn");
                const enRow = data.find((d) => d.channel === ch && d.lang === "en");
                
                const bnHeight = bnRow ? Math.min((bnRow.engagementRate / 0.1) * 100, 100) : 0;
                const enHeight = enRow ? Math.min((enRow.engagementRate / 0.1) * 100, 100) : 0;
                
                return (
                  <div key={ch} className="flex flex-col items-center gap-2 flex-1">
                    <div className="flex items-end gap-1 w-full justify-center h-full">
                      <div className="w-10 bg-primary/80 rounded-t" style={{ height: bnHeight + "%" }} title={"BN: " + formatPercent(bnRow?.engagementRate || 0)} />
                      <div className="w-10 bg-secondary rounded-t" style={{ height: enHeight + "%" }} title={"EN: " + formatPercent(enRow?.engagementRate || 0)} />
                    </div>
                    <span className="capitalize">{ch}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 justify-center mt-4 text-sm">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-primary/80" /> Bengali</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-secondary" /> English</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>BN vs EN Performance Delta</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>BN Rate</TableHead>
                  <TableHead>EN Rate</TableHead>
                  <TableHead>Delta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((ch) => {
                  const bnRow = data.find((d) => d.channel === ch && d.lang === "bn");
                  const enRow = data.find((d) => d.channel === ch && d.lang === "en");
                  if (!bnRow || !enRow) return null;
                  
                  const delta = bnRow.engagementRate - enRow.engagementRate;
                  const deltaPercent = (delta / enRow.engagementRate) * 100;
                  const isPositive = delta > 0;
                  
                  return (
                    <TableRow key={ch}>
                      <TableCell className="capitalize font-medium">{ch}</TableCell>
                      <TableCell>{formatPercent(bnRow.engagementRate)}</TableCell>
                      <TableCell>{formatPercent(enRow.engagementRate)}</TableCell>
                      <TableCell className={isPositive ? "text-green-600" : "text-red-600"}>
                        {isPositive ? "+" : ""}{deltaPercent.toFixed(1)}% {isPositive ? "in favor of BN" : "in favor of EN"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <VariantDrawer variantId={selectedVariantId} onClose={() => setSelectedVariantId(null)} />
    </div>
  );
}
