const escapePdfText = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const wrapText = (value, max = 80) => {
  const words = String(value ?? "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines = [];
  let line = words.shift();
  for (const word of words) {
    if ((line + " " + word).length > max) {
      lines.push(line);
      line = word;
    } else {
      line += ` ${word}`;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const buildPdfBuffer = ({ title = "Document", lines = [], footer = "" }) => {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const left = 48;
  const top = 780;
  const lineHeight = 16;

  const contentLines = [];
  contentLines.push("BT");
  contentLines.push("/F1 18 Tf");
  contentLines.push(`${left} ${top} Td`);
  contentLines.push(`(${escapePdfText(title)}) Tj`);
  contentLines.push("/F1 11 Tf");
  contentLines.push("0 -26 Td");

  for (const rawLine of lines) {
    const wrapped = wrapText(rawLine, 86);
    for (const line of wrapped) {
      contentLines.push(`(${escapePdfText(line)}) Tj`);
      contentLines.push(`0 -${lineHeight} Td`);
    }
  }

  if (footer) {
    contentLines.push("0 -18 Td");
    contentLines.push("/F1 9 Tf");
    contentLines.push(`(${escapePdfText(footer)}) Tj`);
  }
  contentLines.push("ET");

  const content = contentLines.join("\n");
  const parts = [
    "%PDF-1.4\n",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n`,
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    `5 0 obj << /Length ${Buffer.byteLength(content, "utf8")} >> stream\n${content}\nendstream endobj\n`,
  ];
  const buffers = parts.map((part) => Buffer.from(part, "utf8"));
  const offsets = [];
  let running = 0;
  for (const buffer of buffers) {
    offsets.push(running);
    running += buffer.length;
  }
  const body = Buffer.concat(buffers);

  const xref = [
    "xref",
    "0 6",
    "0000000000 65535 f ",
    ...offsets.slice(1).map((n) => `${String(n).padStart(10, "0")} 00000 n `),
    "trailer << /Size 6 /Root 1 0 R >>",
    "startxref",
    `${body.length}`,
    "%%EOF",
  ].join("\n");

  return Buffer.concat([body, Buffer.from(`${xref}\n`, "utf8")]);
};

module.exports = {
  buildPdfBuffer,
};
