'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../../providers'
import { useSpeech } from '../../hooks/useSpeech'

const CHAR_LIMIT = 3000

const mdComponents = {
  h1: ({ children }) => <h1 className="text-base font-bold text-stone-900 mt-4 mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold text-stone-900 mt-4 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-stone-800 mt-3 mb-1">{children}</h3>,
  p:  ({ children }) => <p className="text-sm text-stone-700 leading-relaxed mb-3 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-stone-900">{children}</strong>,
  em: ({ children }) => <em className="italic text-stone-600">{children}</em>,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-stone-700">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-stone-700">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => <blockquote className="border-l-4 border-amber-300 pl-4 italic text-stone-500 my-3">{children}</blockquote>,
  code: ({ children }) => <code className="bg-stone-100 text-stone-700 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
}

function Waveform() {
  return (
    <span className="flex gap-0.5 items-end">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-1 bg-current rounded-full animate-bounce"
          style={{ height: '12px', animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  )
}

export default function ReadPage() {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { voices, selectedVoice, setSelectedVoice, speaking, speak, stopSpeech, resumeAt } = useSpeech()

  const [book, setBook] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [textExpanded, setTextExpanded] = useState(false)
  const [summary, setSummary] = useState('')
  const [summarizing, setSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && id) fetchBook()
  }, [user, id])

  async function fetchBook() {
    const { data, error } = await supabase.from('books').select('*').eq('id', id).single()
    if (error || !data) router.replace('/dashboard')
    else setBook(data)
    setPageLoading(false)
  }

  async function handleSummarize() {
    if (summarizing) return
    stopSpeech()
    setSummarizing(true)
    setSummary('')
    setSummaryError('')
    try {
      const res = await fetch('/api/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: book.content.slice(0, CHAR_LIMIT), mode: 'summarize' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setSummary(data.result)
    } catch (err) {
      setSummaryError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSummarizing(false)
    }
  }

  const charCount = book?.content.length ?? 0

  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-stone-400 hover:text-stone-700 transition-colors text-sm font-medium flex-shrink-0">
            ← Library
          </Link>
          <div className="w-px h-5 bg-stone-200" />
          <h1 className="font-semibold text-stone-700 text-sm truncate">{book?.title}</h1>
        </div>
      </header>

      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 space-y-5">

        {/* Text card */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
            <h2 className="text-sm font-semibold text-stone-700">Text</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-400">{charCount.toLocaleString()} chars</span>
              <button onClick={() => setTextExpanded((v) => !v)}
                className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                {textExpanded ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>
          <div className={`px-6 py-4 font-mono text-xs text-stone-600 leading-relaxed whitespace-pre-wrap overflow-y-auto transition-all ${textExpanded ? 'max-h-[500px]' : 'max-h-36'}`}>
            {book?.content}
          </div>

          <div className="px-6 pb-5 space-y-3">
            {/* Voice picker */}
            {voices.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400 flex-shrink-0">Voice</span>
                <select
                  value={selectedVoice?.name ?? ''}
                  onChange={(e) => setSelectedVoice(voices.find((v) => v.name === e.target.value) ?? null)}
                  className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>{v.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Play controls */}
            {speaking === 'book' ? (
              <button onClick={stopSpeech}
                className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
                <Waveform /> Stop Reading
              </button>
            ) : resumeAt.book > 0 ? (
              <div className="flex gap-2">
                <button onClick={() => speak(book?.content, 'book')}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors text-sm">
                  ▶ Resume
                </button>
                <button onClick={() => speak(book?.content, 'book', { restart: true })}
                  title="Start over"
                  className="py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-600 font-medium rounded-xl transition-colors text-sm">
                  ↺
                </button>
              </div>
            ) : (
              <button onClick={() => speak(book?.content, 'book')}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
                🔊 Read Aloud
              </button>
            )}
          </div>
        </div>

        {/* Summarize card */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-stone-700">AI Summary</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Sends first {Math.min(charCount, CHAR_LIMIT).toLocaleString()} of {charCount.toLocaleString()} characters to Claude
            </p>
          </div>

          <button onClick={handleSummarize} disabled={summarizing}
            className="w-full py-3 bg-stone-800 hover:bg-stone-900 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
            {summarizing ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Summarizing…</>
            ) : '📝 Summarize'}
          </button>

          {summaryError && (
            <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <span>⚠️</span><span>{summaryError}</span>
            </div>
          )}

          {summary && (
            <div className="mt-5 pt-5 border-t border-stone-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Summary</span>
                <div className="flex items-center gap-1.5">
                  {speaking === 'summary' ? (
                    <button onClick={stopSpeech}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors">
                      ⏹ Stop
                    </button>
                  ) : resumeAt.summary > 0 ? (
                    <>
                      <button onClick={() => speak(summary, 'summary', { markdown: true })}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg font-medium transition-colors">
                        ▶ Resume
                      </button>
                      <button onClick={() => speak(summary, 'summary', { markdown: true, restart: true })}
                        title="Start over"
                        className="text-xs px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg font-medium transition-colors">
                        ↺
                      </button>
                    </>
                  ) : (
                    <button onClick={() => speak(summary, 'summary', { markdown: true })}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg font-medium transition-colors">
                      🔊 Listen
                    </button>
                  )}
                </div>
              </div>

              <ReactMarkdown components={mdComponents}>{summary}</ReactMarkdown>

              {speaking === 'summary' && (
                <div className="mt-3 flex items-center gap-2 text-xs text-amber-600">
                  <Waveform /> Reading aloud…
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
