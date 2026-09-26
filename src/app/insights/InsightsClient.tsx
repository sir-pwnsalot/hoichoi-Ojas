"use client";

import { useState } from "react";
import { InsightCard } from "@/lib/types";
import { toggleInsight } from "@/lib/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { VariantDrawer } from "@/components/VariantDrawer";
import { toast } from "sonner";

export function InsightsClient({ initialInsights }: { initialInsights: InsightCard[] }) {
  const [insights, setInsights] = useState<InsightCard[]>(initialInsights);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const handleToggle = async (id: string, active: boolean) => {
    try {
      const updated = await toggleInsight(id, active);
      setInsights(insights.map(i => i.id === id ? updated : i));
      toast.success(active ? "Insight activated" : "Insight deactivated");
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle insight");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 gap-4">
        {insights.map(insight => (
          <Card key={insight.id} className={`bg-zinc-900 border-zinc-800 transition-colors ${insight.active ? 'border-yellow-500/30 bg-yellow-500/5' : ''}`}>
            <CardContent className="p-5 flex flex-col md:flex-row gap-6 justify-between md:items-center">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="capitalize text-xs bg-zinc-950">
                    Lever: {insight.lever}
                  </Badge>
                  {insight.active && (
                    <Badge className="bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 border-none">
                      Active
                    </Badge>
                  )}
                </div>
                
                <div>
                  <h3 className="font-semibold text-zinc-100 text-lg mb-1">{insight.recommendation}</h3>
                  <p className="text-sm text-zinc-400 italic">"{insight.statement}"</p>
                </div>
                
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-zinc-500 font-medium">Evidence:</span>
                  <div className="flex gap-1.5">
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
              </div>
              
              <div className="flex items-center space-x-2 shrink-0 md:pl-6 md:border-l border-zinc-800 h-full">
                <Switch 
                  id={`toggle-${insight.id}`} 
                  checked={insight.active}
                  onCheckedChange={(c: boolean) => handleToggle(insight.id, c)}
                />
                <Label htmlFor={`toggle-${insight.id}`} className="text-sm font-medium">
                  {insight.active ? 'Active' : 'Inactive'}
                </Label>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <VariantDrawer variantId={selectedVariantId} onClose={() => setSelectedVariantId(null)} />
    </div>
  );
}
