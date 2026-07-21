function getMonthSummary(monthValue) {
  const monthItems = transactions.filter((item) => isInMonth(item, monthValue));
  const income = monthItems.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = monthItems.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const categoriesTotal = monthItems
    .filter((item) => item.type === "expense")
    .reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount;
      return acc;
    }, {});

  return {
    monthItems: [...monthItems].sort((a, b) => b.date.localeCompare(a.date)),
    income,
    expense,
    balance: income - expense,
    categories: Object.entries(categoriesTotal).sort((a, b) => b[1] - a[1]),
  };
}

function getReportDayCount(monthValue) {
  return getAverageDayCount(monthValue);
}

function getReportInsights(summary, monthValue) {
  const dayCount = Math.max(getReportDayCount(monthValue), 1);
  const topCategory = summary.categories[0] || ["Sem despesas", 0];
  return {
    dayCount,
    dailyIncome: summary.income / dayCount,
    dailyExpense: summary.expense / dayCount,
    dailyBalance: summary.balance / dayCount,
    savingsRate: summary.income > 0 ? summary.balance / summary.income : 0,
    expenseRate: summary.income > 0 ? summary.expense / summary.income : 0,
    topCategoryName: topCategory[0],
    topCategoryValue: topCategory[1],
    topCategoryPercent: summary.expense > 0 ? topCategory[1] / summary.expense : 0,
    transactionCount: summary.monthItems.length,
  };
}

function getDailyReportData(summary) {
  const daily = summary.monthItems.reduce((acc, item) => {
    acc[item.date] ||= { income: 0, expense: 0 };
    acc[item.date][item.type] += item.amount;
    return acc;
  }, {});

  return Object.entries(daily)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, totals]) => ({ date, ...totals }));
}

function createBarChartDataUrl({ title, labels, datasets, width = 1000, height = 420 }) {
  const canvas = document.createElement("canvas");
  const ratio = 2;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);

  const colors = { text: "#243129", muted: "#68756d", line: "#dfe7e2", surface: "#ffffff" };
  const margin = { top: 60, right: 28, bottom: 76, left: 82 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(1, ...datasets.flatMap((dataset) => dataset.values));

  context.fillStyle = colors.surface;
  context.fillRect(0, 0, width, height);
  context.fillStyle = colors.text;
  context.font = "bold 22px Arial";
  context.fillText(title, margin.left, 32);

  context.font = "12px Arial";
  context.textAlign = "right";
  context.textBaseline = "middle";
  for (let step = 0; step <= 4; step += 1) {
    const value = (maxValue / 4) * step;
    const y = margin.top + chartHeight - (chartHeight * step) / 4;
    context.strokeStyle = colors.line;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(margin.left, y);
    context.lineTo(width - margin.right, y);
    context.stroke();
    context.fillStyle = colors.muted;
    context.fillText(money(value).replace(/\s/g, " "), margin.left - 10, y);
  }

  const groupWidth = chartWidth / Math.max(labels.length, 1);
  const barGap = 5;
  const barWidth = Math.max(8, Math.min(44, (groupWidth - 18) / Math.max(datasets.length, 1) - barGap));
  labels.forEach((label, labelIndex) => {
    const totalBarsWidth = datasets.length * (barWidth + barGap) - barGap;
    const groupStart = margin.left + labelIndex * groupWidth + (groupWidth - totalBarsWidth) / 2;

    datasets.forEach((dataset, datasetIndex) => {
      const value = dataset.values[labelIndex] || 0;
      const barHeight = (value / maxValue) * chartHeight;
      const x = groupStart + datasetIndex * (barWidth + barGap);
      const y = margin.top + chartHeight - barHeight;
      context.fillStyle = dataset.color;
      context.fillRect(x, y, barWidth, barHeight);
    });

    context.save();
    context.translate(margin.left + labelIndex * groupWidth + groupWidth / 2, margin.top + chartHeight + 12);
    context.rotate(labels.length > 8 ? -Math.PI / 4 : 0);
    context.fillStyle = colors.muted;
    context.font = "12px Arial";
    context.textAlign = labels.length > 8 ? "right" : "center";
    context.textBaseline = "top";
    context.fillText(String(label).slice(0, 18), 0, 0);
    context.restore();
  });

  let legendX = margin.left;
  datasets.forEach((dataset) => {
    context.fillStyle = dataset.color;
    context.fillRect(legendX, height - 24, 12, 12);
    context.fillStyle = colors.text;
    context.font = "12px Arial";
    context.textAlign = "left";
    context.fillText(dataset.label, legendX + 18, height - 18);
    legendX += context.measureText(dataset.label).width + 52;
  });

  return canvas.toDataURL("image/png");
}

function createReportCharts(summary) {
  const daily = getDailyReportData(summary);
  const dailyChart = createBarChartDataUrl({
    title: "Ganhos e despesas por dia",
    labels: daily.length ? daily.map((item) => item.date.slice(8, 10)) : ["Sem dados"],
    datasets: [
      { label: "Ganhos", color: "#17a65b", values: daily.length ? daily.map((item) => item.income) : [0] },
      { label: "Despesas", color: "#d9564a", values: daily.length ? daily.map((item) => item.expense) : [0] },
    ],
  });
  const categoryChart = createBarChartDataUrl({
    title: "Despesas por categoria",
    labels: summary.categories.length ? summary.categories.map(([category]) => category) : ["Sem despesas"],
    datasets: [
      { label: "Despesas", color: "#0b713f", values: summary.categories.length ? summary.categories.map(([, value]) => value) : [0] },
    ],
  });

  return { dailyChart, categoryChart };
}

function generateMonthlyPdf(monthValue) {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) {
    showNotice("Nao foi possivel carregar o gerador de PDF. Tente novamente com internet ativa.", "PDF indisponivel", "error");
    return;
  }

  const summary = getMonthSummary(monthValue);
  const charts = createReportCharts(summary);
  const insights = getReportInsights(summary, monthValue);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  if (typeof doc.autoTable !== "function") {
    showNotice("Nao foi possivel carregar as tabelas do PDF. Tente novamente com internet ativa.", "PDF indisponivel", "error");
    return;
  }
  const pageWidth = doc.internal.pageSize.getWidth();
  const darkGreen = [8, 67, 40];
  const mediumGreen = [35, 125, 86];
  const muted = [91, 108, 98];
  const cardWidth = 62;
  const cardGap = 6;
  const totalPagesToken = "{total_pages_count_string}";

  doc.setProperties({
    title: `Relatorio financeiro - ${monthName(monthValue)}`,
    subject: "Resumo mensal de ganhos, despesas, saldo e categorias",
    author: "Planejamento Financeiro",
    creator: "Planejamento Financeiro",
  });

  doc.setFillColor(...darkGreen);
  doc.rect(0, 0, pageWidth, 27, "F");
  doc.setFillColor(...mediumGreen);
  doc.rect(0, 27, pageWidth, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("PLANEJAMENTO FINANCEIRO", 14, 11);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Relatorio mensal | ${monthName(monthValue)}`, 14, 19);
  doc.setFontSize(8.5);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} as ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, pageWidth - 14, 11, { align: "right" });
  doc.text(`${insights.transactionCount} movimentacoes analisadas`, pageWidth - 14, 18, { align: "right" });

  const cards = [
    ["Ganhos", summary.income, [229, 247, 237]],
    ["Despesas", summary.expense, [255, 239, 237]],
    ["Saldo", summary.balance, [233, 241, 251]],
    ["Saldo medio diario", insights.dailyBalance, [244, 239, 252]],
  ];
  cards.forEach(([label, value, color], index) => {
    const x = 14 + index * (cardWidth + cardGap);
    doc.setFillColor(...color);
    doc.roundedRect(x, 35, cardWidth, 22, 2.5, 2.5, "F");
    doc.setDrawColor(218, 226, 221);
    doc.roundedRect(x, 35, cardWidth, 22, 2.5, 2.5, "S");
    doc.setTextColor(75, 88, 80);
    doc.setFontSize(9);
    doc.text(label, x + 4, 42);
    doc.setTextColor(20, 45, 31);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(money(value), x + 4, 52);
    doc.setFont("helvetica", "normal");
  });

  doc.setFillColor(247, 249, 248);
  doc.roundedRect(14, 63, pageWidth - 28, 13, 2, 2, "F");
  doc.setTextColor(...muted);
  doc.setFontSize(8.5);
  doc.text(`Taxa de economia: ${(insights.savingsRate * 100).toFixed(1)}%`, 19, 71);
  doc.text(`Comprometimento da renda: ${(insights.expenseRate * 100).toFixed(1)}%`, 82, 71);
  doc.text(`Maior categoria: ${insights.topCategoryName} (${money(insights.topCategoryValue)} | ${(insights.topCategoryPercent * 100).toFixed(0)}%)`, 167, 71);

  doc.addImage(charts.dailyChart, "PNG", 14, 81, 130, 51);
  doc.addImage(charts.categoryChart, "PNG", 153, 81, 130, 51);

  doc.setTextColor(20, 45, 31);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Movimentacoes do mes", 14, 140);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...muted);
  doc.text("Historico completo utilizado nos indicadores e graficos acima.", 14, 145);

  const rows = summary.monthItems.map((item) => [
    item.date.split("-").reverse().join("/"),
    item.type === "income" ? "Ganho" : "Despesa",
    item.description,
    item.category,
    frequencyLabels[item.frequency],
    `${item.type === "income" ? "+" : "-"} ${money(item.amount)}`,
    item.note || "",
  ]);

  doc.autoTable({
    startY: 149,
    head: [["Data", "Tipo", "Descricao", "Categoria", "Frequencia", "Valor", "Observacao"]],
    body: rows.length ? rows : [["-", "-", "Nenhum registro encontrado", "-", "-", "-", "-"]],
    theme: "striped",
    styles: { font: "helvetica", fontSize: 7.7, cellPadding: 2.1, textColor: [32, 48, 39], lineColor: [224, 230, 226], lineWidth: 0.1 },
    headStyles: { fillColor: darkGreen, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 247, 245] },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 20 }, 4: { cellWidth: 25 }, 5: { halign: "right", cellWidth: 28 } },
    margin: { left: 14, right: 14, top: 18, bottom: 13 },
    didParseCell: (data) => {
      if (data.section !== "body" || !data.row.raw) return;
      if (data.column.index === 1 || data.column.index === 5) {
        data.cell.styles.textColor = data.row.raw[1] === "Ganho" ? [24, 121, 78] : [180, 35, 24];
        data.cell.styles.fontStyle = "bold";
      }
    },
    didDrawPage: ({ pageNumber }) => {
      const pageHeight = doc.internal.pageSize.getHeight();
      if (pageNumber > 1) {
        doc.setFillColor(...darkGreen);
        doc.rect(0, 0, pageWidth, 11, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text(`PLANEJAMENTO FINANCEIRO | ${monthName(monthValue)}`, 14, 7);
      }
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...muted);
      doc.text("Relatorio gerado pelo Planejamento Financeiro", 14, pageHeight - 6);
      doc.text(`Pagina ${pageNumber} de ${totalPagesToken}`, pageWidth - 14, pageHeight - 6, { align: "right" });
    },
  });

  if (typeof doc.putTotalPages === "function") doc.putTotalPages(totalPagesToken);

  doc.save(`relatorio-financeiro-${monthValue}.pdf`);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function generateMonthlyExcel(monthValue) {
  if (!window.ExcelJS) {
    showNotice("Nao foi possivel carregar o gerador de Excel. Tente novamente com internet ativa.", "Excel indisponivel", "error");
    return;
  }

  const summary = getMonthSummary(monthValue);
  const charts = createReportCharts(summary);
  const insights = getReportInsights(summary, monthValue);
  const workbook = new window.ExcelJS.Workbook();
  workbook.creator = "Planejamento Financeiro";
  workbook.lastModifiedBy = "Planejamento Financeiro";
  workbook.title = `Relatorio financeiro - ${monthName(monthValue)}`;
  workbook.subject = "Resumo mensal de ganhos, despesas, saldo e categorias";
  workbook.description = "Relatorio financeiro editavel com painel executivo e movimentacoes detalhadas.";
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const dashboard = workbook.addWorksheet("Resumo", { views: [{ showGridLines: false, zoomScale: 85 }] });
  const movements = workbook.addWorksheet("Movimentacoes", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  const categoriesSheet = workbook.addWorksheet("Categorias", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  const darkGreen = "054727";
  const mediumGreen = "237D56";
  const lightGreen = "E5F4EC";
  const lightRed = "FFF0EE";
  const lightBlue = "E9F1FB";
  const lightPurple = "F3EDFF";
  const lightAmber = "FFF5D9";
  const borderColor = "D9E2DC";
  const currencyFormat = 'R$ #,##0.00;[Red]-R$ #,##0.00';

  movements.columns = [
    { header: "Data", key: "date", width: 13 },
    { header: "Tipo", key: "type", width: 13 },
    { header: "Descricao", key: "description", width: 30 },
    { header: "Categoria", key: "category", width: 20 },
    { header: "Frequencia", key: "frequency", width: 17 },
    { header: "Valor", key: "amount", width: 16 },
    { header: "Observacao", key: "note", width: 32 },
    { header: "Impacto no saldo", key: "impact", width: 19 },
  ];
  summary.monthItems
    .slice()
    .reverse()
    .forEach((item) => {
      const row = movements.addRow({
        date: new Date(`${item.date}T12:00:00`),
        type: item.type === "income" ? "Ganho" : "Despesa",
        description: item.description,
        category: item.category,
        frequency: frequencyLabels[item.frequency],
        amount: item.amount,
        note: item.note || "",
        impact: item.type === "income" ? item.amount : -item.amount,
      });
      row.getCell(8).value = { formula: `=IF(B${row.number}="Ganho",F${row.number},-F${row.number})`, result: item.type === "income" ? item.amount : -item.amount };
    });
  movements.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: darkGreen } };
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.alignment = { vertical: "middle" };
  });
  movements.getColumn("date").numFmt = "dd/mm/yyyy";
  movements.getColumn("amount").numFmt = currencyFormat;
  movements.getColumn("impact").numFmt = currencyFormat;
  movements.autoFilter = { from: "A1", to: "H1" };
  movements.getRow(1).height = 24;
  movements.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const isIncome = row.getCell(2).value === "Ganho";
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowNumber % 2 === 0 ? "F6F8F7" : "FFFFFF" } };
      row.getCell(2).font = { bold: true, color: { argb: isIncome ? mediumGreen : "B42318" } };
      row.getCell(8).font = { bold: true, color: { argb: isIncome ? mediumGreen : "B42318" } };
      row.alignment = { vertical: "middle" };
      row.height = 21;
    }
  });

  movements.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
  movements.headerFooter.oddFooter = "Planejamento Financeiro | &D | Pagina &P de &N";

  const lastMovementRow = Math.max(movements.rowCount, 2);
  dashboard.mergeCells("A1:H2");
  dashboard.getCell("A1").value = "PLANEJAMENTO FINANCEIRO";
  dashboard.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: darkGreen } };
  dashboard.getCell("A1").font = { bold: true, size: 22, color: { argb: "FFFFFF" } };
  dashboard.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  dashboard.mergeCells("A3:H3");
  dashboard.getCell("A3").value = `Relatorio de ${monthName(monthValue)}`;
  dashboard.getCell("A3").font = { bold: true, size: 13, color: { argb: darkGreen } };
  dashboard.getCell("A3").alignment = { horizontal: "center" };

  dashboard.mergeCells("A4:H4");
  dashboard.getCell("A4").value = `Atualizado em ${new Date().toLocaleDateString("pt-BR")} | ${insights.transactionCount} movimentacoes analisadas`;
  dashboard.getCell("A4").font = { size: 9, color: { argb: "68756D" } };
  dashboard.getCell("A4").alignment = { horizontal: "center" };

  const dashboardItems = [
    ["A5", "Ganhos", `=SUMIF('Movimentacoes'!$B$2:$B$${lastMovementRow},"Ganho",'Movimentacoes'!$F$2:$F$${lastMovementRow})`, lightGreen],
    ["C5", "Despesas", `=SUMIF('Movimentacoes'!$B$2:$B$${lastMovementRow},"Despesa",'Movimentacoes'!$F$2:$F$${lastMovementRow})`, lightRed],
    ["E5", "Saldo", "=A6-C6", lightBlue],
    ["G5", "Saldo medio diario", `=E6/${insights.dayCount}`, lightPurple],
  ];
  dashboardItems.forEach(([labelCell, label, formula, fillColor]) => {
    const labelColumn = dashboard.getCell(labelCell).col;
    const valueCell = dashboard.getCell(6, labelColumn);
    dashboard.mergeCells(5, labelColumn, 5, labelColumn + 1);
    dashboard.getCell(labelCell).value = label;
    dashboard.getCell(labelCell).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
    dashboard.getCell(labelCell).font = { bold: true, color: { argb: darkGreen } };
    dashboard.getCell(labelCell).border = { top: { style: "thin", color: { argb: borderColor } }, left: { style: "thin", color: { argb: borderColor } }, right: { style: "thin", color: { argb: borderColor } } };
    dashboard.getCell(labelCell).alignment = { horizontal: "center" };
    dashboard.mergeCells(6, labelColumn, 6, labelColumn + 1);
    valueCell.value = { formula, result: label === "Ganhos" ? summary.income : label === "Despesas" ? summary.expense : label === "Saldo" ? summary.balance : insights.dailyBalance };
    valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
    valueCell.border = { bottom: { style: "thin", color: { argb: borderColor } }, left: { style: "thin", color: { argb: borderColor } }, right: { style: "thin", color: { argb: borderColor } } };
    valueCell.numFmt = currencyFormat;
    valueCell.font = { bold: true, size: 14, color: { argb: darkGreen } };
    valueCell.alignment = { horizontal: "center" };
  });

  const executiveItems = [
    ["A8:B8", "Taxa de economia", "A9:B9", { formula: "=IFERROR(E6/A6,0)", result: insights.savingsRate }, "0.0%", lightGreen],
    ["C8:D8", "Maior categoria", "C9:D9", insights.topCategoryName, "@", lightAmber],
    ["E8:F8", "Valor da maior categoria", "E9:F9", insights.topCategoryValue, currencyFormat, lightRed],
    ["G8:H8", "Quantidade de registros", "G9:H9", insights.transactionCount, "0", lightBlue],
  ];
  executiveItems.forEach(([labelRange, label, valueRange, value, numberFormat, fillColor]) => {
    dashboard.mergeCells(labelRange);
    dashboard.mergeCells(valueRange);
    const labelCell = dashboard.getCell(labelRange.split(":")[0]);
    const valueCell = dashboard.getCell(valueRange.split(":")[0]);
    labelCell.value = label;
    valueCell.value = value;
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
    valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
    labelCell.font = { bold: true, size: 9, color: { argb: "526158" } };
    valueCell.font = { bold: true, size: 12, color: { argb: darkGreen } };
    labelCell.border = { top: { style: "thin", color: { argb: borderColor } }, left: { style: "thin", color: { argb: borderColor } }, right: { style: "thin", color: { argb: borderColor } } };
    valueCell.border = { bottom: { style: "thin", color: { argb: borderColor } }, left: { style: "thin", color: { argb: borderColor } }, right: { style: "thin", color: { argb: borderColor } } };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    valueCell.alignment = { horizontal: "center", vertical: "middle" };
    valueCell.numFmt = numberFormat;
  });

  dashboard.columns = Array.from({ length: 8 }, () => ({ width: 14 }));
  dashboard.getRow(1).height = 26;
  dashboard.getRow(2).height = 26;
  dashboard.getRow(6).height = 28;
  dashboard.getRow(8).height = 22;
  dashboard.getRow(9).height = 27;
  const dailyImageId = workbook.addImage({ base64: charts.dailyChart, extension: "png" });
  const categoryImageId = workbook.addImage({ base64: charts.categoryChart, extension: "png" });
  dashboard.addImage(dailyImageId, { tl: { col: 0, row: 10 }, ext: { width: 500, height: 230 } });
  dashboard.addImage(categoryImageId, { tl: { col: 4, row: 10 }, ext: { width: 500, height: 230 } });
  dashboard.mergeCells("A25:H26");
  dashboard.getCell("A25").value = "Leitura do relatorio: acompanhe a taxa de economia, identifique a categoria de maior peso e consulte as abas Movimentacoes e Categorias para auditar os valores. Os dados tabulares sao editaveis; os graficos registram o momento da exportacao.";
  dashboard.getCell("A25").alignment = { wrapText: true, vertical: "middle" };
  dashboard.getCell("A25").font = { italic: true, color: { argb: "68756D" } };
  dashboard.getCell("A25").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F3F6F4" } };
  dashboard.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };
  dashboard.headerFooter.oddFooter = "Planejamento Financeiro | &D | Pagina &P de &N";

  categoriesSheet.columns = [
    { header: "Posicao", key: "rank", width: 11 },
    { header: "Categoria", key: "category", width: 30 },
    { header: "Total", key: "total", width: 18 },
    { header: "% das despesas", key: "percent", width: 20 },
  ];
  summary.categories.forEach(([category, value], index) => {
    const rowNumber = index + 2;
    categoriesSheet.addRow({ rank: index + 1, category, total: value, percent: summary.expense > 0 ? value / summary.expense : 0 });
    categoriesSheet.getCell(`C${rowNumber}`).value = {
      formula: `=SUMIFS('Movimentacoes'!$F$2:$F$${lastMovementRow},'Movimentacoes'!$B$2:$B$${lastMovementRow},"Despesa",'Movimentacoes'!$D$2:$D$${lastMovementRow},B${rowNumber})`,
      result: value,
    };
    categoriesSheet.getCell(`D${rowNumber}`).value = { formula: `=IFERROR(C${rowNumber}/SUM(C$2:C$${Math.max(summary.categories.length + 1, 2)}),0)`, result: summary.expense > 0 ? value / summary.expense : 0 };
  });
  categoriesSheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: darkGreen } };
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
  });
  categoriesSheet.getColumn("total").numFmt = currencyFormat;
  categoriesSheet.getColumn("percent").numFmt = "0.0%";
  categoriesSheet.autoFilter = { from: "A1", to: "D1" };
  categoriesSheet.getRow(1).height = 24;
  categoriesSheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowNumber % 2 === 0 ? "F6F8F7" : "FFFFFF" } };
    row.getCell(1).font = { bold: true, color: { argb: mediumGreen } };
    row.getCell(3).font = { bold: true, color: { argb: darkGreen } };
    row.alignment = { vertical: "middle" };
    row.height = 21;
  });
  categoriesSheet.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
  categoriesSheet.headerFooter.oddFooter = "Planejamento Financeiro | &D | Pagina &P de &N";

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `planejamento-financeiro-${monthValue}.xlsx`,
  );
}
