import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  goal: z.string().trim().min(2, "目标太短").max(200, "目标太长"),
});

export type DecomposedTree = {
  subgoals: Array<{
    title: string;
    tasks: string[];
  }>;
};

const SYSTEM_PROMPT = `你是一位帮助用户拆解长期目标的规划教练。
用户会给你一个长期目标，你需要把它拆成 3-5 个"子目标"，每个子目标下再列出 3-6 个"每日可执行的具体任务"。

要求：
- 子目标是阶段性的方向（例如"打好基础耐力"），不是模糊的口号。
- 每日任务必须是今天就能动手做的一小块（例如"慢跑 5 公里"、"整理 3 个精选项目文案"），不要用"坚持"、"保持"这种无法执行的词。
- 全部用简体中文，语气克制、具体。
- 严格只输出 JSON，格式如下，不要任何多余文字：
{"subgoals":[{"title":"子目标标题","tasks":["任务1","任务2","任务3"]}]}`;

export const decomposeGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<DecomposedTree> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI 服务未配置");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `请拆解这个长期目标：${data.goal}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      if (resp.status === 429) throw new Error("AI 请求太频繁，请稍后再试");
      if (resp.status === 402) throw new Error("AI 额度已用完，请联系管理员充值");
      throw new Error(`AI 拆解失败：${resp.status} ${text.slice(0, 200)}`);
    }

    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract a JSON block if the model wrapped it in prose.
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("AI 返回的不是有效 JSON");
      parsed = JSON.parse(match[0]);
    }

    const shape = z.object({
      subgoals: z
        .array(
          z.object({
            title: z.string().trim().min(1).max(120),
            tasks: z.array(z.string().trim().min(1).max(200)).min(1).max(12),
          }),
        )
        .min(1)
        .max(8),
    });

    const result = shape.safeParse(parsed);
    if (!result.success) throw new Error("AI 返回的结构不符合预期");
    return result.data;
  });
