"use client";

import { useEffect, useState } from "react";
import { Variant } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getVariant } from "@/lib/actions/variants";

export function VariantDrawer({ 
  variantId, 
  onClose 
}: { 
  variantId: string | null; 
  onClose: () => void 
}) {
  const [variant, setVariant] = useState<Variant | null>(null);

  useEffect(() => {
    if (variantId) {
      setVariant(null);
      getVariant(variantId).then((v) => {
        if (v) setVariant(v);
      });
    }
  }, [variantId]);

  return (
    <Dialog open={!!variantId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Post Details: {variant?.id}</DialogTitle>
          <DialogDescription>
            {variant?.channel} · {variant?.lang.toUpperCase()}
          </DialogDescription>
        </DialogHeader>
        {variant ? (
          <div className="space-y-4">
            {variant.assetUrl || variant.baseImageUrls?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={variant.assetUrl || variant.baseImageUrls?.[0]} 
                alt="Asset" 
                className="w-full h-auto rounded-md bg-muted object-cover" 
              />
            ) : (
              <div className="w-full h-48 bg-muted rounded-md flex items-center justify-center text-sm text-muted-foreground">
                No Asset Available
              </div>
            )}
            <div className="bg-muted/30 p-3 rounded-md text-sm whitespace-pre-wrap">
              {variant.caption}
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Metrics Snapshot</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted p-2 rounded">
                  <span className="block text-muted-foreground text-xs">Status</span>
                  {variant.status}
                </div>
                <div className="bg-muted p-2 rounded">
                  <span className="block text-muted-foreground text-xs">Views/Impressions</span>
                  —
                </div>
                <div className="bg-muted p-2 rounded">
                  <span className="block text-muted-foreground text-xs">Engagement</span>
                  —
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
