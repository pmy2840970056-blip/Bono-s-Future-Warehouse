import { useLanguage } from "@/lib/i18n";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Paperclip,
  Link as LinkIcon,
  Upload,
  ExternalLink,
  Trash2,
  Image as ImageIcon,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  addLinkAttachment,
  deleteAttachment,
  fetchAttachments,
  getSignedUrl,
  uploadFileAttachment,
  type TaskAttachment,
} from "@/lib/attachments-api";

export function TaskAttachments({
  taskId,
  userId,
  compact,
}: {
  taskId: string;
  userId: string;
  compact?: boolean;
}) {
  const { t, language, locale } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const q = useQuery({
    queryKey: ["attachments", taskId],
    queryFn: () => fetchAttachments(taskId),
    enabled: open,
  });
  const list = q.data ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["attachments", taskId] });
    qc.invalidateQueries({ queryKey: ["attachment-counts", userId] });
  };

  const addLink = useMutation({
    mutationFn: (v: string) => addLinkAttachment(userId, taskId, v),
    onSuccess: () => {
      setUrl("");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("添加链接失败")),
  });

  const upload = useMutation({
    mutationFn: (f: File) => uploadFileAttachment(userId, taskId, f),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e instanceof Error ? e.message : t("上传失败")),
  });

  const del = useMutation({
    mutationFn: (a: TaskAttachment) => deleteAttachment(a),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e instanceof Error ? e.message : t("删除失败")),
  });

  async function openAttachment(a: TaskAttachment) {
    try {
      let target = a.url;
      if (!target && a.storage_path) target = await getSignedUrl(a.storage_path);
      if (target) window.open(target, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("打开失败"));
    }
  }

  // Optimistic count from client cache; we render "•" when we don't know yet.
  const cached = qc.getQueryData<Record<string, number>>(["attachment-counts", userId]);
  const count = cached?.[taskId] ?? (q.data ? list.length : 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "relative shrink-0 grid place-items-center rounded-md border-2 border-ink bg-background transition",
            "hover:bg-accent hover:shadow-brick-sm",
            compact ? "h-6 w-6" : "h-7 w-7",
            count > 0 && "bg-accent",
          )}
          aria-label={t("附件")}
          title={t("添加链接/图片/文件")}
        >
          <Paperclip className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={2.5} />
          {count > 0 && (
            <span className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full border-2 border-ink bg-brick-3 px-1 text-[9px] font-black leading-none">
              {count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 border-2 border-ink p-3 shadow-brick"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t("任务附件")}</p>
          <span className="text-[10px] text-muted-foreground">{t("最多 10MB / 文件")}</span>
        </div>

        <div className="mb-3 max-h-60 space-y-1.5 overflow-y-auto pr-1">
          {q.isLoading && (
            <p className="py-3 text-center text-xs text-muted-foreground">{t("加载中…")}</p>
          )}
          {!q.isLoading && list.length === 0 && (
            <p className="py-3 text-center text-xs text-muted-foreground">
              {t("还没有附件。加个链接或文件，动手时就不用再翻半天。")}</p>
          )}
          {list.map((a) => {
            const Icon =
              a.kind === "link" ? LinkIcon : a.kind === "image" ? ImageIcon : FileText;
            return (
              <div
                key={a.id}
                className="group flex items-center gap-2 rounded-md border-2 border-ink bg-card px-2 py-1.5 shadow-brick-sm"
              >
                <button
                  onClick={() => openAttachment(a)}
                  className="flex flex-1 items-center gap-2 min-w-0 text-left"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                  <span className="truncate text-xs font-semibold">{a.name}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-40 group-hover:opacity-100" />
                </button>
                <button
                  onClick={() => del.mutate(a)}
                  className="opacity-30 hover:opacity-100"
                  aria-label={t("删除附件")}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!url.trim() || addLink.isPending) return;
            addLink.mutate(url.trim());
          }}
          className="mb-2 flex items-center gap-1.5"
        >
          <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2.5} />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("粘贴链接 (Notion / Figma / 文档 …)")}
            className="h-8 border-2 border-ink text-xs"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!url.trim() || addLink.isPending}
            className="h-8 border-2 border-ink bg-brick-3 text-xs font-bold shadow-brick-sm"
          >
            {addLink.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("加")}
          </Button>
        </form>

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="w-full h-8 border-2 border-dashed border-ink/40 bg-background text-xs font-bold hover:border-ink"
        >
          {upload.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("上传中…")}</>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" strokeWidth={2.5} /> {t("上传图片或文件")}</>
          )}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
