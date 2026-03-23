'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const router = useRouter()

  const handleAuth = async () => {
    if (!email || !password) { toast.error('Please fill in all fields'); return }
    if (isSignUp && (!firstName || !lastName)) {
      toast.error('Please enter your first and last name'); return
    }
    setLoading(true)
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName, last_name: lastName }
          // ^ this is raw_user_meta_data — our trigger reads it
        }
      })
      if (error) { toast.error(error.message) }
      else { setEmailSent(true) }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { toast.error(error.message) }
      else { toast.success('Welcome back!'); router.push('/dashboard') }
    }
    setLoading(false)
  }

  // Email confirmation screen
  if (emailSent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md text-center">
          <div className="text-5xl mb-4">📬</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
          <p className="text-gray-500 text-sm mb-6">
            We sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account.
          </p>
          <p className="text-xs text-gray-400">
            During development, email confirmation may be disabled.
            Try logging in directly if you don't receive an email.
          </p>
          <button
            onClick={() => { setEmailSent(false); setIsSignUp(false) }}
            className="mt-6 text-blue-600 text-sm font-medium hover:underline"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Live Notes App</p>
        </div>

        {isSignUp && (
          <div className="flex gap-3 mb-3">
            <input type="text" placeholder="First name" value={firstName}
              onChange={e => setFirstName(e.target.value)}
              className="w-full border rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="text" placeholder="Last name" value={lastName}
              onChange={e => setLastName(e.target.value)}
              className="w-full border rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}

        <input type="email" placeholder="Email address" value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border rounded-lg px-4 py-3 mb-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border rounded-lg px-4 py-3 mb-4 text-sm outline-none focus:ring-2 focus:ring-blue-500" />

        <button onClick={handleAuth} disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <button onClick={() => setIsSignUp(!isSignUp)} className="text-blue-600 font-medium hover:underline">
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  )
}
