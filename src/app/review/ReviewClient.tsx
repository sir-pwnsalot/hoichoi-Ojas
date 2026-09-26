"use client";

import { useState } from "react";
import type { Concept, Variant } from "@/lib/types";
import { ConceptGroup } from "./ConceptGroup";

export function ReviewClient({ initialConcepts, initialVariants }: { initialConcepts: Concept[], initialVariants: Variant[] }) {
  const [variants, setVariants] = useState<Variant[]>(initialVariants);

  // Group variants by conceptId
  const variantsByConcept = initialConcepts.map(c => ({
    concept: c,
    variants: variants.filter(v => v.conceptId === c.id)
  })).filter(g => g.variants.length > 0);

  if (variantsByConcept.length === 0) {
    return (
      <div className="text-center py-20 bg-zinc-900 border border-zinc-800 rounded-lg">
        <p className="text-zinc-400">No variants to review. Go to Studio to generate a campaign.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      {variantsByConcept.map(group => (
        <ConceptGroup 
          key={group.concept.id} 
          concept={group.concept} 
          variants={group.variants} 
          onUpdateVariant={(updated) => {
            setVariants(prev => prev.map(v => v.id === updated.id ? updated : v));
          }}
          onReplaceVariant={(oldId, newVariant) => {
            setVariants(prev => prev.map(v => v.id === oldId ? newVariant : v));
          }}
        />
      ))}
    </div>
  );
}
