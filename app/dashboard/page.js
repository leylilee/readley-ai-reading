'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../providers'

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef(null)

  const [books, setBooks] = useState([])
  const [booksLoading, setBooksLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState('')

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) fetchBooks()
  }, [user])

  async function fetchBooks() {
    setBooksLoading(true)
    const { data, error } = await supabase
      .from('books')
      .select('id, title, created_at, content')
      .order('created_at', { ascending: false })

    if (!error) setBooks(data || [])
    setBooksLoading(false)
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    setContent(text)
    if (!title) setTitle(file.name.replace(/\.txt$/i, ''))
  }

  function resetForm() {
    setTitle('')
    setContent('')
    setFileName('')
    setFormError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleAddBook(e) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) {
      setFormError('Please provide a title and some text content.')
      return
    }

    setUploading(true)
    setFormError('')

    const { error } = await supabase.from('books').insert({
      title: title.trim(),
      content: content.trim(),
      user_id: user.id,
    })

    if (error) {
      setFormError(error.message)
    } else {
      resetForm()
      setShowUpload(false)
      fetchBooks()
    }

    setUploading(false)
  }

  async function handleDelete(id, e) {
    e.preventDefault()
    e.stopPropagation()
    const confirmed = window.confirm('Remove this book from your library?')
    if (!confirmed) return
    await supabase.from('books').delete().eq('id', id)
    setBooks((prev) => prev.filter((b) => b.id !== id))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📖</span>
            <span className="text-lg font-bold text-stone-900">ReadLey</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-stone-400 hidden sm:block truncate max-w-[200px]">
              {user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-stone-500 hover:text-stone-800 font-medium transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Page title row */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-stone-900">Your Library</h2>
            <p className="text-stone-500 text-sm mt-0.5">
              {books.length} {books.length === 1 ? 'book' : 'books'}
            </p>
          </div>
          <button
            onClick={() => {
              setShowUpload((v) => !v)
              if (showUpload) resetForm()
            }}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm"
          >
            {showUpload ? '✕ Cancel' : '+ Add Book'}
          </button>
        </div>

        {/* Upload form */}
        {showUpload && (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-8 shadow-sm">
            <h3 className="text-lg font-semibold text-stone-800 mb-5">Add a Book</h3>
            <form onSubmit={handleAddBook} className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-stone-900 placeholder-stone-400 transition"
                  placeholder="Book or document title"
                />
              </div>

              {/* File upload */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Upload a .txt file
                </label>
                <label className="flex items-center gap-3 px-4 py-3 bg-stone-50 border border-stone-300 border-dashed rounded-xl cursor-pointer hover:bg-amber-50 hover:border-amber-300 transition-colors">
                  <span className="text-xl">📄</span>
                  <span className="text-sm text-stone-500">
                    {fileName ? fileName : 'Click to choose a .txt file'}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,text/plain"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Text area */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Or paste text directly
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={7}
                  className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-stone-900 placeholder-stone-400 resize-y text-sm transition"
                  placeholder="Paste your book or article text here…"
                />
                {content && (
                  <p className="text-xs text-stone-400 mt-1">
                    {content.length.toLocaleString()} characters
                  </p>
                )}
              </div>

              {formError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm"
                >
                  {uploading ? 'Saving…' : 'Save to Library'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUpload(false)
                    resetForm()
                  }}
                  className="px-6 py-2.5 text-stone-600 hover:text-stone-900 font-medium rounded-xl transition-colors text-sm border border-stone-300 hover:border-stone-400 bg-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Books grid */}
        {booksLoading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-stone-600 text-lg font-medium">Your library is empty</p>
            <p className="text-stone-400 text-sm mt-1">
              Add your first book to get started
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-6 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm"
            >
              + Add Book
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {books.map((book) => (
              <div
                key={book.id}
                className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm hover:shadow-md hover:border-amber-200 transition-all group flex flex-col"
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                    📖
                  </div>
                  <button
                    onClick={(e) => handleDelete(book.id, e)}
                    className="text-stone-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-lg leading-none ml-2 flex-shrink-0"
                    title="Remove book"
                  >
                    ✕
                  </button>
                </div>

                {/* Title */}
                <h3 className="font-semibold text-stone-800 text-sm leading-snug mb-1 line-clamp-2 flex-1">
                  {book.title}
                </h3>

                {/* Meta */}
                <p className="text-xs text-stone-400 mb-1">
                  {book.content.length.toLocaleString()} characters
                </p>
                <p className="text-xs text-stone-400 mb-4">
                  {new Date(book.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>

                {/* CTA */}
                <Link
                  href={`/read/${book.id}`}
                  className="block text-center py-2 px-4 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold rounded-xl text-sm transition-colors border border-amber-200 hover:border-amber-300"
                >
                  Read with AI →
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
