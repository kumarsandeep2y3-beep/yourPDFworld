import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Generate a realistic sample PDF with multiple pages, text, shapes, and layouts
 */
export async function createSamplePdf(
  type: 'report' | 'contract' | 'invoice'
): Promise<File> {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  if (type === 'report') {
    // Page 1: Title & Executive Summary
    const page1 = doc.addPage([595.28, 841.89]); // A4
    const { width, height } = page1.getSize();

    // Header banner
    page1.drawRectangle({
      x: 0,
      y: height - 120,
      width: width,
      height: 120,
      color: rgb(0.09, 0.15, 0.28), // Dark slate
    });

    page1.drawText('DOCUFLOW ENTERPRISE SOLUTIONS', {
      x: 50,
      y: height - 55,
      size: 10,
      font: helveticaBold,
      color: rgb(0.55, 0.7, 0.95),
    });

    page1.drawText('Q4 Strategic Review & Performance Report', {
      x: 50,
      y: height - 85,
      size: 20,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });

    // Content
    page1.drawText('1.0 Executive Summary', {
      x: 50,
      y: height - 160,
      size: 15,
      font: helveticaBold,
      color: rgb(0.12, 0.16, 0.23),
    });

    const summaryText = [
      'This document outlines quarterly business performance, platform latency enhancements,',
      'and document workflow efficiency metrics across enterprise customer deployments.',
      'Document security, client-side encryption, and instant processing rates observed',
      'a 42% operational throughput uplift compared to prior baseline quarters.',
      '',
      'All metrics indicated in section 2.0 represent validated telemetric evaluations,',
      'certifying strict ISO-compliant data privacy without remote cloud transmission.',
    ];

    let yPos = height - 190;
    for (const line of summaryText) {
      page1.drawText(line, {
        x: 50,
        y: yPos,
        size: 10,
        font: helvetica,
        color: rgb(0.25, 0.3, 0.38),
      });
      yPos -= 18;
    }

    // Stat cards
    const stats = [
      { label: 'Documents Processed', value: '1.42M', delta: '+38% YoY' },
      { label: 'Avg Processing Time', value: '180ms', delta: '-64% latency' },
      { label: 'Client Privacy Rate', value: '100%', delta: 'Zero Leaks' },
    ];

    stats.forEach((stat, i) => {
      const cardX = 50 + i * 165;
      const cardY = height - 380;
      page1.drawRectangle({
        x: cardX,
        y: cardY,
        width: 155,
        height: 75,
        borderColor: rgb(0.85, 0.88, 0.92),
        borderWidth: 1,
        color: rgb(0.97, 0.98, 0.99),
      });

      page1.drawText(stat.label, {
        x: cardX + 12,
        y: cardY + 52,
        size: 8,
        font: helvetica,
        color: rgb(0.4, 0.45, 0.52),
      });

      page1.drawText(stat.value, {
        x: cardX + 12,
        y: cardY + 28,
        size: 16,
        font: helveticaBold,
        color: rgb(0.09, 0.15, 0.28),
      });

      page1.drawText(stat.delta, {
        x: cardX + 12,
        y: cardY + 12,
        size: 8,
        font: helveticaBold,
        color: rgb(0.1, 0.6, 0.3),
      });
    });

    // Page 2: Operational Data & Breakdown
    const page2 = doc.addPage([595.28, 841.89]);
    page2.drawText('2.0 Operational Metrics & Department Allocations', {
      x: 50,
      y: height - 70,
      size: 16,
      font: helveticaBold,
      color: rgb(0.12, 0.16, 0.23),
    });

    page2.drawText('Validated multi-region batch normalization analysis:', {
      x: 50,
      y: height - 95,
      size: 10,
      font: helvetica,
      color: rgb(0.4, 0.45, 0.52),
    });

    // Draw simple table
    const tableY = height - 140;
    page2.drawRectangle({
      x: 50,
      y: tableY - 140,
      width: 495,
      height: 160,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: rgb(0.88, 0.9, 0.93),
      borderWidth: 1,
    });

    // Header row
    page2.drawRectangle({
      x: 50,
      y: tableY,
      width: 495,
      height: 20,
      color: rgb(0.92, 0.94, 0.97),
    });

    page2.drawText('DEPARTMENT', { x: 65, y: tableY + 5, size: 9, font: helveticaBold, color: rgb(0.2, 0.25, 0.3) });
    page2.drawText('ALLOCATION', { x: 200, y: tableY + 5, size: 9, font: helveticaBold, color: rgb(0.2, 0.25, 0.3) });
    page2.drawText('COMPLIANCE', { x: 340, y: tableY + 5, size: 9, font: helveticaBold, color: rgb(0.2, 0.25, 0.3) });
    page2.drawText('STATUS', { x: 460, y: tableY + 5, size: 9, font: helveticaBold, color: rgb(0.2, 0.25, 0.3) });

    const rows = [
      ['Engineering & Infrastructure', '45.0%', 'ISO 27001', 'Verified'],
      ['Security Operations', '25.0%', 'SOC 2 Type II', 'Verified'],
      ['Customer Support', '18.0%', 'GDPR Ready', 'Verified'],
      ['Quality Assurance', '12.0%', 'CCPA Compliant', 'Verified'],
    ];

    rows.forEach((r, idx) => {
      const rowY = tableY - 26 - idx * 28;
      page2.drawText(r[0], { x: 65, y: rowY, size: 9, font: helvetica, color: rgb(0.15, 0.2, 0.25) });
      page2.drawText(r[1], { x: 200, y: rowY, size: 9, font: helvetica, color: rgb(0.15, 0.2, 0.25) });
      page2.drawText(r[2], { x: 340, y: rowY, size: 9, font: helvetica, color: rgb(0.15, 0.2, 0.25) });
      page2.drawText(r[3], { x: 460, y: rowY, size: 9, font: helveticaBold, color: rgb(0.1, 0.55, 0.25) });
    });

    // Page 3: Signatures & Certification
    const page3 = doc.addPage([595.28, 841.89]);
    page3.drawText('3.0 Verification & Authorized Sign-off', {
      x: 50,
      y: height - 70,
      size: 16,
      font: helveticaBold,
      color: rgb(0.12, 0.16, 0.23),
    });

    page3.drawText('By signing below, the reviewer confirms all data fields have been inspected.', {
      x: 50,
      y: height - 100,
      size: 10,
      font: helvetica,
      color: rgb(0.3, 0.35, 0.4),
    });

    // Signature boxes
    ['Authorized Lead Engineer', 'Chief Technology Officer'].forEach((title, idx) => {
      const sigX = 50 + idx * 260;
      const sigY = height - 260;
      page3.drawLine({
        start: { x: sigX, y: sigY },
        end: { x: sigX + 220, y: sigY },
        thickness: 1,
        color: rgb(0.5, 0.55, 0.6),
      });
      page3.drawText(title, {
        x: sigX,
        y: sigY - 20,
        size: 10,
        font: helveticaBold,
        color: rgb(0.2, 0.25, 0.3),
      });
      page3.drawText('Date: November 2026', {
        x: sigX,
        y: sigY - 35,
        size: 8,
        font: helveticaOblique,
        color: rgb(0.4, 0.45, 0.5),
      });
    });

    doc.setTitle('Q4 Strategic Review & Performance Report');
    doc.setAuthor('Sarah Jenkins, VP of Operations');
    doc.setSubject('Enterprise document infrastructure and quarterly metrics review');
    doc.setKeywords(['strategic-report', 'q4', 'operations', 'compliance', 'enterprise']);
    doc.setProducer('yourPDFworld Engine v3.0 (Client-Side)');
    doc.setCreator('DocuFlow Enterprise Publishing Suite');
    doc.setCreationDate(new Date('2026-10-15T14:30:00Z'));
    doc.setModificationDate(new Date('2026-11-02T09:15:00Z'));

    const pdfBytes = await doc.save();
    return new File([pdfBytes as any], 'Sample_Q4_Strategic_Report.pdf', { type: 'application/pdf' });
  } else if (type === 'contract') {
    // 4-page Contract
    for (let p = 1; p <= 4; p++) {
      const page = doc.addPage([595.28, 841.89]);
      const { height } = page.getSize();

      page.drawText(`MASTER SERVICE AGREEMENT - SECTION ${p}.0`, {
        x: 50,
        y: height - 60,
        size: 14,
        font: helveticaBold,
        color: rgb(0.15, 0.2, 0.3),
      });

      page.drawText(`Page ${p} of 4 · Confidential Document`, {
        x: 50,
        y: height - 80,
        size: 9,
        font: helveticaOblique,
        color: rgb(0.5, 0.55, 0.6),
      });

      const bodyParagraphs = [
        `Clause ${p}.1 Scope of Professional Engagement:`,
        'The Service Provider shall perform the services set forth in accordance with industry best',
        'practices, maintaining absolute client confidentiality and strict security protocols.',
        '',
        `Clause ${p}.2 Intellectual Property & Data Ownership:`,
        'All client files, documents, and derived materials remain the exclusive property of Client.',
        'No telemetry or document fragments are persisted beyond the operational execution lifecycle.',
        '',
        `Clause ${p}.3 Limitation of Liability & Warranties:`,
        'Neither party shall be liable for indirect, incidental, or consequential damages resulting',
        'from document processing delays or external transmission interruptions.',
      ];

      let py = height - 120;
      for (const line of bodyParagraphs) {
        page.drawText(line, {
          x: 50,
          y: py,
          size: 9.5,
          font: line.startsWith('Clause') ? helveticaBold : helvetica,
          color: rgb(0.2, 0.25, 0.3),
        });
        py -= 20;
      }

      if (p === 4) {
        page.drawText('IN WITNESS WHEREOF, the parties hereto have executed this Agreement.', {
          x: 50,
          y: py - 40,
          size: 9,
          font: helveticaBold,
          color: rgb(0.1, 0.1, 0.1),
        });

        // Signatures
        page.drawLine({
          start: { x: 50, y: py - 100 },
          end: { x: 230, y: py - 100 },
          thickness: 1,
          color: rgb(0.4, 0.4, 0.4),
        });
        page.drawText('Party A Signature & Stamp', { x: 50, y: py - 118, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });

        page.drawLine({
          start: { x: 300, y: py - 100 },
          end: { x: 480, y: py - 100 },
          thickness: 1,
          color: rgb(0.4, 0.4, 0.4),
        });
        page.drawText('Party B Signature & Stamp', { x: 300, y: py - 118, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
      }
    }

    doc.setTitle('Master Service Agreement & Mutual NDA');
    doc.setAuthor('Legal & Corporate Affairs Department');
    doc.setSubject('Confidential Enterprise Cloud & Software Services Contract');
    doc.setKeywords(['contract', 'legal', 'msa', 'nda', 'confidential']);
    doc.setProducer('yourPDFworld Engine v3.0 (Client-Side)');
    doc.setCreator('DocuFlow Legal Contract Generator');
    doc.setCreationDate(new Date('2026-09-01T11:00:00Z'));
    doc.setModificationDate(new Date('2026-10-20T16:45:00Z'));

    const pdfBytes = await doc.save();
    return new File([pdfBytes as any], 'Sample_Master_Service_Agreement.pdf', { type: 'application/pdf' });
  } else {
    // 2-page Invoice
    for (let p = 1; p <= 2; p++) {
      const page = doc.addPage([595.28, 841.89]);
      const { width, height } = page.getSize();

      page.drawText('INVOICE / BILLING STATEMENT', {
        x: 50,
        y: height - 60,
        size: 16,
        font: helveticaBold,
        color: rgb(0.1, 0.15, 0.25),
      });

      page.drawText(`Invoice #: INV-2026-089${p}  |  Date: November 07, 2026`, {
        x: 50,
        y: height - 80,
        size: 9,
        font: helvetica,
        color: rgb(0.4, 0.45, 0.5),
      });

      if (p === 1) {
        page.drawRectangle({
          x: 50,
          y: height - 260,
          width: width - 100,
          height: 140,
          color: rgb(0.97, 0.98, 1.0),
          borderColor: rgb(0.85, 0.88, 0.94),
          borderWidth: 1,
        });

        page.drawText('Item Description', { x: 65, y: height - 145, size: 9, font: helveticaBold, color: rgb(0.2, 0.25, 0.3) });
        page.drawText('Hours / Qty', { x: 300, y: height - 145, size: 9, font: helveticaBold, color: rgb(0.2, 0.25, 0.3) });
        page.drawText('Rate', { x: 390, y: height - 145, size: 9, font: helveticaBold, color: rgb(0.2, 0.25, 0.3) });
        page.drawText('Total Amount', { x: 460, y: height - 145, size: 9, font: helveticaBold, color: rgb(0.2, 0.25, 0.3) });

        const items = [
          ['Cloud Architecture Modernization', '40 hrs', '$150/hr', '$6,000.00'],
          ['PDF Processing Microservice Pipeline', '25 hrs', '$160/hr', '$4,000.00'],
          ['Security Audit & Penetration Review', '15 hrs', '$180/hr', '$2,700.00'],
        ];

        items.forEach((it, idx) => {
          const iy = height - 175 - idx * 25;
          page.drawText(it[0], { x: 65, y: iy, size: 9, font: helvetica, color: rgb(0.15, 0.2, 0.25) });
          page.drawText(it[1], { x: 300, y: iy, size: 9, font: helvetica, color: rgb(0.15, 0.2, 0.25) });
          page.drawText(it[2], { x: 390, y: iy, size: 9, font: helvetica, color: rgb(0.15, 0.2, 0.25) });
          page.drawText(it[3], { x: 460, y: iy, size: 9, font: helveticaBold, color: rgb(0.15, 0.2, 0.25) });
        });

        page.drawText('Total Due: $12,700.00 USD', {
          x: width - 210,
          y: height - 290,
          size: 13,
          font: helveticaBold,
          color: rgb(0.09, 0.15, 0.28),
        });
      } else {
        page.drawText('Payment Wiring Instructions & Tax Details', {
          x: 50,
          y: height - 120,
          size: 12,
          font: helveticaBold,
          color: rgb(0.1, 0.15, 0.25),
        });

        const bankDetails = [
          'Beneficiary Bank: Silicon Federal Reserve Bank',
          'Account Name: DocuFlow Technologies Inc.',
          'Account Number: 9874-3211-0029',
          'Routing Number: 121000358',
          'SWIFT / BIC: SFEDUS6S',
          '',
          'Payment Terms: Net 30 days from invoice issuance date.',
          'Please include Invoice #: INV-2026-0892 on your remittance reference.',
        ];

        let by = height - 150;
        for (const line of bankDetails) {
          page.drawText(line, {
            x: 50,
            y: by,
            size: 9.5,
            font: line.startsWith('Payment Terms') ? helveticaBold : helvetica,
            color: rgb(0.25, 0.3, 0.35),
          });
          by -= 20;
        }
      }
    }

    doc.setTitle('Commercial Tax Invoice #INV-2026-0892');
    doc.setAuthor('DocuFlow Billing & Accounting');
    doc.setSubject('Monthly SaaS License & Enterprise SLA Support');
    doc.setKeywords(['invoice', 'billing', 'tax', 'remittance', 'net-30']);
    doc.setProducer('yourPDFworld Engine v3.0 (Client-Side)');
    doc.setCreator('DocuFlow Financial Ledger Engine');
    doc.setCreationDate(new Date('2026-11-01T08:00:00Z'));
    doc.setModificationDate(new Date('2026-11-01T08:00:00Z'));

    const pdfBytes = await doc.save();
    return new File([pdfBytes as any], 'Sample_Commercial_Invoice.pdf', { type: 'application/pdf' });
  }
}
