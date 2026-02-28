import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const CHAR_LIMIT = 3000

const SYSTEM_PROMPTS = {
  narrate:
    'You are a skilled narrator with a warm, engaging voice. You bring texts to life through expressive, vivid storytelling while staying faithful to the original material.',
  summarize:
    'You are a clear, precise summarizer. You distill texts to their essential ideas, main arguments, and key points in a concise, well-structured way.',
  explain:
    'You are a patient, knowledgeable teacher. You explain texts clearly, breaking down complex concepts, difficult vocabulary, and subtle ideas into plain, accessible language.',
}

const USER_PROMPTS = {
  narrate: (text) =>
    `Please narrate the following text in an engaging, storytelling style. Make it vivid and compelling while staying true to the original:\n\n${text}`,
  summarize: (text) =>
    `Please provide a clear and concise summary of the following text, highlighting the main ideas and key takeaways:\n\n${text}`,
  explain: (text) =>
    `Please explain the following text. Clarify any complex concepts, vocabulary, themes, or ideas in simple, accessible terms:\n\n${text}`,
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { text, mode } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid text.' }, { status: 400 })
    }

    if (!mode || !SYSTEM_PROMPTS[mode]) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be one of: narrate, summarize, explain.' },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'API key not configured. Please set ANTHROPIC_API_KEY.' },
        { status: 500 }
      )
    }

    const truncatedText = text.slice(0, CHAR_LIMIT)

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPTS[mode],
      messages: [
        {
          role: 'user',
          content: USER_PROMPTS[mode](truncatedText),
        },
      ],
    })

    const result = message.content[0]?.text ?? ''
    return NextResponse.json({ result })
  } catch (err) {
    console.error('[/api/read] Error:', err)

    // Surface Anthropic API errors helpfully
    if (err?.status) {
      return NextResponse.json(
        { error: `Claude API error: ${err.message}` },
        { status: err.status }
      )
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
