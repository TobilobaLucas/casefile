import { expect, test } from '@playwright/test';

test('a detective can inspect, interview, take notes, reload, and solve the case', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /The Midnight Exchange/ })).toBeVisible();
  await page.getByRole('button', { name: 'Examine The door remembers', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('N-41');
  await page.getByRole('button', { name: 'Back to the board' }).click();
  await page.getByRole('button', { name: 'Examine A paper trail', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('assigned locker 12');
  await page.getByRole('button', { name: 'Back to the board' }).click();
  await page.getByRole('tab', { name: /Suspect dossiers/ }).click();
  await page.locator('.suspect-card').filter({ has: page.getByRole('heading', { name: 'Elias Reed', exact: true }) }).click();
  await page.getByRole('button', { name: 'Conduct interview' }).click();
  await expect(page.getByRole('dialog')).toContainText('never left my pocket');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Field notes', exact: true }).click();
  await page.getByLabel('Add a field note').fill('Badge N-41 and locker 12 contradict the alibi.');
  await page.getByRole('button', { name: 'Pin note' }).click();
  await expect(page.locator('.field-note')).toContainText('Badge N-41');
  await page.reload();
  await expect(page.getByText('3/10 leads examined')).toBeVisible();
  await page.getByRole('button', { name: 'Make an accusation' }).click();
  await page.getByRole('radio', { name: /Elias Reed/ }).check();
  await page.getByRole('checkbox', { name: /The door remembers/ }).check();
  await page.getByRole('checkbox', { name: /A paper trail/ }).check();
  await page.getByRole('button', { name: 'Submit accusation' }).click();
  await expect(page.getByRole('dialog')).toContainText('The truth');
  await expect(page.getByRole('dialog')).toContainText('always surfaces.');
  await expect(page.getByRole('dialog')).toContainText('CASE MX-41 / CLOSED');
  expect(errors).toEqual([]);
});

test('connections can be created and removed from either direction', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Connect clues' }).click();
  await page.getByRole('button', { name: 'Connect The door remembers', exact: true }).click();
  await page.getByRole('button', { name: 'Connect A paper trail', exact: true }).click();
  await expect(page.locator('.toolbar-count')).toContainText('1 connections');
  await page.getByRole('button', { name: 'Connect A paper trail', exact: true }).click();
  await page.getByRole('button', { name: 'Connect The door remembers', exact: true }).click();
  await expect(page.locator('.toolbar-count')).toContainText('0 connections');
});

test('team play surfaces server failures without silently switching modes', async ({ page }) => {
  await page.route('**/api/rooms', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'The case engine is unavailable.' }) }));
  await page.goto('/'); await page.getByRole('button', { name: 'Play with friends' }).click();
  await page.getByLabel('Detective name').fill('Ada');
  await page.getByRole('button', { name: 'Open an investigation' }).click();
  await expect(page.getByRole('alert')).toHaveText('The case engine is unavailable.');
  await expect(page.getByText('SOLO DEMO · NO SIGN-UP')).toBeVisible();
});

test('mobile board stays readable and the page has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await expect(page.getByRole('button', { name: 'Examine The door remembers', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Examine A paper trail', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
});

test('capture the investigation board', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Connect clues' }).click();
  await page.getByRole('button', { name: 'Connect The door remembers', exact: true }).click();
  await page.getByRole('button', { name: 'Connect A paper trail', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.screenshot({ path: 'docs/screenshot.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/mobile.png', fullPage: true, animations: 'disabled' });
});
