import { AnalyzerService } from './analyzer.service';

describe('AnalyzerService', () => {
  const analyzer = new AnalyzerService();

  it('종목명이 있으면 티커와 해당 섹터를 매핑한다', () => {
    const result = analyzer.analyze('삼성전자, 3분기 최대 실적 달성');
    expect(result.stocks.map((s) => s.ticker)).toContain('005930');
    expect(result.sectors).toContain('semiconductor_ai');
  });

  it('종목명이 없어도 섹터 키워드로 섹터를 유추한다', () => {
    const result = analyzer.analyze('2차전지 업계, 전고체 개발 경쟁 가속');
    expect(result.stocks).toHaveLength(0);
    expect(result.sectors).toContain('battery');
  });

  it('호재 키워드 → positive', () => {
    const result = analyzer.analyze('현대차, 대규모 수주 계약 체결');
    expect(result.sentiment).toBe('positive');
    expect(result.polarity).toBeGreaterThan(0);
  });

  it('악재 키워드 → negative', () => {
    const result = analyzer.analyze('셀트리온, 소송 리스크에 급락');
    expect(result.sentiment).toBe('negative');
  });

  it('호재·악재 키워드가 동수면 neutral', () => {
    const result = analyzer.analyze('수주 소식에도 급락한 기업');
    expect(result.sentiment).toBe('neutral');
    expect(result.polarity).toBe(0);
  });

  it('아무 키워드도 없으면 neutral, 섹터·종목 없음', () => {
    const result = analyzer.analyze('오늘의 날씨');
    expect(result).toEqual({
      sectors: [],
      stocks: [],
      sentiment: 'neutral',
      polarity: 0,
    });
  });
});
