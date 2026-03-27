const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || 'sk-cp-ay979ATn71LK52-r38V5tum9nCH4SBe5RuMBXYYog9E4I1f6D-yFhmnAp7GaGAPTf-Ib7kwlqBOd6wktwdoRSlZf8Ykbmvaq8CQhokcxUeMzuiFiZBOs910'
const MINIMAX_API_URL = 'https://api.minimaxi.com/v1/text/chatcompletion_v2'

interface MiniMaxMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface MiniMaxRequest {
  model: string
  messages: MiniMaxMessage[]
  temperature?: number
  max_tokens?: number
}

export async function generateContent(
  systemPrompt: string,
  userPrompt: string,
  model: string = 'MiniMax-M2.5'
): Promise<string> {
  const response = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    } as MiniMaxRequest)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`MiniMax API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

export function buildContentPrompt(
  persona: {
    name: string
    username: string
    background: string
    tone: string
    writing_style: string
  },
  postContext: {
    title: string
    selftext: string
    subreddit: string
    score: number
  }
): { system: string; user: string } {
  const system = `You are ${persona.name} (${persona.username}).

Background: ${persona.background}
Tone: ${persona.tone}
Writing Style: ${persona.writing_style}

Generate Reddit posts that feel authentic and match the persona's voice.`

  const user = `Create a Reddit post based on this Reddit content:

Title: ${postContext.title}
Subreddit: ${postContext.subreddit}
Score: ${postContext.score}
Content: ${postContext.selftext || '(no body text)'}

Generate a compelling Reddit post title and body that matches the persona's voice and style. Return as JSON with "title" and "body" fields.`

  return { system, user }
}