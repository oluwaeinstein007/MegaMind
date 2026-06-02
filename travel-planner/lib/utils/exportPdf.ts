// utils/exportPdf.ts
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export async function exportPlan(rootId = 'trip-root') {
  const root = document.getElementById(rootId)!
  const canvas = await html2canvas(root, { scale: 2 })
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const ratio = Math.min(pageW / canvas.width, pageH / canvas.height)
  pdf.addImage(
    imgData,
    'PNG',
    0,
    0,
    canvas.width * ratio,
    canvas.height * ratio
  )
  pdf.save('itinerary.pdf')
}
