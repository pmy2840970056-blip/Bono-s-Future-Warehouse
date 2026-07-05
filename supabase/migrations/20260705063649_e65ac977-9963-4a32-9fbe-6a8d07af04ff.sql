CREATE INDEX IF NOT EXISTS daily_entries_user_date_created_idx
  ON public.daily_entries(user_id, entry_date, created_at);

CREATE INDEX IF NOT EXISTS task_attachments_user_task_idx
  ON public.task_attachments(user_id, task_id);

CREATE INDEX IF NOT EXISTS task_attachments_task_created_idx
  ON public.task_attachments(task_id, created_at);