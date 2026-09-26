import type { Concept, Variant } from "@/lib/types";
import { VariantCard } from "./VariantCard";
import { AlertCircle, Info } from "lucide-react";

export function ConceptGroup({ 
  concept, 
  variants,
  onUpdateVariant,
  onReplaceVariant 
}: { 
  concept: Concept;
  variants: Variant[];
  onUpdateVariant: (v: Variant) => void;
  onReplaceVariant: (oldId: string, newVariant: Variant) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800 pb-4">
        <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          Concept: {concept.name}
        </h2>
        
        <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded p-3 text-sm flex gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0" />
          <div className="flex-1">
            <h4 className="font-medium text-zinc-200 mb-2">Why these differ (Channel Tailoring)</h4>
            <div className="grid grid-cols-3 gap-4 text-zinc-400">
              <div><strong className="text-zinc-300">Instagram:</strong> Square/portrait, longer captions, rich hashtags, visually striking composition.</div>
              <div><strong className="text-zinc-300">X:</strong> 280 chars max, punchy hook, minimal hashtags, conversational tone.</div>
              <div><strong className="text-zinc-300">Shorts:</strong> 9:16 video, bold animated captions, high-energy hook, 1-2 key hashtags.</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {variants.map(variant => (
          <VariantCard 
            key={variant.id} 
            variant={variant}
            onUpdate={onUpdateVariant}
            onReplace={(newVariant) => onReplaceVariant(variant.id, newVariant)}
          />
        ))}
      </div>
    </div>
  );
}
