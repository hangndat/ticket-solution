import type { Page } from 'playwright/test';
import { expect } from '../harness/fixtures';
import type { E2EManifest } from '../harness/contract';
import { decodeTicketQrPngFromRawMime } from './mailpit-mime.mjs';

type MailSummary = {
  ID: string;
  To?: Array<{ Address?: string }>;
  Subject?: string;
};
type MailDetail = { Text?: string; HTML?: string; Subject?: string };
export type CapturedMail = MailDetail & { messageId: string };

/** Poll the run-owned SMTP sink. Message IDs and claim tokens stay in memory only. */
export async function waitForMail(
  page: Page,
  manifest: E2EManifest,
  recipient: string,
  subjectPart: string,
): Promise<CapturedMail> {
  let found: MailSummary | undefined;
  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          new URL('/api/v1/messages', manifest.origins.mailpit).toString(),
        );
        if (response.status() !== 200) return false;
        const list = (await response.json()) as { messages?: MailSummary[] };
        const candidates =
          list.messages?.filter(
            (mail) =>
              mail.To?.some(
                (to) => to.Address?.toLowerCase() === recipient.toLowerCase(),
              ) && (mail.Subject ?? '').includes(subjectPart),
          ) ?? [];
        found = candidates.length ? candidates[candidates.length - 1] : undefined;
        return Boolean(found);
      },
      { timeout: 30_000, intervals: [250, 500, 1000] },
    )
    .toBe(true);
  const response = await page.request.get(
    new URL(
      `/api/v1/message/${encodeURIComponent(found!.ID)}`,
      manifest.origins.mailpit,
    ).toString(),
  );
  expect(response.status()).toBe(200);
  return {
    messageId: found!.ID,
    ...((await response.json()) as MailDetail),
  };
}

/** Mailpit raw MIME — inline PNG for cid:ticket-qr, not HTML CID alone. */
export async function assertTicketQrInlineAttachment(
  page: Page,
  manifest: E2EManifest,
  messageId: string,
): Promise<void> {
  const rawResponse = await page.request.get(
    new URL(
      `/api/v1/message/${encodeURIComponent(messageId)}/raw`,
      manifest.origins.mailpit,
    ).toString(),
  );
  expect(rawResponse.status()).toBe(200);
  const rawMime = await rawResponse.text();
  const png = decodeTicketQrPngFromRawMime(rawMime);
  expect(png.length).toBeGreaterThan(0);
}

export function claimLink(mail: MailDetail, webOrigin: string): string {
  const text = mail.Text ?? '';
  const match = text.match(/https:\/\/[^\s<>"']+\/claim#[^\s<>"']+/);
  if (!match) throw new Error('BLOCKED: InvitationReady không chứa claim link');
  const url = new URL(match[0].replace(/&amp;/g, '&'));
  expect(url.origin).toBe(new URL(webOrigin).origin);
  expect(url.pathname).toBe('/claim');
  return url.toString();
}

export function ticketLink(mail: MailDetail, webOrigin: string): string {
  const text = mail.Text ?? '';
  const match = text.match(
    /https:\/\/[^\s<>"']+\/t\/[^\s<>"']+\/tickets\/[0-9a-f-]{36}/i,
  );
  if (!match)
    throw new Error('BLOCKED: TicketIssued không chứa owner ticket link');
  const url = new URL(match[0]);
  expect(url.origin).toBe(new URL(webOrigin).origin);
  return url.toString();
}

/** Mailpit body evidence for TicketIssued — not SMTP ACCEPTED alone. */
export async function assertTicketIssuedMail(
  page: Page,
  manifest: E2EManifest,
  mail: CapturedMail,
  opts: { eventName: string; ticketId: string; webOrigin: string },
): Promise<string> {
  expect(mail.Subject ?? '').toContain(opts.eventName);
  const url = ticketLink(mail, opts.webOrigin);
  const mailTicketId = url.match(/\/tickets\/([0-9a-f-]{36})/i)?.[1];
  expect(mailTicketId).toBe(opts.ticketId);
  expect(mail.Text ?? '').toContain(opts.ticketId);
  expect(mail.HTML ?? '').toContain('cid:ticket-qr');
  await assertTicketQrInlineAttachment(page, manifest, mail.messageId);
  return url;
}
