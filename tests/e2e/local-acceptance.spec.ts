import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  const config = await request.get('/api/auth/admin/config');
  const body = await config.json();
  expect(body.configured).toBe(false);
  expect(body.allow_local_login).toBe(true);
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' || url.protocol === 'data:' ? route.continue() : route.abort();
  });
});

test('consent, student flow, results and shared-device reset', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Họ và tên học sinh' }).fill('Học sinh mô phỏng E2E');
  await page.getByRole('textbox', { name: 'Lớp', exact: false }).fill('10A1');
  await page.getByRole('textbox', { name: 'Trường học' }).fill('Trường kiểm thử local');
  const consent = page.getByRole('checkbox');
  await expect(consent).not.toBeChecked();
  await expect(page.getByRole('button', { name: /Bắt đầu hành trình/ })).toBeDisabled();
  await consent.check();
  await page.getByRole('button', { name: /Bắt đầu hành trình/ }).click();
  const instruction = page.getByRole('button', { name: /Bắt đầu.*chặng|Sẵn sàng|Bắt đầu chơi/i });
  if (await instruction.count()) await instruction.first().click();
  for (let phase = 0; phase < 3; phase++) {
    await page.locator('.answer-option').first().click();
    await page.getByRole('button', { name: /Xác nhận quyết định/ }).click();
    await expect(page.locator('.feedback')).toBeVisible();
    await page.locator('.feedback button').click();
  }
  await expect(page.locator('.result-card')).toBeVisible();
  await page.getByRole('button', { name: /Đổi người chơi/ }).first().click();
  await expect(page.getByRole('textbox', { name: 'Họ và tên học sinh' })).toHaveValue('');
  expect((await context.cookies()).some(cookie => cookie.name === 'sr_participant_session')).toBe(false);
});

test('backend registration failure is not converted to a fake session', async ({ page }) => {
  await page.goto('/');
  await page.route('**/api/public/participants', route => route.fulfill({ status: 503, body: '{}' }));
  await page.getByRole('textbox', { name: 'Họ và tên học sinh' }).fill('Học sinh giả lập lỗi');
  await page.getByRole('textbox', { name: 'Lớp', exact: false }).fill('10A1');
  await page.getByRole('textbox', { name: 'Trường học' }).fill('Trường kiểm thử local');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Bắt đầu hành trình/ }).click();
  const instruction = page.getByRole('button', { name: /Bắt đầu.*chặng|Sẵn sàng|Bắt đầu chơi/i });
  if (await instruction.count()) await instruction.first().click();
  await expect(page.getByText('Chưa thể khởi tạo phiên học tập. Vui lòng thử lại.')).toBeVisible();
  await expect(page.locator('.answer-option')).toHaveCount(0);
});

test('admin denial, local login and no Google script', async ({ page, request }) => {
  expect((await request.get('/api/admin/overview')).status()).toBe(401);
  await page.goto('/admin');
  await expect(page.getByPlaceholder('Email local...')).toBeVisible();
  await expect(page.locator('script[src*="accounts.google.com"]')).toHaveCount(0);
  await page.getByPlaceholder('Email local...').fill('local-admin@example.test');
  await page.getByRole('button', { name: 'Đăng nhập Local' }).click();
  await expect(page.getByPlaceholder('Email local...')).toHaveCount(0);
  await expect(page.getByText('local-admin@example.test', { exact: false }).first()).toBeVisible();
});
