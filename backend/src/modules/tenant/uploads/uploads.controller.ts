import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { StorageService } from '../../../common/storage/storage.service';

interface UploadedAny {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

@ApiTags('school/uploads')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Controller('school/uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  // Gated under the students module — uploads are used for student photos,
  // documents and qualification certificates.
  @RequirePermissions('/students:create')
  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }),
  )
  @ApiOperation({ summary: 'Upload an image or PDF, returns its public URL' })
  async upload(
    @Tenant() t: TenantContext,
    @UploadedFile() file: UploadedAny,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!ALLOWED.has(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported file type — use JPG, PNG, WEBP, GIF or PDF',
      );
    }
    const ext = (extname(file.originalname) || '').toLowerCase().slice(0, 10);
    const key = `${t.schoolId}/${randomUUID()}${ext}`;
    const url = await this.storage.save(key, file.buffer);
    return {
      url,
      name: file.originalname,
      size: file.size,
      mime: file.mimetype,
    };
  }
}
