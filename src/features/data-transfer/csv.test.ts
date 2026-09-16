import { describe, expect, it } from 'vitest';
import { detectDelimiter, escapeCsvValue, normaliseHeader, parseCsv, toCsv } from './csv';

describe('parseCsv', () => {
  it('parses a simple file', () => {
    const { header, rows } = parseCsv('a,b,c\n1,2,3\n4,5,6\n');
    expect(header).toEqual(['a', 'b', 'c']);
    expect(rows).toEqual([
      ['1', '2', '3'],
      ['4', '5', '6'],
    ]);
  });

  it('keeps commas inside quoted fields', () => {
    const { rows } = parseCsv('a,b\n"Morning, quick",5\n');
    expect(rows[0]).toEqual(['Morning, quick', '5']);
  });

  it('handles escaped quotes and embedded newlines', () => {
    const { rows } = parseCsv('a,b\n"He said ""go""","line one\nline two"\n');
    expect(rows[0]).toEqual(['He said "go"', 'line one\nline two']);
  });

  it('handles CRLF endings and a UTF-8 BOM', () => {
    const { header, rows } = parseCsv('﻿a,b\r\n1,2\r\n');
    expect(header).toEqual(['a', 'b']);
    expect(rows).toEqual([['1', '2']]);
  });

  it('skips blank lines', () => {
    const { rows } = parseCsv('a,b\n1,2\n\n\n3,4\n');
    expect(rows).toHaveLength(2);
  });

  it('preserves empty fields', () => {
    const { rows } = parseCsv('a,b,c\n1,,3\n');
    expect(rows[0]).toEqual(['1', '', '3']);
  });

  it('detects a semicolon delimiter', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    const { header } = parseCsv('a;b;c\n1;2;3');
    expect(header).toEqual(['a', 'b', 'c']);
  });

  it('ignores delimiters inside quoted headers when detecting', () => {
    expect(detectDelimiter('"a,b",c\n1,2')).toBe(',');
  });
});

describe('escapeCsvValue', () => {
  it.each(['=1+1', '+1', '-1+1', '@SUM(A1)', '\tcmd'])('neutralises the formula prefix in %s', (value) => {
    expect(escapeCsvValue(value).replace(/^"|"$/g, '').startsWith("'")).toBe(true);
  });

  it('quotes values containing separators or newlines', () => {
    expect(escapeCsvValue('a,b')).toBe('"a,b"');
    expect(escapeCsvValue('a\nb')).toBe('"a\nb"');
    expect(escapeCsvValue('a"b')).toBe('"a""b"');
  });

  it('leaves ordinary values alone', () => {
    expect(escapeCsvValue('Bench Press')).toBe('Bench Press');
    expect(escapeCsvValue(42)).toBe('42');
    expect(escapeCsvValue(null)).toBe('');
  });

  it('round-trips an escaped formula back through the parser as text', () => {
    const csv = toCsv(['note'], [['=SUM(A1:A2)']]);
    const { rows } = parseCsv(csv);
    expect(rows[0]?.[0]).toBe("'=SUM(A1:A2)");
  });
});

describe('normaliseHeader', () => {
  it.each([
    ['Weight (kg)', 'weight'],
    ['Set Order', 'set_order'],
    ['  Exercise Name  ', 'exercise_name'],
    ['RPE', 'rpe'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normaliseHeader(input)).toBe(expected);
  });
});
