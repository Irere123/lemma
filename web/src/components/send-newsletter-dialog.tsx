import { useState } from "react";
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

interface SendNewsletterDialogProps {
  documentId: string;
  documentTitle: string;
  scheduledDate?: Date | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SendNewsletterDialog = ({
  documentId,
  documentTitle,
  scheduledDate,
  isOpen,
  onClose,
}: SendNewsletterDialogProps) => {
  const trpc = useTRPC();
  const [sendImmediately, setSendImmediately] = useState(false);
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
      setResult({
        type: "error",
        message: error.message || "Failed to send newsletter",
      });
    },
  });

  const handleSend = () => {
    sendNewsletter({
      documentId,
      sendImmediately,
    });
  };

  const hasScheduledDate =
    scheduledDate && new Date(scheduledDate) > new Date();
  const scheduledDateStr = scheduledDate
    ? new Date(scheduledDate).toLocaleString()
    : "Not set";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Newsletter</DialogTitle>
          <DialogDescription>
            Send "{documentTitle}" to all confirmed subscribers
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {result && (
            <div
              className={`flex items-start gap-3 p-4 rounded-lg border ${
                result.type === "success"
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              {result.type === "success" ? (
                <IconCheck className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <IconX className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <p
                className={`text-sm ${
                  result.type === "success" ? "text-green-900" : "text-red-900"
                }`}
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

          {hasScheduledDate && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <IconClock className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">
                  Scheduled for: {scheduledDateStr}
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Emails will be queued and sent at the scheduled time.
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
