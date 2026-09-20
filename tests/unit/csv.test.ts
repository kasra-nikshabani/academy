import { describe, expect, it } from "vitest";
import { UTF8_BOM, csvCell, csvFilename, toCsv } from "@/lib/reports/csv";

describe("a cell", () => {
  it("passes ordinary text through untouched", () => {
    expect(csvCell("علی رضایی")).toBe("علی رضایی");
    expect(csvCell("SEP-1405-0001")).toBe("SEP-1405-0001");
  });

  /**
   * The rule that inverts for exports. A spreadsheet given «۸۵» stores text:
   * it will not sum, sort or chart it, and the manager who exported the
   * figures in order to work on them cannot.
   */
  it("writes numbers in Latin digits with no grouping", () => {
    expect(csvCell(85)).toBe("85");
    expect(csvCell(1234567)).toBe("1234567");
    expect(csvCell(3.5)).toBe("3.5");
    expect(csvCell(0)).toBe("0");
  });

  it("leaves a missing value blank rather than writing the word", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    // A blank is what `ISBLANK` agrees with; "null" is a four-letter string.
    expect(csvCell(null)).not.toContain("null");
  });

  it("refuses to write a number that is not one", () => {
    expect(csvCell(Number.NaN)).toBe("");
    expect(csvCell(Number.POSITIVE_INFINITY)).toBe("");
  });

  it("writes a boolean in Persian", () => {
    expect(csvCell(true)).toBe("بله");
    expect(csvCell(false)).toBe("خیر");
  });
});

describe("quoting", () => {
  it("quotes a cell containing the delimiter", () => {
    expect(csvCell("رضایی, علی")).toBe('"رضایی, علی"');
  });

  it("doubles an inner quote", () => {
    expect(csvCell('او گفت "بله"')).toBe('"او گفت ""بله"""');
  });

  it("quotes a cell containing a newline", () => {
    expect(csvCell("خط اول\nخط دوم")).toBe('"خط اول\nخط دوم"');
    expect(csvCell("خط اول\r\nخط دوم")).toBe('"خط اول\r\nخط دوم"');
  });

  it("does not quote what does not need it", () => {
    // Valid either way, but an unquoted file is readable in a text editor.
    expect(csvCell("فوتبال U14")).toBe("فوتبال U14");
  });
});

describe("formula injection", () => {
  /**
   * A player's name is typed into a form by a person and ends up in a file
   * opened on a manager's laptop. Excel runs a cell that begins `=`.
   */
  it("neutralises every character a spreadsheet treats as a formula", () => {
    for (const starter of ["=", "+", "-", "@"]) {
      const cell = csvCell(`${starter}1+1`);
      expect(cell.startsWith("'"), starter).toBe(true);
    }
  });

  it("catches one hidden behind whitespace or a control character", () => {
    // A spreadsheet skips these and reads what follows, so a naive
    // `startsWith("=")` misses it.
    // A tab needs no quoting — only a comma, a quote or a newline do — so the
    // guard alone is what makes this inert.
    expect(csvCell("\t=SUM(A1:A9)")).toBe("'\t=SUM(A1:A9)");
    expect(csvCell(" =1+1")).toBe("' =1+1");
    expect(csvCell("\r\n=1+1")).toBe(`"'\r\n=1+1"`);
  });

  it("catches one behind a bidirectional mark", () => {
    // RTL text routinely carries these, so they are not exotic here.
    expect(csvCell("‏=1+1").startsWith("'")).toBe(true);
  });

  it("guards inside the quotes, so the guard survives the parse", () => {
    const cell = csvCell("=HYPERLINK(),x");
    expect(cell.startsWith(`"'`)).toBe(true);
    expect(cell.endsWith('"')).toBe(true);
  });

  it("leaves a negative number alone", () => {
    // It is a number, not a string, so it never reaches the text guard — and
    // a quoted `-3` would be text in the spreadsheet, which is the bug.
    expect(csvCell(-3)).toBe("-3");
  });

  /** But a *string* that looks like one is still text a person typed. */
  it("guards a minus sign typed into a text field", () => {
    expect(csvCell("-۳ روز")).toBe("'-۳ روز");
  });
});

describe("a document", () => {
  interface Row {
    name: string;
    rate: number | null;
  }

  const columns = [
    { header: "نام", value: (row: Row) => row.name },
    { header: "نرخ", value: (row: Row) => row.rate },
  ];

  it("starts with the byte-order mark Excel needs", () => {
    const csv = toCsv(columns, []);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
  });

  it("writes the header row even with no data", () => {
    expect(toCsv(columns, [])).toBe(`${UTF8_BOM}نام,نرخ\r\n`);
  });

  it("writes one line per row, CRLF-terminated", () => {
    const csv = toCsv(columns, [
      { name: "علی", rate: 85 },
      { name: "محمد", rate: null },
    ]);

    const lines = csv.slice(UTF8_BOM.length).split("\r\n");
    expect(lines[0]).toBe("نام,نرخ");
    expect(lines[1]).toBe("علی,85");
    // The null becomes a blank, not a zero: a player with no rate has no rate,
    // and a zero would be averaged.
    expect(lines[2]).toBe("محمد,");
    expect(lines[3]).toBe("");
  });

  it("keeps the column order it was given", () => {
    const reversed = [...columns].reverse();
    const csv = toCsv(reversed, [{ name: "علی", rate: 85 }]);
    expect(csv.slice(UTF8_BOM.length).split("\r\n")[1]).toBe("85,علی");
  });
});

describe("the filename", () => {
  it("is ASCII, dated, and recognisable", () => {
    const name = csvFilename("attendance", new Date(Date.UTC(2026, 8, 20)));
    expect(name).toBe("sepahan-attendance-2026-09-20.csv");
    // Header values are not reliably UTF-8; the Persian title is inside the
    // file instead.
    expect(/^[\x20-\x7e]+$/.test(name)).toBe(true);
  });

  it("strips anything that could confuse a header or a filesystem", () => {
    const name = csvFilename(
      'att"end;ance/../x',
      new Date(Date.UTC(2026, 0, 1)),
    );
    expect(name).not.toContain('"');
    expect(name).not.toContain("/");
    expect(name).not.toContain("..");
  });
});
