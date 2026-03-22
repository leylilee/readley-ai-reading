'use client'

import { useState, useEffect, useRef } from 'react'

function pickBestVoice(voices) {
  const en = voices.filter((v) => v.lang.startsWith('en'))
  return (
    en.find((v) => v.name.startsWith('Google')) ||
    en.find((v) => /Neural|Premium|Enhanced/.test(v.name)) ||
    en.find((v) => /Samantha|Karen|Daniel|Moira|Serena|Rishi/.test(v.name)) ||
    en[0] ||
    voices[0] ||
    null
  )
}

export function stripMarkdown(text) {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/!\[.*?\]\(.+?\)/g, '')
}

function prepareText(raw, isMarkdown) {
  const text = isMarkdown ? stripMarkdown(raw) : raw
  return text
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

// Split into chunks at sentence boundaries to stay well under Chrome's
// ~250-word limit for network voices (e.g. Google TTS).
const CHUNK_SIZE = 1200 // characters

function chunkText(text) {
  if (text.length <= CHUNK_SIZE) return [text]
  const chunks = []
  let i = 0
  while (i < text.length) {
    let end = Math.min(i + CHUNK_SIZE, text.length)
    if (end < text.length) {
      // Prefer breaking at a sentence end
      const sentenceEnd = text.lastIndexOf('. ', end)
      if (sentenceEnd > i + CHUNK_SIZE / 2) {
        end = sentenceEnd + 2
      } else {
        // Fall back to word boundary
        const wordEnd = text.lastIndexOf(' ', end)
        if (wordEnd > i) end = wordEnd + 1
      }
    }
    chunks.push(text.slice(i, end))
    i = end
  }
  return chunks
}

export function useSpeech() {
  const [voices, setVoices] = useState([])
  const [selectedVoice, _setSelected] = useState(null)
  const [speaking, setSpeaking] = useState(null)
  const [resumeAt, setResumeAtState] = useState({})

  const voiceRef = useRef(null)
  const resumeRef = useRef({})
  const keepAliveRef = useRef(null)
  const cancelledRef = useRef(false) // true when user manually stopped

  function setSelectedVoice(v) {
    _setSelected(v)
    voiceRef.current = v
    if (v && typeof localStorage !== 'undefined') {
      localStorage.setItem('readley_voice', v.name)
    }
  }

  function setResumeAt(updater) {
    const next = typeof updater === 'function' ? updater(resumeRef.current) : updater
    resumeRef.current = next
    setResumeAtState(next)
  }

  function clearKeepAlive() {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
  }

  // Chrome bug: speechSynthesis auto-pauses after ~15s of playback.
  // Calling resume() periodically keeps it going.
  function startKeepAlive() {
    clearKeepAlive()
    keepAliveRef.current = setInterval(() => {
      if (typeof window !== 'undefined' && window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
      }
    }, 10000)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    function load() {
      const all = window.speechSynthesis.getVoices()
      if (!all.length) return
      const en = all.filter((v) => v.lang.startsWith('en'))
      setVoices(en)
      if (voiceRef.current) return
      const saved =
        typeof localStorage !== 'undefined' && localStorage.getItem('readley_voice')
      const pick = (saved && en.find((v) => v.name === saved)) || pickBestVoice(en)
      if (pick) { _setSelected(pick); voiceRef.current = pick }
    }

    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load)
      window.speechSynthesis.cancel()
      clearKeepAlive()
    }
  }, [])

  function stopSpeech() {
    cancelledRef.current = true
    clearKeepAlive()
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    setSpeaking(null)
  }

  function speak(rawText, source, { markdown = false, restart = false } = {}) {
    if (!rawText || typeof window === 'undefined') return

    const cleaned = prepareText(rawText, markdown)
    const offset = restart ? 0 : (resumeRef.current[source] ?? 0)
    const slice = cleaned.slice(offset)

    if (!slice.trim()) {
      setResumeAt((prev) => ({ ...prev, [source]: 0 }))
      speak(rawText, source, { markdown, restart: true })
      return
    }

    cancelledRef.current = false
    window.speechSynthesis.cancel()

    const chunks = chunkText(slice)
    let chunkIdx = 0
    let chunkOffset = 0 // sum of chars of completed chunks within slice

    function speakNext() {
      // User stopped — bail out
      if (cancelledRef.current) return

      if (chunkIdx >= chunks.length) {
        clearKeepAlive()
        setSpeaking(null)
        setResumeAt((prev) => ({ ...prev, [source]: 0 }))
        return
      }

      const chunk = chunks[chunkIdx]
      const absoluteChunkStart = offset + chunkOffset

      const u = new SpeechSynthesisUtterance(chunk)
      u.rate = 0.88
      u.pitch = 1.05
      if (voiceRef.current) u.voice = voiceRef.current

      u.onboundary = (e) => {
        if (e.name === 'word') {
          setResumeAt((prev) => ({ ...prev, [source]: absoluteChunkStart + e.charIndex }))
        }
      }

      u.onstart = () => {
        setSpeaking(source)
        if (chunkIdx === 0) startKeepAlive()
      }

      u.onend = () => {
        if (cancelledRef.current) return
        chunkOffset += chunk.length
        chunkIdx++
        speakNext()
      }

      u.onerror = (e) => {
        clearKeepAlive()
        setSpeaking(null)
        if (e.error !== 'interrupted') {
          setResumeAt((prev) => ({ ...prev, [source]: 0 }))
        }
      }

      // Small delay on the very first chunk — Chrome needs a moment after
      // cancel() before it will accept a new speak() call reliably.
      if (chunkIdx === 0) {
        setTimeout(() => {
          if (!cancelledRef.current) window.speechSynthesis.speak(u)
        }, 50)
      } else {
        window.speechSynthesis.speak(u)
      }
    }

    speakNext()
  }

  return { voices, selectedVoice, setSelectedVoice, speaking, speak, stopSpeech, resumeAt }
}
