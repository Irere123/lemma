import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";

import type { Document } from "@/stores/document-store";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Document;
  onSave: (data: Partial<Document>) => Promise<void> | void;
  isSaving?: boolean;
};

export const DocumentSettingsModal: React.FC<Props> = ({
  open,
  onOpenChange,
  document,
  onSave,
  isSaving = false,
}) => {
  const [localTitle, setLocalTitle] = React.useState(document.title || "");
  const [localSubtitle, setLocalSubtitle] = React.useState(
    document.subtitle || ""
  );
  const [bannerImage, setBannerImage] = React.useState(
    document.bannerImage || ""
  );
  const [sendAsNewsletter, setSendAsNewsletter] = React.useState<boolean>(
    Boolean(document.sendAsNewsletter)
  );
  const [scheduledDate, setScheduledDate] = React.useState<string>(
    document.scheduledDate
      ? new Date(document.scheduledDate).toISOString().slice(0, 16)
      : ""
  );
  const [manualPublishedDate, setManualPublishedDate] = React.useState<boolean>(
    Boolean(document.publishedDate)
  );
  const [publishedDate, setPublishedDate] = React.useState<string>(
    document.publishedDate
      ? new Date(document.publishedDate).toISOString().slice(0, 16)
      : ""
  );

  React.useEffect(() => {
    if (!open) return;
    setLocalTitle(document.title || "");
    setLocalSubtitle(document.subtitle || "");
    setBannerImage(document.bannerImage || "");
    setSendAsNewsletter(Boolean(document.sendAsNewsletter));
    setScheduledDate(
      document.scheduledDate
        ? new Date(document.scheduledDate).toISOString().slice(0, 16)
        : ""
    );
    setManualPublishedDate(Boolean(document.publishedDate));
    setPublishedDate(
      document.publishedDate
        ? new Date(document.publishedDate).toISOString().slice(0, 16)
        : ""
    );
  }, [open, document]);

  const handleSave = async () => {
    const update: Partial<Document> = {
      id: document.id,
      title: localTitle || null,
      subtitle: localSubtitle || null,
      bannerImage: bannerImage || null,
      sendAsNewsletter: sendAsNewsletter,
      scheduledDate:
        sendAsNewsletter && scheduledDate ? new Date(scheduledDate) : null,
      publishedDate:
        manualPublishedDate && publishedDate ? new Date(publishedDate) : null,
    } as Partial<Document>;
    await onSave(update);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Settings">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure publishing, and newsletter settings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              Banner Image URL
            </label>
            <input
              type="text"
              value={bannerImage}
              onChange={(e) => setBannerImage(e.target.value)}
              placeholder="Enter banner image URL"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {bannerImage ? (
              <img
                src={bannerImage}
                alt="Banner preview"
                className="w-full h-40 object-cover rounded-md border"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <input
              id="send-as-newsletter"
              type="checkbox"
              checked={sendAsNewsletter}
              onChange={(e) => setSendAsNewsletter(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
              aria-label="Send as newsletter"
            />
            <label
              htmlFor="send-as-newsletter"
              className="text-sm text-gray-700"
            >
              Send as newsletter
            </label>
          </div>

          {sendAsNewsletter ? (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">
                Schedule date
              </label>
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <input
              id="manual-published-date"
              type="checkbox"
              checked={manualPublishedDate}
              onChange={(e) => setManualPublishedDate(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
              aria-label="Configure published date manually"
            />
            <label
              htmlFor="manual-published-date"
              className="text-sm text-gray-700"
            >
              Configure published date manually
            </label>
          </div>

          {manualPublishedDate ? (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">
                Published date
              </label>
              <input
                type="datetime-local"
                value={publishedDate}
                onChange={(e) => setPublishedDate(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            aria-label="Cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            aria-label="Save settings"
            disabled={isSaving}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
