"use client";

import { useState } from "react";
import type { Variant } from "@/lib/types";
import { approveVariant, discardVariant, regenerateVariant, editVariant } from "@/lib/actions";
import { scheduleVariant } from "@/lib/actions/publish";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, CheckCircle, RefreshCcw, Edit2, CalendarClock, Shield, AlertTriangle, AlertCircle } from "lucide-react";

export function VariantCard({ variant, onUpdate, onReplace }: { 
  variant: Variant; 
  onUpdate: (v: Variant) => void;
  onReplace: (newVariant: Variant) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(variant.caption);
  const [discardNote, setDiscardNote] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  
  const handleApprove = async () => {
    setLoading(true);
    try {
      await approveVariant(variant.id, "current-user");
      onUpdate({ ...variant, status: "approved" });
      toast.success("Variant approved");
    } catch (err: any) {
      toast.error(err.message || "Approval failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    setLoading(true);
    try {
      const updated = await editVariant(variant.id, { caption: editCaption });
      onUpdate(updated);
      setIsEditing(false);
      toast.success("Variant updated");
    } catch (err: any) {
      toast.error(err.message || "Edit failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = async () => {
    setLoading(true);
    try {
      const updated = await discardVariant(variant.id, discardNote);
      onUpdate(updated);
      toast.info("Variant discarded");
    } catch (err: any) {
      toast.error(err.message || "Discard failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setLoading(true);
    try {
      const newV = await regenerateVariant(variant.id, discardNote);
      onReplace(newV);
      toast.success("Variant regenerated");
    } catch (err: any) {
      toast.error(err.message || "Regenerate failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate) {
      toast.error("Select a date");
      return;
    }
    setLoading(true);
    try {
      await scheduleVariant(variant.id, new Date(scheduleDate));
      onUpdate({ ...variant, status: "scheduled" });
      toast.success("Variant scheduled");
    } catch (err: any) {
      toast.error(err.message || "Schedule failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={`bg-zinc-900 border-zinc-800 flex flex-col ${variant.status === 'discarded' ? 'opacity-70' : ''}`}>
      <CardHeader className="pb-3 flex flex-row items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-zinc-800 text-zinc-300 uppercase">{variant.channel}</Badge>
            <Badge variant="outline" className="uppercase text-zinc-400">{variant.lang}</Badge>
            <Badge className={`${
              variant.status === 'approved' ? 'bg-green-900/50 text-green-400' :
              variant.status === 'scheduled' ? 'bg-blue-900/50 text-blue-400' :
              variant.status === 'published' ? 'bg-purple-900/50 text-purple-400' :
              variant.status === 'discarded' ? 'bg-red-900/50 text-red-400' :
              'bg-zinc-800 text-zinc-300'
            }`}>
              {variant.status}
            </Badge>
          </div>
          <span className="text-xs text-zinc-500 font-mono">{variant.id} · v{variant.version}</span>
        </div>
        {variant.criticJson && (
          <div className="flex flex-col items-end">
            <div className={`text-xs font-bold px-2 py-1 rounded ${variant.criticJson.score >= 4 ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
              Score: {variant.criticJson.score}/5
            </div>
            {variant.criticJson.isTranslation && (
              <span className="text-[10px] text-red-400 mt-1 flex items-center">
                <AlertTriangle className="w-3 h-3 mr-1" /> Fails Independence
              </span>
            )}
            {!variant.criticJson.isTranslation && (
              <span className="text-[10px] text-green-400 mt-1 flex items-center">
                <Shield className="w-3 h-3 mr-1" /> Native Origin
              </span>
            )}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 space-y-4">
        {/* Asset Preview */}
        <div className="bg-black rounded border border-zinc-800 aspect-video flex items-center justify-center relative overflow-hidden group">
          {variant.assetUrl ? (
            <img src={variant.assetUrl} alt="Preview" className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" />
          ) : (
            <div className="text-zinc-600 flex flex-col items-center">
              <span className="text-sm">No Asset Generated</span>
              <span className="text-xs mt-1">Prompt: {variant.imagePrompt.slice(0, 40)}...</span>
            </div>
          )}
        </div>

        {/* Copy */}
        <div className="space-y-2">
          {isEditing ? (
            <Textarea 
              value={editCaption} 
              onChange={e => setEditCaption(e.target.value)} 
              className={`min-h-[100px] text-sm bg-zinc-950 border-zinc-700 ${variant.lang === 'bn' ? 'font-bengali' : 'font-sans'}`}
            />
          ) : (
            <p className={`text-sm text-zinc-200 whitespace-pre-wrap ${variant.lang === 'bn' ? 'font-bengali' : 'font-sans'}`}>
              {variant.caption}
            </p>
          )}
          
          <div className="flex flex-wrap gap-1 mt-2">
            {variant.hashtags.map((h, i) => (
              <span key={i} className="text-xs text-red-400">{h}</span>
            ))}
          </div>
          <p className="text-xs text-zinc-400 mt-2 font-medium">CTA: {variant.cta}</p>
        </div>

        {/* Critic Flags */}
        {variant.criticJson && variant.criticJson.flaggedPhrases.length > 0 && (
          <div className="bg-red-950/30 border border-red-900/50 p-2 rounded mt-2">
            <span className="text-xs font-semibold text-red-400 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" /> Flagged Phrases
            </span>
            <ul className="text-xs text-red-300/80 pl-4 list-disc mt-1">
              {variant.criticJson.flaggedPhrases.map((f, i) => (
                <li key={i} className="font-bengali">{f}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-4 border-t border-zinc-800 flex flex-wrap gap-2">
        {variant.status === 'discarded' ? (
          <Button size="sm" onClick={handleRegenerate} disabled={loading} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
            Regenerate version {variant.version + 1}
          </Button>
        ) : (
          <>
            {isEditing ? (
              <div className="flex gap-2 w-full">
                <Button size="sm" onClick={handleEdit} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 text-white">Save</Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} disabled={loading} className="flex-1 bg-transparent text-zinc-300">Cancel</Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 w-full">
                <Button size="sm" onClick={() => setIsEditing(true)} variant="outline" className="flex-1 bg-transparent text-zinc-300 border-zinc-700 hover:bg-zinc-800 hover:text-white">
                  <Edit2 className="w-3 h-3 mr-1.5" /> Edit
                </Button>
                
                {variant.status === 'draft' && (
                  <Button size="sm" onClick={handleApprove} disabled={loading} className="flex-1 bg-green-600/20 text-green-400 hover:bg-green-600/30 hover:text-green-300 border border-green-600/50">
                    <CheckCircle className="w-3 h-3 mr-1.5" /> Approve
                  </Button>
                )}

                <Dialog>
                  <DialogTrigger className="flex-1 inline-flex items-center justify-center rounded-lg text-sm font-medium h-7 px-2.5 bg-transparent text-red-400 border border-red-900/50 hover:bg-red-950 hover:text-red-300">
                      Discard
                  </DialogTrigger>
                  <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    <DialogHeader>
                      <DialogTitle>Discard Variant</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <p className="text-sm text-zinc-400">Why are you discarding this variant? This note will be used if you regenerate it.</p>
                      <Textarea 
                        value={discardNote} 
                        onChange={e => setDiscardNote(e.target.value)} 
                        placeholder="e.g. Tone is too aggressive, make it playful..."
                        className="bg-zinc-950 border-zinc-700"
                      />
                      <Button onClick={handleDiscard} disabled={loading || !discardNote} className="w-full bg-red-600 hover:bg-red-700 text-white">
                        Confirm Discard
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger 
                    disabled={variant.status !== 'approved'} 
                    className={`w-full mt-2 inline-flex items-center justify-center rounded-lg text-sm font-medium h-7 px-2.5 ${variant.status !== 'approved' ? 'opacity-50 cursor-not-allowed border border-zinc-700 text-zinc-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    title={variant.status !== 'approved' ? 'Must be approved to schedule' : ''}
                  >
                      <CalendarClock className="w-3 h-3 mr-1.5" /> Schedule
                  </DialogTrigger>
                  <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    <DialogHeader>
                      <DialogTitle>Schedule Post</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <Input 
                        type="datetime-local" 
                        value={scheduleDate} 
                        onChange={e => setScheduleDate(e.target.value)} 
                        className="bg-zinc-950 border-zinc-700 text-zinc-100 [color-scheme:dark]"
                      />
                      <Button onClick={handleSchedule} disabled={loading || !scheduleDate} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                        Confirm Schedule
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
}
