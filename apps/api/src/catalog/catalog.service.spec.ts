import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CatalogService } from './catalog.service';

function krxHtml(rows: [string, string, string][]): string {
  const body = rows
    .map(
      ([name, ticker, industry]) =>
        `<tr><td>${name}</td><td>유가</td><td style="x">${ticker}</td><td>${industry}</td><td>-</td></tr>`,
    )
    .join('');
  return `<table>${body}</table>`;
}

describe('CatalogService', () => {
  let service: CatalogService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cat-test-'));
    service = new CatalogService();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it('네트워크 없이도 큐레이션 사전으로 동작한다 (폴백)', () => {
    expect(service.list().length).toBeGreaterThanOrEqual(45);
    expect(service.find('005930')?.name).toBe('삼성전자');
    expect(service.find('NVDA')?.market).toBe('US');
  });

  it('KRX 목록을 파싱하고 업종을 섹터로 매핑한다', async () => {
    const html = krxHtml([
      ['케이뱅크', '279570', '은행 및 저축기관'],
      ['어떤바이오', '111111', '의약품 제조업'],
      ['미분류회사', '222222', '기타 서비스업'],
      ['헤더행', 'ABC', '무시됨'], // 티커 형식 불일치 → 제외
    ]);
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode(html).buffer),
    });

    await service.refresh();

    expect(service.find('279570')?.sector).toBe('finance');
    expect(service.find('111111')?.sector).toBe('bio_healthcare');
    expect(service.find('222222')?.sector).toBeUndefined(); // 미분류 — 검색·시세는 가능
    expect(service.find('ABC')).toBeNull();
    // 큐레이션 병합: 미국 종목 유지
    expect(service.find('NVDA')?.name).toBe('엔비디아');
  });

  it('KRX 항목이 큐레이션과 겹치면 별칭·도메인·섹터를 유지한다', async () => {
    const html = krxHtml([['삼성전자', '005930', '통신 및 방송 장비 제조업']]);
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode(html).buffer),
    });
    await service.refresh();
    const samsung = service.find('005930');
    expect(samsung?.domain).toBe('samsung.com');
    expect(samsung?.aliases).toContain('삼성전자');
  });

  it('빈 목록이면 갱신을 거부하고 기존 데이터를 유지한다', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: () =>
        Promise.resolve(new TextEncoder().encode('<html/>').buffer),
    });
    await expect(service.refresh()).rejects.toThrow();
    expect(service.find('005930')).not.toBeNull();
  });

  it('검색: 앞부분 일치 우선, 이름/티커 모두 지원', () => {
    const results = service.search('삼성');
    expect(results[0].name.startsWith('삼성')).toBe(true);
    expect(service.search('005930')[0].ticker).toBe('005930');
    expect(service.search('')).toHaveLength(0);
  });
});
