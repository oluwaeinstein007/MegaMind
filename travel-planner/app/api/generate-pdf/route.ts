import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';

// Color palette (RGB)
const COLORS = {
  primary: [79, 70, 229] as [number, number, number],      // Indigo-600
  secondary: [99, 102, 241] as [number, number, number],   // Indigo-500
  accent: [139, 92, 246] as [number, number, number],      // Purple-500
  dark: [30, 41, 59] as [number, number, number],          // Slate-800
  muted: [100, 116, 139] as [number, number, number],      // Slate-500
  light: [248, 250, 252] as [number, number, number],      // Slate-50
  white: [255, 255, 255] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],      // Green-500
};

function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let truncated = text;
  while (doc.getTextWidth(truncated + '...') > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (doc.getTextWidth(testLine) <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function POST(request: NextRequest) {
  try {
    const { preferences, recommendations, itinerary, workflowData } = await request.json();

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // ─────────────────────────────────────────────
    // Helper: ensure space or add page
    // ─────────────────────────────────────────────
    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - 20) {
        doc.addPage();
        y = margin;
      }
    };

    // ─────────────────────────────────────────────
    // COVER / HEADER
    // ─────────────────────────────────────────────
    // Gradient-like header band
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pageWidth, 55, 'F');

    doc.setTextColor(...COLORS.white);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('TravelMind', margin, 22);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('AI-Powered Travel Itinerary', margin, 30);

    // Destination title
    const destination = itinerary?.destination || preferences?.destination || 'Your Destination';
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(destination, margin, 45);

    y = 65;

    // ─────────────────────────────────────────────
    // TRIP SUMMARY BOX
    // ─────────────────────────────────────────────
    doc.setFillColor(...COLORS.light);
    doc.roundedRect(margin, y, contentWidth, 36, 3, 3, 'F');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Trip Summary', margin + 5, y + 8);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.dark);

    const leftCol = margin + 5;
    const rightCol = margin + contentWidth / 2 + 5;
    let infoY = y + 16;

    doc.text(`📍 Destination: ${destination}`, leftCol, infoY);
    doc.text(`💰 Budget: ${preferences?.budget || 'N/A'}`, rightCol, infoY);
    infoY += 7;
    doc.text(`📅 Dates: ${preferences?.startDate || '?'} → ${preferences?.endDate || '?'}`, leftCol, infoY);
    doc.text(`👥 Travelers: ${preferences?.travelers || 'N/A'}`, rightCol, infoY);
    infoY += 7;
    const interests = preferences?.interests || '';
    const truncatedInterests = truncateText(doc, interests, contentWidth / 2 - 10);
    doc.text(`❤️ Interests: ${truncatedInterests}`, leftCol, infoY);

    y += 44;

    // ─────────────────────────────────────────────
    // ITINERARY SCHEDULE (real data)
    // ─────────────────────────────────────────────
    const schedule = itinerary?.schedule || workflowData?.itinerary?.schedule || [];

    if (schedule.length > 0) {
      ensureSpace(20);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.primary);
      doc.text('Daily Itinerary', margin, y);
      y += 8;

      for (const day of schedule) {
        ensureSpace(30);

        // Day header
        doc.setFillColor(...COLORS.secondary);
        doc.roundedRect(margin, y, contentWidth, 9, 2, 2, 'F');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.white);
        const dayTitle = `Day ${day.day}: ${day.title || day.theme || 'Exploration'}`;
        doc.text(dayTitle, margin + 4, y + 6.5);
        y += 12;

        const activities = day.activities || [];
        for (const act of activities) {
          ensureSpace(14);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COLORS.dark);
          const time = act.time || '';
          const name = act.name || act.activity || act.title || 'Activity';
          doc.text(`${time}`, margin + 3, y);
          doc.setFont('helvetica', 'normal');
          doc.text(name, margin + 18, y);
          y += 5;

          // Description (wrapped)
          const desc = act.description || act.notes || '';
          if (desc) {
            doc.setFontSize(8);
            doc.setTextColor(...COLORS.muted);
            const lines = wrapText(doc, desc, contentWidth - 20);
            for (const line of lines.slice(0, 2)) { // max 2 lines
              ensureSpace(5);
              doc.text(line, margin + 18, y);
              y += 4;
            }
          }

          // Cost if available
          const cost = act.estimated_cost || act.cost || '';
          if (cost) {
            doc.setFontSize(8);
            doc.setTextColor(...COLORS.success);
            doc.text(`Est. cost: ${cost}`, margin + 18, y);
            y += 4;
          }

          y += 2;
        }

        y += 4;
      }
    }

    // ─────────────────────────────────────────────
    // RECOMMENDATIONS SECTION
    // ─────────────────────────────────────────────
    if (recommendations && recommendations.length > 0) {
      ensureSpace(25);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.primary);
      doc.text('AI Recommendations', margin, y);
      y += 8;

      for (const rec of recommendations.slice(0, 5)) {
        ensureSpace(18);
        doc.setFillColor(...COLORS.light);
        doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'F');

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.dark);
        doc.text(rec.city || rec.name || 'Destination', margin + 4, y + 6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.muted);
        const info = [
          rec.rating ? `★ ${rec.rating}` : '',
          rec.budget || '',
          rec.bestFor || ''
        ].filter(Boolean).join('  •  ');
        doc.text(info, margin + 4, y + 11);

        y += 17;
      }
    }

    // ─────────────────────────────────────────────
    // BOOKING INFO SECTION
    // ─────────────────────────────────────────────
    const bookingInfo = itinerary?.bookingInfo || workflowData?.itinerary?.bookingInfo;
    if (bookingInfo) {
      ensureSpace(20);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.primary);
      doc.text('Booking Links', margin, y);
      y += 8;

      const sections = [
        { key: 'hotels', label: '🏨 Hotels', data: bookingInfo.hotels },
        { key: 'restaurants', label: '🍽️ Restaurants', data: bookingInfo.restaurants },
        { key: 'activities', label: '🎯 Activities', data: bookingInfo.activities },
      ];

      for (const sec of sections) {
        const items = sec.data || [];
        if (items.length === 0) continue;

        ensureSpace(12);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.dark);
        doc.text(sec.label, margin, y);
        y += 5;

        for (const item of items.slice(0, 3)) {
          ensureSpace(8);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.muted);
          const name = item.name || item.title || 'Booking';
          const link = item.link || item.bookingLink || '';
          const displayLink = link ? ` → ${truncateText(doc, link, contentWidth - 60)}` : '';
          doc.text(`• ${name}${displayLink}`, margin + 4, y);
          y += 5;
        }
        y += 3;
      }
    }

    // ─────────────────────────────────────────────
    // AGENT RESEARCH REPORTS SECTION
    // ─────────────────────────────────────────────
    const richContent = workflowData?.rich_content || workflowData?.workflow_data?.rich_content || workflowData?.workflowData?.rich_content;
    
    if (richContent) {
      ensureSpace(30);
      doc.addPage();
      y = margin;
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.primary);
      doc.text('Veridex Agent Fabric Research Reports', margin, y);
      y += 8;
      
      const reports = [
        { title: '1. Destination Selector Report', content: richContent.city_selection || richContent.city_analysis },
        { title: '2. Insider Guide Report', content: richContent.local_exploration || richContent.local_insights },
        { title: '3. Itinerary Planner Report', content: richContent.itinerary_design || richContent.itinerary },
        { title: '4. Bookings Curator Report', content: richContent.booking_curation || richContent.bookings }
      ];
      
      for (const report of reports) {
        if (!report.content) continue;
        
        ensureSpace(25);
        y += 4;
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.accent);
        doc.text(report.title, margin, y);
        y += 6;
        
        // Custom parser to map basic Markdown to jsPDF beautifully
        const mdLines = report.content.split('\n');
        for (let i = 0; i < mdLines.length; i++) {
          const rawLine = mdLines[i];
          let line = rawLine.trim();
          if (!line) {
            y += 3;
            continue;
          }
          
          // Headings
          if (line.startsWith('#')) {
            const depth = (line.match(/^#+/) || ['#'])[0].length;
            const headingText = line.replace(/^#+\s+/, '').replace(/\*\*+/g, '');
            const fontSize = depth === 1 ? 12 : depth === 2 ? 10.5 : 9.5;
            
            ensureSpace(fontSize + 5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(fontSize);
            doc.setTextColor(...COLORS.primary);
            doc.text(headingText, margin, y + fontSize - 4);
            y += fontSize + 3;
            
            // reset style
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...COLORS.dark);
          }
          // Bullets
          else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
            const itemText = line.replace(/^[-*•]\s+/, '').replace(/\*\*+/g, '');
            const wrapped = wrapText(doc, `• ${itemText}`, contentWidth - 4);
            for (const wl of wrapped) {
              ensureSpace(5);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8.5);
              doc.setTextColor(...COLORS.dark);
              doc.text(wl, margin + 4, y);
              y += 4.5;
            }
          }
          // Key Value bold lines (e.g. **Vibe**: Luxury)
          else if (line.startsWith('**') && line.includes('**:')) {
            const match = line.match(/^\*\*([^*]+)\*\*:(.*)/);
            if (match) {
              const key = match[1].trim();
              const value = match[2].trim();
              
              ensureSpace(5);
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(8.5);
              doc.setTextColor(...COLORS.primary);
              doc.text(`${key}: `, margin, y);
              
              const keyWidth = doc.getTextWidth(`${key}: `);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(...COLORS.dark);
              
              const remainingWidth = contentWidth - keyWidth;
              const wrappedValue = wrapText(doc, value, remainingWidth);
              
              if (wrappedValue.length > 0) {
                doc.text(wrappedValue[0], margin + keyWidth, y);
                y += 4.5;
                for (let j = 1; j < wrappedValue.length; j++) {
                  ensureSpace(5);
                  doc.text(wrappedValue[j], margin + keyWidth, y);
                  y += 4.5;
                }
              } else {
                y += 4.5;
              }
            } else {
              const cleanLine = line.replace(/\*\*+/g, '');
              const wrapped = wrapText(doc, cleanLine, contentWidth);
              for (const wl of wrapped) {
                ensureSpace(5);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8.5);
                doc.setTextColor(...COLORS.dark);
                doc.text(wl, margin, y);
                y += 4.5;
              }
            }
          }
          // Blockquotes / Alerts
          else if (line.startsWith('>')) {
            let alertText = line.replace(/^>\s*/, '');
            let alertType = 'Note';
            if (alertText.includes('[!NOTE]') || alertText.includes('[!INFO]')) {
              alertType = 'Note';
              alertText = alertText.replace(/\[!(NOTE|INFO)\]/g, '').trim();
            } else if (alertText.includes('[!TIP]') || alertText.includes('[!LIGHTBULB]')) {
              alertType = 'Tip';
              alertText = alertText.replace(/\[!(TIP|LIGHTBULB)\]/g, '').trim();
            } else if (alertText.includes('[!IMPORTANT]') || alertText.includes('[!WARNING]')) {
              alertType = 'Important';
              alertText = alertText.replace(/\[!(IMPORTANT|WARNING)\]/g, '').trim();
            } else if (alertText.includes('[!CAUTION]')) {
              alertType = 'Caution';
              alertText = alertText.replace(/\[!CAUTION\]/g, '').trim();
            }
            
            const wrapped = wrapText(doc, `${alertType}: ${alertText}`, contentWidth - 8);
            const rectHeight = wrapped.length * 4.5 + 4;
            
            ensureSpace(rectHeight + 4);
            doc.setFillColor(...COLORS.light);
            doc.roundedRect(margin, y - 2, contentWidth, rectHeight, 1.5, 1.5, 'F');
            
            // left border accent
            doc.setDrawColor(...COLORS.primary);
            doc.setLineWidth(0.8);
            doc.line(margin, y - 2, margin, y - 2 + rectHeight);
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...COLORS.muted);
            
            for (const wl of wrapped) {
              doc.text(wl, margin + 4, y + 1.5);
              y += 4.5;
            }
            y += 2.5;
          }
          // Standard Paragraph text
          else {
            const cleanLine = line.replace(/\*\*+/g, '');
            const wrapped = wrapText(doc, cleanLine, contentWidth);
            for (const wl of wrapped) {
              ensureSpace(5);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8.5);
              doc.setTextColor(...COLORS.dark);
              doc.text(wl, margin, y);
              y += 4.5;
            }
          }
        }
        y += 6;
      }
    }

    // ─────────────────────────────────────────────
    // FOOTER on every page
    // ─────────────────────────────────────────────
    const pageCount = (doc as any).internal.getNumberOfPages();
    const now = new Date().toLocaleDateString();
    for (let i = 1; i <= pageCount; i++) {
      (doc as any).setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.muted);
      doc.text(`Generated by TravelMind AI on ${now}  •  Page ${i} of ${pageCount}`, margin, pageHeight - 8);
    }

    // ─────────────────────────────────────────────
    // OUTPUT
    // ─────────────────────────────────────────────
    const pdfBuffer = doc.output('arraybuffer');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="TravelMind-${destination.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}