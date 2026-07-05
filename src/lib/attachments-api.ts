import { supabase } from "@/integrations/supabase/client";

export type AttachmentKind = "link" | "image" | "file";

export type TaskAttachment = {
  id: string;
  task_id: string;
  kind: AttachmentKind;
  name: string;
  url: string | null;
  storage_path: string | null;
  mime: string | null;
  size: number | null;
  created_at: string;
};

const BUCKET = "task-attachments";
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

export async function fetchAttachments(taskId: string): Promise<TaskAttachment[]> {
  const { data, error } = await supabase
    .from("task_attachments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TaskAttachment[];
}

export async function addLinkAttachment(
  userId: string,
  taskId: string,
  rawUrl: string,
  name?: string,
): Promise<TaskAttachment> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    // Validate
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    throw new Error("链接格式不正确");
  }
  const label = (name?.trim() || (() => {
    try { return new URL(url).hostname; } catch { return url; }
  })()).slice(0, 200);
  const { data, error } = await supabase
    .from("task_attachments")
    .insert({
      user_id: userId,
      task_id: taskId,
      kind: "link",
      name: label,
      url,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TaskAttachment;
}

export async function uploadFileAttachment(
  userId: string,
  taskId: string,
  file: File,
): Promise<TaskAttachment> {
  if (file.size > MAX_FILE_BYTES) throw new Error("文件不能超过 10MB");
  const isImage = file.type.startsWith("image/");
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "file";
  const key = `${userId}/${taskId}/${crypto.randomUUID()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(key, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("task_attachments")
    .insert({
      user_id: userId,
      task_id: taskId,
      kind: isImage ? "image" : "file",
      name: file.name.slice(0, 200),
      storage_path: key,
      mime: file.type || null,
      size: file.size,
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([key]);
    throw error;
  }
  return data as TaskAttachment;
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAttachment(a: TaskAttachment): Promise<void> {
  if (a.storage_path) {
    await supabase.storage.from(BUCKET).remove([a.storage_path]);
  }
  const { error } = await supabase.from("task_attachments").delete().eq("id", a.id);
  if (error) throw error;
}

export async function fetchAttachmentCounts(taskIds: string[]): Promise<Record<string, number>> {
  if (taskIds.length === 0) return {};
  const { data, error } = await supabase
    .from("task_attachments")
    .select("task_id")
    .in("task_id", taskIds);
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    out[row.task_id] = (out[row.task_id] ?? 0) + 1;
  }
  return out;
}
