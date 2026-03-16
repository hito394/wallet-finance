"use client";

import { FormEvent, useState } from "react";

import { sendChatMessage } from "@/lib/api";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type Props = {
  entityId?: string;
};

export default function ChatPanel({ entityId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "hello",
      role: "assistant",
      text: "Hi, I can help summarize your finances, explain trends, and suggest next actions.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setLoading(true);

    const result = await sendChatMessage(text, entityId);
    setLoading(false);

    const assistantText = result.data?.reply || result.error || "No response from assistant.";
    const assistantMessage: ChatMessage = {
      id: `a-${Date.now()}`,
      role: "assistant",
      text: assistantText,
    };
    setMessages((prev) => [...prev, assistantMessage]);
  }

  return (
    <div className="panel chat-panel">
      <div className="chat-stream">
        {messages.map((message) => (
          <div key={message.id} className={`chat-message ${message.role}`}>
            <strong>{message.role === "assistant" ? "AI" : "You"}</strong>
            <p>{message.text}</p>
          </div>
        ))}
        {loading && (
          <div className="chat-message assistant">
            <strong>AI</strong>
            <p>Thinking...</p>
          </div>
        )}
      </div>

      <form className="chat-form" onSubmit={onSubmit}>
        <input
          className="input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about spending, trends, subscriptions..."
        />
        <button type="submit" className="btn primary" disabled={loading || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
