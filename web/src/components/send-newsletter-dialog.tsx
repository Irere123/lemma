import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  IconSend,
  IconClock,
  IconMail,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { useTRPC } from "@/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  formatWithTimezone,
  getLocalDateTimeInputValue,
  parseLocalDateTimeInput,
} from "@/lib/date";
import { cn } from "@/lib/utils";

interface SendNewsletterDialogProps {
  documentId: string;
  documentTitle?: string | null;
  scheduledDate?: Date | null;
  isOpen: boolean;
  onClose: () => void;
  onScheduleUpdate?: (scheduledDate: Date | null) => Promise<void> | void;
}

export const SendNewsletterDialog = ({
  documentId,
  documentTitle,
  scheduledDate,
  isOpen,
  onClose,
  onScheduleUpdate,
}: SendNewsletterDialogProps) => {
  const trpc = useTRPC();
  const [sendImmediately, setSendImmediately] = useState(false);
  const [enableScheduling, setEnableScheduling] = useState(false);
  const [scheduledDateInput, setScheduledDateInput] = useState<string>(() => {
    return scheduledDate
      ? getLocalDateTimeInputValue(new Date(scheduledDate))
      : "";
  });
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const { mutate: sendNewsletter, isPending } = useMutation({
    ...trpc.documents.sendNewsletter.mutationOptions(),
    onSuccess: (data) => {
      setResult({
        type: "success",
        message: `${data.message} - Sent to ${data.count} subscribers`,
      });
      setTimeout(() => {
        onClose();
        setResult(null);
      }, 3000);
    },
    onError: (error: any) => {
      console.error("Newsletter send error:", error);
      const errorMessage =
        error?.data?.zodError?.formErrors?.[0] ||
        error?.message ||
        error?.data?.message ||
        "Failed to send newsletter";
      setResult({
        type: "error",
        message: errorMessage,
      });
    },
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setSendImmediately(false);
    setResult(null);
    setEnableScheduling(Boolean(scheduledDate));
    setScheduledDateInput(
      scheduledDate ? getLocalDateTimeInputValue(new Date(scheduledDate)) : ""
    );
  }, [isOpen, scheduledDate]);

  const parsedScheduledDate = useMemo(
    () => parseLocalDateTimeInput(scheduledDateInput),
    [scheduledDateInput]
  );

  const scheduledPreview = useMemo(() => {
    return parsedScheduledDate ? formatWithTimezone(parsedScheduledDate) : null;
  }, [parsedScheduledDate]);

  const scheduledInfo = useMemo(() => {
    return formatWithTimezone(scheduledDate ?? null);
  }, [scheduledDate]);

  const handleSend = async () => {
    // Save scheduled date if scheduling is enabled
    if (enableScheduling && parsedScheduledDate && onScheduleUpdate) {
      await onScheduleUpdate(parsedScheduledDate);
    } else if (!enableScheduling && onScheduleUpdate) {
      await onScheduleUpdate(null);
    }

    sendNewsletter({
      documentId,
      sendImmediately: Boolean(sendImmediately),
    });
  };

  const hasScheduledDate =
    Boolean(scheduledInfo) && new Date(scheduledInfo!.iso) > new Date();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Newsletter</DialogTitle>
          <DialogDescription>
            Send "{documentTitle || "this document"}" to all confirmed
            subscribers
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {result && (
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4",
                result.type === "success"
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              )}
            >
              {result.type === "success" ? (
                <IconCheck className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <IconX className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <p
                className={cn(
                  "text-sm",
                  result.type === "success" ? "text-green-900" : "text-red-900"
                )}
              >
                {result.message}
              </p>
            </div>
          )}

          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <IconMail className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                Email Newsletter
              </p>
              <p className="text-xs text-blue-700 mt-1">
                This will send the document via email to all confirmed
                subscribers with markdown formatting.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableScheduling}
                  onChange={(e) => setEnableScheduling(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Schedule send time
                </span>
              </label>
              {enableScheduling && (
                <div className="flex flex-col gap-2 ml-6">
                  <label className="text-sm font-medium text-gray-700">
                    Schedule date
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledDateInput}
                    onChange={(e) => setScheduledDateInput(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {scheduledPreview ? (
                    <div className="flex flex-col gap-1 rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                      <span className="font-medium text-sm text-blue-900">
                        Emails will send {scheduledPreview.relative}
                      </span>
                      <span>
                        Local time: {scheduledPreview.label} (
                        {scheduledPreview.timeZone})
                      </span>
                      <span className="text-[11px] text-blue-600">
                        Stored as UTC: {scheduledPreview.iso}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Choose a future date and time in your local timezone.
                    </p>
                  )}
                </div>
              )}
            </div>

            {hasScheduledDate && scheduledInfo && !enableScheduling && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <IconClock className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">
                    Scheduled for: {scheduledInfo.label} (
                    {scheduledInfo.timeZone})
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Emails will be queued and sent {scheduledInfo.relative}.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendImmediately}
                  onChange={(e) => setSendImmediately(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Send immediately (ignore scheduled date)
                </span>
              </label>
              {sendImmediately && (
                <p className="text-xs text-gray-600 ml-6">
                  Emails will be sent right away with high priority
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isPending}>
            {isPending ? (
              <>
                <IconSend className="w-4 h-4 mr-2 animate-pulse" />
                Sending...
              </>
            ) : (
              <>
                <IconSend className="w-4 h-4 mr-2" />
                {sendImmediately || !hasScheduledDate
                  ? "Send Now"
                  : "Schedule Send"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
