function escapePdfText(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function truncateText(value = "", maxLength = 48) {
  const text = String(value || "");
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatCurrency(value) {
  return `Rs. ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)}`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildTextCommand({
  x,
  y,
  text,
  font = "F1",
  size = 10,
  color = "0 0 0",
}) {
  return `${color} rg\nBT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(
    text
  )}) Tj ET`;
}

function buildRectCommand({ x, y, width, height, fill = null, stroke = null, lineWidth = 1 }) {
  const commands = [];

  if (fill) {
    commands.push(`${fill} rg`);
  }

  if (stroke) {
    commands.push(`${stroke} RG`);
  }

  commands.push(`${lineWidth} w`);
  commands.push(`${x} ${y} ${width} ${height} re`);

  if (fill && stroke) {
    commands.push("B");
  } else if (fill) {
    commands.push("f");
  } else {
    commands.push("S");
  }

  return commands.join("\n");
}

function buildLineCommand({ x1, y1, x2, y2, stroke = "0.85 0.85 0.85", lineWidth = 1 }) {
  return `${stroke} RG\n${lineWidth} w\n${x1} ${y1} m\n${x2} ${y2} l\nS`;
}

function buildHeader(commands, customer) {
  commands.push(
    buildRectCommand({
      x: 36,
      y: 752,
      width: 523,
      height: 54,
      fill: "0.09 0.44 0.39",
    })
  );
  commands.push(
    buildTextCommand({
      x: 52,
      y: 785,
      text: "Account Summary",
      font: "F2",
      size: 20,
      color: "1 1 1",
    })
  );
  commands.push(
    buildTextCommand({
      x: 52,
      y: 766,
      text: `${customer.name}`,
      font: "F1",
      size: 10,
      color: "1 1 1",
    })
  );
}

function buildCustomerCard(commands, customer, reportLabel) {
  commands.push(
    buildRectCommand({
      x: 36,
      y: 665,
      width: 523,
      height: 56,
      fill: "0.97 0.98 0.98",
      stroke: "0.85 0.88 0.88",
    })
  );

  const leftColumn = [
    ["Customer", customer.name],
    ["Phone", customer.phone],
  ];

  const fixedProducts = Array.isArray(customer.fixedProducts) ? customer.fixedProducts : [];
  const productLabel = fixedProducts.length
    ? fixedProducts.map((product) => product.productName).slice(0, 2).join(", ")
    : customer.fixedProductName || "Milk";

  const rightColumn = [
    ["Product", productLabel],
    ["Period", reportLabel || "All entries"],
  ];

  leftColumn.forEach(([label, value], index) => {
    const y = 710 - index * 19;
    commands.push(buildTextCommand({ x: 52, y, text: `${label}: ${truncateText(value, 30)}`, font: "F1", size: 10 }));
  });

  rightColumn.forEach(([label, value], index) => {
    const y = 710 - index * 19;
    commands.push(buildTextCommand({ x: 302, y, text: `${label}: ${truncateText(value, 36)}`, font: "F1", size: 10 }));
  });
}

function buildSummaryCards(commands, totalDebit, totalCredit, balance) {
  const cards = [
    { x: 36, label: "Items Taken", value: formatCurrency(totalDebit) },
    { x: 214, label: "Amount Paid", value: formatCurrency(totalCredit) },
    { x: 392, label: "Amount Pending", value: formatCurrency(balance) },
  ];

  cards.forEach((card) => {
    commands.push(
      buildRectCommand({
        x: card.x,
        y: 607,
        width: 167,
        height: 42,
        fill: "0.99 0.99 0.99",
        stroke: "0.87 0.87 0.87",
      })
    );
    commands.push(buildTextCommand({ x: card.x + 14, y: 631, text: card.label, font: "F1", size: 9 }));
    commands.push(buildTextCommand({ x: card.x + 14, y: 614, text: card.value, font: "F2", size: 12 }));
  });
}

function buildTableHeader(commands, y) {
  commands.push(
    buildRectCommand({
      x: 36,
      y: y - 20,
      width: 523,
      height: 24,
      fill: "0.93 0.95 0.95",
      stroke: "0.82 0.85 0.85",
    })
  );

  [
    { x: 46, text: "Date" },
    { x: 150, text: "Details" },
    { x: 430, text: "Type" },
    { x: 485, text: "Amount" },
  ].forEach((cell) => {
    commands.push(buildTextCommand({ x: cell.x, y: y - 6, text: cell.text, font: "F2", size: 9 }));
  });
}

function buildEntryRow(commands, entry, y) {
  commands.push(buildLineCommand({ x1: 36, y1: y - 22, x2: 559, y2: y - 22, stroke: "0.9 0.9 0.9", lineWidth: 0.8 }));

  const cells = [
    { x: 46, text: truncateText(formatDateTime(entry.date), 18) },
    {
      x: 150,
      text: truncateText(entry.description || entry.productName || "Entry", 54),
    },
    { x: 430, text: entry.type === "debit" ? "Taken" : "Paid" },
    { x: 485, text: truncateText(formatCurrency(entry.amount), 14) },
  ];

  cells.forEach((cell) => {
    commands.push(buildTextCommand({ x: cell.x, y: y - 12, text: cell.text, font: "F1", size: 9 }));
  });
}

function buildFooter(commands, pageNumber) {
  commands.push(buildLineCommand({ x1: 36, y1: 32, x2: 559, y2: 32, stroke: "0.85 0.85 0.85", lineWidth: 0.8 }));
  commands.push(buildTextCommand({ x: 36, y: 18, text: "Thank you", font: "F1", size: 8 }));
  commands.push(buildTextCommand({ x: 515, y: 18, text: `Page ${pageNumber}`, font: "F1", size: 8 }));
}

function buildPageContent({
  customer,
  totalDebit,
  totalCredit,
  balance,
  entries,
  pageNumber,
  firstPage,
  reportLabel,
}) {
  const commands = [];

  if (firstPage) {
    buildHeader(commands, customer);
    buildCustomerCard(commands, customer, reportLabel);
    buildSummaryCards(commands, totalDebit, totalCredit, balance);
    buildTableHeader(commands, 568);
  } else {
    commands.push(buildTextCommand({ x: 36, y: 800, text: `Account Summary - ${customer.name}`, font: "F2", size: 15 }));
    commands.push(buildTextCommand({ x: 36, y: 784, text: `Phone: ${customer.phone}`, font: "F1", size: 9 }));
    buildTableHeader(commands, 756);
  }

  let currentY = firstPage ? 542 : 730;

  entries.forEach((entry) => {
    buildEntryRow(commands, entry, currentY);
    currentY -= 24;
  });

  buildFooter(commands, pageNumber);

  return commands.join("\n");
}

function generateLedgerPdf({
  customer,
  entries,
  totalDebit,
  totalCredit,
  balance,
  reportLabel,
}) {
  const firstPageCapacity = 20;
  const otherPageCapacity = 27;
  const pages = [];

  pages.push(entries.slice(0, firstPageCapacity));

  for (let index = firstPageCapacity; index < entries.length; index += otherPageCapacity) {
    pages.push(entries.slice(index, index + otherPageCapacity));
  }

  if (pages.length === 0) {
    pages.push([]);
  }

  const objects = [];

  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const catalogObjectId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesObjectId = addObject("<< /Type /Pages /Kids [] /Count 0 >>");
  const regularFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageObjectIds = [];

  pages.forEach((pageEntries, index) => {
    const stream = buildPageContent({
      customer,
      totalDebit,
      totalCredit,
      balance,
      entries: pageEntries,
      pageNumber: index + 1,
      firstPage: index === 0,
      reportLabel,
    });

    const contentObjectId = addObject(
      `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`
    );

    const pageObjectId = addObject(
      `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );

    pageObjectIds.push(pageObjectId);
  });

  objects[pagesObjectId - 1] = `<< /Type /Pages /Kids [${pageObjectIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageObjectIds.length} >>`;
  objects[catalogObjectId - 1] = `<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefPosition = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\n`;
  pdf += `startxref\n${xrefPosition}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

module.exports = { generateLedgerPdf };
