import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 파일 기반 저장소 (MVP용 — 추후 DB로 교체).
 * 데이터는 apps/api/data/<name>.json 에 저장된다.
 */
export class JsonStore<T> {
  private static readonly logger = new Logger(JsonStore.name);
  private readonly filePath: string;

  constructor(
    name: string,
    dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), 'data'),
  ) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, `${name}.json`);
  }

  load(): T | null {
    if (!fs.existsSync(this.filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as T;
    } catch {
      // 손상 파일은 덮어쓰기 전에 보존해 데이터 유실을 막는다 (기존 백업 미덮어쓰기)
      const backup = `${this.filePath}.corrupt-${Date.now()}`;
      try {
        fs.renameSync(this.filePath, backup);
        JsonStore.logger.warn(`손상된 저장 파일을 백업했습니다: ${backup}`);
      } catch {
        JsonStore.logger.warn(
          `손상된 저장 파일을 읽지 못했습니다: ${this.filePath}`,
        );
      }
      return null;
    }
  }

  save(data: T): void {
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, this.filePath);
  }
}
