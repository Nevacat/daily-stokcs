import * as fs from 'fs';
import * as path from 'path';

/**
 * 파일 기반 저장소 (MVP용 — 추후 DB로 교체).
 * 데이터는 apps/api/data/<name>.json 에 저장된다.
 */
export class JsonStore<T> {
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
      return null;
    }
  }

  save(data: T): void {
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, this.filePath);
  }
}
