// hooks/useChatWithPlan.ts
import useSWR from 'swr'
export function useChatWithPlan(id: string) {
  const { data, mutate } = useSWR<{ plan: any }>(`/api/chat/${id}`)

  const send = async (text: string) => {
    // optimistic UI
    mutate(
      (prev) => ({
        ...prev,
        plan: { ...prev?.plan, pendingMessage: text },
      }),
      false
    )
    const next = await fetch(`/api/chat/${id}`, {
      method: 'POST',
      body: JSON.stringify({ message: text }),
      headers: { 'Content-Type': 'application/json' },
    }).then((r) => r.json())
    mutate(next, false) // revalidate locally :contentReference[oaicite:1]{index=1}
  }
  return { ...data, send }
}
