'use client'

import { useState, useEffect, useRef } from 'react'

// Prefer more natural-sounding voices over robotic system defaults
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

export function useSpeech() {
  const [voices, setVoices] = useState([])
  const [selectedVoice, _setSelected] = useState(null)
  const [speaking, setSpeaking] = useState(null) // source key or null
  const [resumeAt, setResumeAtState] = useState({}) // { [source]: charIndex }

  // Refs let speak() always read the latest values without stale closures
  const voiceRef = useRef(null)
  const resumeRef = useRef({})

  function setSelectedVoice(v) {
    _setSelected(v)
    voiceRef.current = v
    if (v && typeof localStorage !== 'undefined') {
      localStorage.setItem('readley_voice', v.name)
    }
  }

  function setResumeAt(updater) {
    const next =
      typeof updater === 'function' ? updater(resumeRef.current) : updater
    resumeRef.current = next
    setResumeAtState(next)
  }

  // Load voices — handles both Chrome (async voiceschanged) and Safari (sync)
  useEffect(() => {
    if (typeof window === 'undefined') return

    function load() {
      const all = window.speechSynthesis.getVoices()
      if (!all.length) return
      const en = all.filter((v) => v.lang.startsWith('en'))
      setVoices(en)
      if (voiceRef.current) return // don't overwrite user's choice
      const saved =
        typeof localStorage !== 'undefined' &&
        localStorage.getItem('readley_voice')
      const pick =
        (saved && en.find((v) => v.name === saved)) || pickBestVoice(en)
      if (pick) {
        _setSelected(pick)
        voiceRef.current = pick
      }
    }

    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load)
      window.speechSynthesis.cancel()
    }
  }, [])

  function stopSpeech() {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    setSpeaking(null)
    // resumeAt intentionally preserved — that's the whole point
  }

  function speak(rawText, source, { markdown = false, restart = false } = {}) {
    if (!rawText || typeof window === 'undefined') return

    const cleaned = prepareText(rawText, markdown)
    const offset = restart ? 0 : (resumeRef.current[source] ?? 0)
    const slice = cleaned.slice(offset)

    // If we're already at the end, restart automatically
    if (!slice.trim()) {
      setResumeAt((prev) => ({ ...prev, [source]: 0 }))
      speak(rawText, source, { markdown, restart: true })
      return
    }

    window.speechSynthesis.cancel()

    const u = new SpeechSynthesisUtterance(slice)
    u.rate = 0.88   // slightly slower = more natural
    u.pitch = 1.05  // slight lift reduces robotic flatness
    if (voiceRef.current) u.voice = voiceRef.current

    // Track word position so we can resume later
    u.onboundary = (e) => {
      if (e.name === 'word') {
        setResumeAt((prev) => ({ ...prev, [source]: offset + e.charIndex }))
      }
    }
    u.onstart = () => setSpeaking(source)
    u.onend = () => {
      setSpeaking(null)
      setResumeAt((prev) => ({ ...prev, [source]: 0 })) // natural end → reset
    }
    u.onerror = (e) => {
      setSpeaking(null)
      // 'interrupted' means we called cancel() manually — keep position
      if (e.error !== 'interrupted') {
        setResumeAt((prev) => ({ ...prev, [source]: 0 }))
      }
    }

    window.speechSynthesis.speak(u)
  }

  return { voices, selectedVoice, setSelectedVoice, speaking, speak, stopSpeech, resumeAt }
}
