import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }) {
  const map = {
    uploaded: { label: "Uploaded", variant: "muted" },
    queued: { label: "Queued", variant: "default" },
    preprocessing: { label: "Preprocessing", variant: "default" },
    ocr: { label: "OCR", variant: "default" },
    extracting: { label: "Extracting", variant: "default" },
    needs_review: { label: "Needs review", variant: "warning" },
    approved: { label: "Approved", variant: "success" },
    attested: { label: "Attested", variant: "success" },
    failed: { label: "Failed", variant: "danger" },
  };
  const item = map[status] ?? { label: status, variant: "muted" };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}
