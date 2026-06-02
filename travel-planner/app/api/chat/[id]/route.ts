// app/api/chat/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { StateGraph } from '@/lib/state-graph'
import { CacheManager, CACHE_KEYS } from '@/lib/redis'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { message } = await req.json()
  const planKey = CACHE_KEYS.TRAVEL_PLAN(params.id)
  const chatKey = CACHE_KEYS.CHAT_HISTORY(params.id)

  // ⛑️ 1) Bail early if the plan does not exist
  const planInCache = await CacheManager.get<any>(planKey)
  if (!planInCache)
    return NextResponse.json(
      { error: 'PLAN_NOT_FOUND', message: 'Generate a plan first.' },
      { status: 404 }
    )

  // 2) Re‑run the graph with the new “chat” preference
  const graph = new StateGraph()
  const newPref = {
    ...planInCache.workflow_data.city_analysis.preferences,
    chat: message,
  }
  const updated = await graph.execute(newPref, 'city-selector')

  // 3) Persist plan + append chat log
  const newPlan = { ...planInCache, workflow_data: updated.data }
  await CacheManager.set(planKey, newPlan, 86_400)
  await CacheManager.addToList(chatKey, {
    role: 'user',
    message,
    ts: Date.now(),
  })
  await CacheManager.addToList(chatKey, {
    role: 'assistant',
    message: updated.data['travel-concierge']?.schedule
      ? 'Itinerary updated!'
      : 'Got it!',
    ts: Date.now(),
  })

  return NextResponse.json({ ok: true, plan: newPlan })
}
