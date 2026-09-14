import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { chromium, type Browser } from '@playwright/test'

const require = createRequire(import.meta.url)
let browser: Browser
let directory = ''
let bundle = ''

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'credit-retirement-'))
  bundle = path.join(directory, 'bundle.js')
  const shell = path.join(directory, 'shell.tsx')
  const navigation = path.join(directory, 'navigation.ts')
  const entry = path.join(directory, 'entry.tsx')
  await writeFile(shell, 'export function DashboardShell({ children }) { return children }')
  await writeFile(navigation, `const router = { push() {}, prefetch() {}, replace() {} }; export const useRouter = () => router; export const usePathname = () => '/create'`)
  await writeFile(entry, `
    import * as React from 'react'
    import { createRoot } from 'react-dom/client'
    import styles from ${JSON.stringify(path.resolve('src/components/create/canvas.module.css'))}
    import { CanvasPromptBox } from ${JSON.stringify(path.resolve('src/components/create/CanvasPromptBox.tsx'))}
    import { CreditBalanceBadge } from ${JSON.stringify(path.resolve('src/components/create/CreditBalanceBadge.tsx'))}
    import History from ${JSON.stringify(path.resolve('src/app/account/credits/page.tsx'))}
    import Billing from ${JSON.stringify(path.resolve('src/app/billing/page.tsx'))}
    import AdminHistory from ${JSON.stringify(path.resolve('src/app/admin/credits/page.tsx'))}
    import Account from ${JSON.stringify(path.resolve('src/app/account/page.tsx'))}
    import { TopNavigation } from ${JSON.stringify(path.resolve('src/components/layout/TopNavigation.tsx'))}
    import { useAuthStore } from ${JSON.stringify(path.resolve('src/store/auth.store.ts'))}
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-1', displayName: 'Test user', email: 'test@example.com', role: 'ADMIN' } })
    const scenario = new URLSearchParams(location.search).get('scenario')
    function Prompt() {
      const [prompt, setPrompt] = React.useState('Original scene')
      const [calls, setCalls] = React.useState(0)
      return <div className={styles.canvasPage} style={{ width: '100%', minHeight: 300 }}>
        <CanvasPromptBox prompt={prompt} onPromptChange={setPrompt}
          model="openai-text" models={['openai-text']} onModelChange={() => {}}
          placeholder="Prompt" estimatedCredits={987} layout={scenario === 'workspace' ? 'workspace' : 'node'}
          onGenerate={() => setCalls(calls + 1)} />
        <output>{calls}</output>
      </div>
    }
    createRoot(document.getElementById('root')).render(
      scenario === 'badge' ? <div data-ready><CreditBalanceBadge /></div> :
      scenario === 'history' ? <History /> : scenario === 'billing' ? <Billing /> :
      scenario === 'admin' ? <AdminHistory /> : scenario === 'account' ? <Account /> :
      scenario === 'navigation' ? <TopNavigation /> : <Prompt />
    )
  `)
  const result = spawnSync(require.resolve('esbuild/bin/esbuild'), [
    entry, '--bundle', '--platform=browser', '--format=iife', '--jsx=automatic', '--external:/brand/*',
    `--outfile=${bundle}`, `--tsconfig=${path.resolve('tsconfig.json')}`,
    `--alias:@/components/layout/DashboardShell=${shell}`,
    `--alias:next/navigation=${navigation}`,
    '--define:process.env.NODE_ENV="test"',
    '--banner:js=window.process={env:{}};',
    '--define:process.env.NEXT_PUBLIC_PLATFORM_CREDITS_RECHARGE_ENABLED="true"',
  ], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  browser = await chromium.launch({ headless: true })
})

after(async () => {
  await browser?.close()
  if (directory) await rm(directory, { recursive: true, force: true })
})

async function render(scenario: string, width = 390, status = 200) {
  const page = await browser.newPage({ viewport: { width, height: 700 } })
  page.setDefaultTimeout(4000)
  const requests: { url: string; method: string }[] = []
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('http://city.test/**', async (route) => {
    const url = route.request().url()
    if (!url.includes('/api/')) return route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><div id="root"></div></body></html>' })
    requests.push({ url, method: route.request().method() })
    const data = url.includes('/ledger') ? { items: [{ id: 'ledger-1', type: 'RECHARGE', amountCredits: 50, balanceAfter: 50, description: 'Historical entry' }] }
      : url.includes('/orders') || url.includes('/my-orders') ? { orders: [{ id: 'order-1', userId: 'user-1', user: { displayName: 'Test user' }, status: 'PENDING', amountCredits: 50, note: 'Historical order', createdAt: '2026-01-01T00:00:00Z' }], total: 1 }
      : { auth: { authenticated: true }, authenticated: true, user: { id: 'user-1', displayName: 'Test user', email: 'test@example.com', role: 'ADMIN' }, success: true, availableCredits: 987, packages: [], walletSummary: { availableCredits: 987, reservedCredits: 0, lifetimePurchasedCredits: 987, lifetimeSpentCredits: 0 } }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto(`http://city.test/?scenario=${scenario}`)
  await page.addStyleTag({ path: bundle.replace('.js', '.css') })
  await page.addScriptTag({ path: bundle })
  await page.evaluate(() => new Promise(requestAnimationFrame))
  assert.deepEqual(errors, [], 'browser runtime must render before behavioral assertions')
  return { page, requests, errors }
}

for (const layout of ['node', 'workspace']) {
  for (const width of [390, 1280]) {
    test(`${layout} prompt at ${width}px hides legacy prices and still edits/generates`, async () => {
      const { page, errors } = await render(layout, width)
      try {
        await page.getByRole('button', { name: '生成', exact: true }).waitFor()
        assert.doesNotMatch(await page.locator('#root').innerText(), /credits|987|◉/i)
        await page.getByPlaceholder('Prompt').fill('Edited scene')
        assert.equal(await page.getByPlaceholder('Prompt').inputValue(), 'Edited scene')
        await page.getByRole('button', { name: '生成', exact: true }).click()
        assert.equal(await page.locator('output').innerText(), '1')
        assert.equal(await page.locator('.is-credit-pill, .canvas-credit-pill').count(), 0)
        assert.deepEqual(errors, [])
      } finally { await page.close() }
    })
  }
}

test('retired badge renders nothing and never requests the wallet', async () => {
  const { page, requests, errors } = await render('badge')
  try {
    await page.locator('[data-ready]').waitFor({ state: 'attached' })
    assert.equal(await page.locator('[data-ready]').innerHTML(), '')
    assert.deepEqual(requests, [])
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

for (const scenario of ['history', 'billing', 'admin']) {
  test(`${scenario} retains read-only records without checkout or grant controls`, async () => {
    const { page, requests, errors } = await render(scenario)
    try {
      await page.locator('main h1').waitFor()
      assert.match(await page.locator('main').innerText(), /历史/)
      assert.equal(await page.locator('form, input[type="number"]').count(), 0)
      assert.equal(await page.getByRole('button', { name: /充值|购买|发放|批准|拒绝|提交申请/ }).count(), 0)
      await page.getByText(scenario === 'admin' ? 'Historical order' : 'Historical entry', { exact: true }).waitFor()
      assert.equal(requests.some(({ url, method }) => method !== 'GET' || /bootstrap|wallet|balance|packages|payment/.test(url)), false)
      assert.deepEqual(errors, [])
    } finally { await page.close() }
  })
}

test('history does not disguise unauthorized access as an empty ledger', async () => {
  const { page } = await render('history', 390, 401)
  try {
    await page.getByRole('link', { name: '登录', exact: true }).waitFor()
    assert.equal(await page.getByText('暂无账本记录').count(), 0)
  } finally { await page.close() }
})

test('canvas defaults to wire-compatible platform API and retains explicit BYOK guards', async () => {
  const source = await readFile(path.resolve('src/components/create/VisualCanvasWorkspace.tsx'), 'utf8')
  assert.ok(/const \[billingMode, setBillingMode\] = useState<[^\n]+>\('platform_credits'\)/.test(source), 'platform API must be the default')
  assert.match(source, /setBillingMode\('user_provider_account'\)/)
  assert.match(source, /billingMode === 'user_provider_account' && !selectedUserAccountId/)
  assert.match(source, />平台 API</)
  assert.doesNotMatch(source, /estimateCreditCost|<CreditBalanceBadge|<CreditInsufficientModal|平台积分|平台额度/)
})

for (const scenario of ['account', 'navigation']) {
  test(`${scenario} links to history without offering credits and keeps membership and BYOK`, async () => {
    const { page, errors } = await render(scenario)
    try {
      if (scenario === 'navigation') await page.getByRole('button', { name: /Test/ }).click()
      await page.locator('a[href="/account/credits"]').waitFor()
      assert.match(await page.locator('a[href="/account/credits"]').innerText(), /历史账单/)
      assert.doesNotMatch(await page.locator('#root').innerText(), /充值|平台额度|平台积分/)
      assert.ok(await page.locator('a[href="/account/providers"]').count())
      assert.ok(await page.locator('a[href="/account/membership"]').count())
      assert.deepEqual(errors, [])
    } finally { await page.close() }
  })
}

for (const file of ['app/settings/page.tsx', 'app/account/membership/page.tsx', 'app/account/providers/page.tsx', 'app/billing/success/page.tsx', 'app/billing/cancel/page.tsx']) {
  test(`${file} no longer advertises future credit sales or BYOK as the default`, async () => {
    const source = await readFile(path.resolve('src', file), 'utf8')
    assert.ok(!/积分与账单|积分与充值|返回购买积分|查看我的积分|平台额度|平台积分|第一版默认使用你自己的 API Key|查看生成额度、充值记录与套餐信息/.test(source), file)
  })
}

test('admin provider management hides City credit prices while retaining provider prices', async () => {
  const source = await readFile(path.resolve('src/app/admin/providers/page.tsx'), 'utf8')
  assert.ok(!/>Credits<|\{provider.creditsPerCall\}|积分成本|不扣平台积分/.test(source))
  assert.match(source, /provider\.estimatedCost/)
})

test('text picker includes both configured Kimi ids without putting text providers in image options', async () => {
  const source = await readFile(path.resolve('src/components/create/VisualCanvasWorkspace.tsx'), 'utf8')
  const textOptions = source.slice(source.indexOf('const TEXT_NODE_PROVIDER_OPTIONS'), source.indexOf('const IMAGE_NODE_PROVIDER_OPTIONS'))
  const imageOptions = source.slice(source.indexOf('const IMAGE_NODE_PROVIDER_OPTIONS'), source.indexOf('const VIDEO_NODE_PROVIDER_OPTIONS'))
  assert.match(textOptions, /value: 'kimi-text'/)
  assert.match(textOptions, /value: 'kimi-multimodal'/)
  assert.doesNotMatch(imageOptions, /kimi|deepseek/)
})

for (const file of ['app/account/usage/page.tsx', 'app/account/providers/[id]/page.tsx', 'components/create/BeginnerGuidePanel.tsx']) {
  test(`${file} removes active credit guidance and fee amounts`, async () => {
    const source = await readFile(path.resolve('src', file), 'utf8')
    assert.ok(!/平台额度|购买 Creator City 积分|充值|购买的平台积分|\{item.platformServiceFeeCredits|\$\{usageSummary.platformServiceFeeCredits/.test(source), file)
  })
}
