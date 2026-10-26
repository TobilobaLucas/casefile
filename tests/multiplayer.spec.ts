import { expect, test } from '@playwright/test';

test('two browsers share a real Python-generated case through the Java authority', async ({ browser }) => {
  test.skip(process.env.CASEFILE_LIVE_TEST !== 'true', 'Start the Python generator and Spring Boot API, then set CASEFILE_LIVE_TEST=true.');
  const host = await browser.newContext(); const guest = await browser.newContext();
  try {
    const a = await host.newPage(); const b = await guest.newPage();
    await a.goto('/'); await a.getByRole('button', { name: 'Play with friends' }).click();
    await a.getByLabel('Detective name').fill('Ada'); await a.getByLabel('Case seed').fill('41');
    await a.getByRole('button', { name: 'Open an investigation' }).click();
    await expect(a.getByRole('dialog')).toContainText('Case briefing', { timeout: 15_000 });
    await a.getByRole('button', { name: "Let's find the truth" }).click();
    const saved = await a.evaluate(() => JSON.parse(sessionStorage.getItem('casefile.session')!));
    expect(saved.state.caseFile.seed).toBe(41);
    expect(saved.state.caseFile).not.toHaveProperty('solution');
    expect(saved.state.caseFile).not.toHaveProperty('facts');
    await b.goto('/'); await b.getByRole('button', { name: 'Play with friends' }).click();
    await b.getByRole('button', { name: 'Join a room', exact: true }).click();
    await b.getByLabel('Detective name').fill('Tobi'); await b.getByLabel('Six-letter room code').fill(saved.state.code);
    await b.getByRole('button', { name: 'Join the investigation' }).click();
    await b.getByRole('button', { name: "Let's find the truth" }).click();
    await expect(a.getByText('TEAM CONNECTED', { exact: true })).toBeVisible();
    await expect(b.getByText('TEAM CONNECTED', { exact: true })).toBeVisible();
    await a.getByRole('button', { name: 'Examine The door remembers', exact: true }).click();
    await a.getByRole('button', { name: 'Back to the board' }).click();
    await expect(b.getByText('1/10 leads examined')).toBeVisible();
    await b.getByRole('tab', { name: 'Field notes', exact: true }).click();
    await b.getByLabel('Add a field note').fill('Tobi found the badge record.');
    await b.getByRole('button', { name: 'Pin note' }).click();
    await a.getByRole('tab', { name: /Field notes/ }).click();
    await expect(a.locator('.field-note')).toContainText('Tobi found the badge record.');
    await a.reload(); await expect(a.getByText('1/10 leads examined')).toBeVisible();
    await expect(a.getByText('TEAM CONNECTED', { exact: true })).toBeVisible();
  } finally { await host.close(); await guest.close(); }
});
