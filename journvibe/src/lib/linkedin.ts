/**
 * LinkedIn Posts API (v2) — publish text posts to a user's feed.
 *
 * Required env vars:
 *   LINKEDIN_ACCESS_TOKEN  OAuth 2.0 access token with w_member_social scope
 *   LINKEDIN_USER_ID       LinkedIn URN (e.g. "urn:li:person:AbCdEfGh")
 */

const LINKEDIN_BASE = 'https://api.linkedin.com/v2';

function linkedInHeaders() {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) throw new Error('LINKEDIN_ACCESS_TOKEN is required.');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0',
    'LinkedIn-Version': '202410',
  };
}

export interface LinkedInPostResult {
  id: string;
  url: string;
}

/** Publish a text post to the authenticated user's LinkedIn feed. */
export async function linkedInPost(text: string): Promise<LinkedInPostResult> {
  const userId = process.env.LINKEDIN_USER_ID;
  if (!userId) throw new Error('LINKEDIN_USER_ID is required.');

  const authorUrn = userId.startsWith('urn:li:') ? userId : `urn:li:person:${userId}`;

  const body = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  const res = await fetch(`${LINKEDIN_BASE}/ugcPosts`, {
    method: 'POST',
    headers: linkedInHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn API error ${res.status}: ${err}`);
  }

  const postUrn = res.headers.get('x-restli-id') ?? res.headers.get('X-RestLi-Id') ?? 'unknown';

  return {
    id: postUrn,
    url: `https://www.linkedin.com/feed/update/${postUrn}/`,
  };
}
