import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tjstyxrqmqenfxdnyymy.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqc3R5eHJxbXFlbmZ4ZG55eW15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzAyMTQsImV4cCI6MjA5MjAwNjIxNH0.C2jp6nf4N5mPp7MovTcNjshUSQdBioJKNYG918yG334'

export const supabase = createClient(supabaseUrl, supabaseKey)
