"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { sendChatMessage } from "@/lib/api";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type Props = {
  entityId?: string;
};

const SUGGESTIONS = [
  "なぜ今月は赤字？",
  "先月と比べてどう？",
  "節約できる項目は？",
  "サブスクを教えて",
  "Where is most of my money going?",
  "How can I save more this month?",
];

export default function ChatPanel({ entityId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "hello",
      role: "assistant",
      text: "こんにちは！AIファイナンスコーチです。支出・収入・節約について何でも聞いてください。\n\nHi! I'm your AI finance coach. Ask me anything about your spending, income, or savings goals.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setLoading(true);

    const result = await sendChatMessage(text.trim(), entityId);
    setLoading(false);

    const reply = result.data?.reply || result.error || "応答がありませんでした。";
    setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: reply }]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await sendMessage(draft);
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      minHeight: 480,
      background: "#fff",
      borderRadius: 16,
      border: "1px solid #e8eef3",
      overflow: "hidden",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>
          ✨
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>AI Finance Coach</div>
          <div style={{ color: "#94a3b8", fontSize: 11 }}>Powered by Claude · 日英対応</div>
        </div>
      </div>

      {/* Message stream */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px 16px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{
            display: "flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
          }}>
            {msg.role === "assistant" && (
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, flexShrink: 0, marginRight: 8, marginTop: 2,
              }}>
                ✨
              </div>
            )}
            <div style={{
              maxWidth: "75%",
              background: msg.role === "user"
                ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
                : "#f8fafc",
              color: msg.role === "user" ? "#fff" : "#10212f",
              borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              padding: "10px 14px",
              fontSize: 13,
              lineHeight: 1.6,
              border: msg.role === "assistant" ? "1px solid #e8eef3" : "none",
              whiteSpace: "pre-wrap",
            }}>
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14,
            }}>
              ✨
            </div>
            <div style={{
              background: "#f8fafc", border: "1px solid #e8eef3",
              borderRadius: "14px 14px 14px 4px",
              padding: "10px 14px", fontSize: 13, color: "#94a3b8",
            }}>
              考え中…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick suggestions */}
      <div style={{ padding: "6px 16px", display: "flex", gap: 6, overflowX: "auto", flexWrap: "wrap" }}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => sendMessage(s)}
            disabled={loading}
            style={{
              fontSize: 11, padding: "4px 10px", borderRadius: 20,
              border: "1px solid #e0e7ef", background: "#f8fafc",
              color: "#5f7284", cursor: "pointer", whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={onSubmit} style={{
        display: "flex", gap: 8, padding: "12px 16px",
        borderTop: "1px solid #f1f5f9",
      }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="質問を入力… / Ask anything..."
          disabled={loading}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 10,
            border: "1px solid #e0e7ef", fontSize: 13, outline: "none",
            background: loading ? "#f8fafc" : "#fff",
          }}
        />
        <button
          type="submit"
          disabled={loading || !draft.trim()}
          style={{
            padding: "10px 16px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
            opacity: loading || !draft.trim() ? 0.5 : 1,
            transition: "opacity 0.15s",
          }}
        >
          送信
        </button>
      </form>
    </div>
  );
}
