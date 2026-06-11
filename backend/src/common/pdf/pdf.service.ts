import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import puppeteer, { Browser } from 'puppeteer';

/**
 * Renders HTML to PDF using a single shared headless-Chromium instance.
 * Always invoked from background jobs — never on the request path.
 *
 * Chromium resolution order:
 *   1. PUPPETEER_EXECUTABLE_PATH (explicit override)
 *   2. A detected system Chrome/Edge install
 *   3. Puppeteer's bundled Chromium
 * This avoids hard failures when antivirus quarantines the bundled binary
 * (a common occurrence with Puppeteer's Chromium on Windows).
 */
@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  constructor(private readonly config: ConfigService) {}

  private resolveExecutablePath(): string | undefined {
    const override = this.config.get<string>('PUPPETEER_EXECUTABLE_PATH');
    if (override && existsSync(override)) return override;

    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];
    return candidates.find((p) => existsSync(p));
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;
    if (!this.launching) {
      const executablePath = this.resolveExecutablePath();
      this.launching = puppeteer
        .launch({
          headless: 'new',
          executablePath, // undefined => Puppeteer's bundled Chromium
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
        .then((b) => {
          this.browser = b;
          this.launching = null;
          this.logger.log(
            `Headless Chromium launched (${executablePath ?? 'bundled'})`,
          );
          return b;
        })
        .catch((err) => {
          this.launching = null;
          throw err;
        });
    }
    return this.launching;
  }

  async htmlToPdf(
    html: string,
    opts: {
      landscape?: boolean;
      margin?: { top: string; bottom: string; left: string; right: string };
    } = {},
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        landscape: opts.landscape ?? false,
        printBackground: true,
        margin: opts.margin ?? {
          top: '16mm',
          bottom: '18mm',
          left: '14mm',
          right: '14mm',
        },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
  }
}
