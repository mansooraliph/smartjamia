import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { dirname, join, resolve, isAbsolute } from 'path';

/**
 * Local-disk file storage. Files are written under STORAGE_LOCAL_PATH and
 * exposed at the public `/uploads` prefix (see main.ts useStaticAssets).
 * In production this would be swapped for an S3-compatible driver.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  readonly publicPrefix = '/uploads';

  constructor(private readonly config: ConfigService) {}

  /** Absolute base directory where uploads live. */
  get baseDir(): string {
    const configured = this.config.get<string>('STORAGE_LOCAL_PATH', './uploads');
    return isAbsolute(configured)
      ? configured
      : resolve(process.cwd(), configured);
  }

  /**
   * Write a buffer to `<baseDir>/<relPath>` and return its public URL,
   * e.g. relPath "tc/shared_pool/TC-2026-000001.pdf"
   *   -> "/uploads/tc/shared_pool/TC-2026-000001.pdf"
   */
  async save(relPath: string, data: Buffer): Promise<string> {
    const clean = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const full = join(this.baseDir, clean);
    await fs.mkdir(dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return `${this.publicPrefix}/${clean}`;
  }

  /** Delete a file given the public URL returned by save(). Best-effort. */
  async deleteByUrl(url: string | null | undefined): Promise<void> {
    if (!url || !url.startsWith(`${this.publicPrefix}/`)) return;
    const rel = url.slice(this.publicPrefix.length + 1);
    try {
      await fs.unlink(join(this.baseDir, rel));
    } catch (err) {
      this.logger.warn(`Could not delete ${url}: ${(err as Error).message}`);
    }
  }
}
