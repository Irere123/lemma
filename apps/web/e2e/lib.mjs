// Shared helpers for the editor end-to-end checks. They run against a real
// local stack: `wrangler dev --env local` on API_URL and the built web app on
// APP_URL (see e2e/README.md). Truth is always what the server holds.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

export const APP = process.env.APP_URL ?? 'http://localhost:5173'
export const API = process.env.API_URL ?? 'http://localhost:4000'
export const WRITER = {
  email: process.env.E2E_EMAIL ?? 'e2e-writer@example.test',
  password: 'e2e-password-123',
  name: 'E2E Writer',
  username: 'e2e-writer',
}

const API_DIR = fileURLToPath(new URL('../../api', import.meta.url))

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function launch(options = {}) {
  return chromium.launch(options)
}

let provisioned = false

/**
 * A browser context signed in as the e2e writer. The account is created on
 * first use and marked verified directly in the local database (sign-up
 * requires email verification, and no mail goes out locally).
 */
export async function newSignedInContext(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  if (await signIn(context)) return context
  if (!provisioned) {
    const res = await context.request.post(`${API}/auth/sign-up/email`, {
      data: { email: WRITER.email, password: WRITER.password, name: WRITER.name },
      headers: { Origin: APP },
    })
    if (!res.ok() && res.status() !== 422) {
      throw new Error(`sign-up failed ${res.status()} ${await res.text()}`)
    }
    execFileSync(
      'bunx',
      [
        'wrangler',
        'd1',
        'execute',
        'lemma-local',
        '--env',
        'local',
        '--local',
        '--command',
        `UPDATE user SET email_verified = 1, username = '${WRITER.username}' WHERE email = '${WRITER.email}'`,
        // Same state directory the API was started with (`wrangler dev --persist-to`).
        ...(process.env.E2E_PERSIST_TO ? ['--persist-to', process.env.E2E_PERSIST_TO] : []),
      ],
      { cwd: API_DIR, stdio: 'pipe' }
    )
    provisioned = true
  }
  if (!(await signIn(context))) throw new Error('sign-in failed after provisioning the writer')
  return context
}

async function signIn(context) {
  const res = await context.request.post(`${API}/auth/sign-in/email`, {
    data: { email: WRITER.email, password: WRITER.password },
    headers: { Origin: APP },
  })
  return res.ok()
}

export async function trpcMutation(context, path, input) {
  const res = await context.request.post(`${API}/trpc/${path}?batch=1`, {
    data: { 0: { json: input } },
    headers: { Origin: APP, 'content-type': 'application/json' },
  })
  const body = await res.json()
  if (!res.ok()) throw new Error(`${path} ${res.status()} ${JSON.stringify(body).slice(0, 500)}`)
  return body[0].result.data.json
}

export async function trpcQuery(context, path, input) {
  const query = encodeURIComponent(JSON.stringify({ 0: { json: input } }))
  const res = await context.request.get(`${API}/trpc/${path}?batch=1&input=${query}`, {
    headers: { Origin: APP },
  })
  const body = await res.json()
  if (!res.ok()) throw new Error(`${path} ${res.status()} ${JSON.stringify(body).slice(0, 500)}`)
  return body[0].result.data.json
}

export const createDoc = (context, { title = 'E2E doc', content = null } = {}) =>
  trpcMutation(context, 'documents.upsertDocument', { title, content })

export const serverText = async (context, id) =>
  (await trpcQuery(context, 'documents.getMarkdown', { id })).markdown.trim()

export async function openEditor(page, id) {
  await page.goto(`${APP}/write/${id}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.waitForFunction(() => document.querySelector('.ProseMirror')?.editor, null, {
    timeout: 120_000,
  })
}

export const saveState = (page) =>
  page
    .locator('[data-save-state]')
    .getAttribute('data-save-state')
    .catch(() => '(closed)')

export const waitSaved = (page, timeout = 30_000) =>
  page.waitForFunction(
    () => document.querySelector('[data-save-state]')?.getAttribute('data-save-state') === 'saved',
    null,
    { timeout, polling: 50 }
  )

export async function typeAtEnd(page, text) {
  await page.evaluate(() => document.querySelector('.ProseMirror').editor.commands.focus('end'))
  await sleep(50)
  await page.keyboard.type(text, { delay: 25 })
}

export const paragraph = (text) => ({
  type: 'paragraph',
  content: text ? [{ type: 'text', text }] : [],
})

/** Collects named pass/fail checks; `finish()` prints them and sets the exit code. */
export function checks(suite) {
  const results = []
  return {
    check(name, pass, detail = {}) {
      results.push({ name, pass: Boolean(pass), ...detail })
      console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ` ${JSON.stringify(detail)}`}`)
    },
    finish() {
      const failed = results.filter((result) => !result.pass)
      console.log(`${suite}: ${results.length - failed.length}/${results.length} passed`)
      process.exitCode = failed.length > 0 ? 1 : 0
      return results
    },
  }
}
