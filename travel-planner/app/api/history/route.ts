// app/api/history/route.ts
import { CacheManager, CACHE_KEYS } from '@/lib/redis'
import { NextResponse } from 'next/server'
export async function GET(req: Request) {
  const userId = req.headers.get('x-user')!
  const items = await CacheManager.getList<any>(CACHE_KEYS.USER_HISTORY(userId))
  return NextResponse.json({ items })
}
