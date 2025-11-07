// src/exporters/pdf.ts
// 使用 html2pdf.js 将指定 DOM 元素导出为 PDF 字节

function normalizeSvgSize(svgEl: SVGElement, targetWidth: number) {
  try {
    const vb = svgEl.getAttribute('viewBox')
    let w = 0, h = 0
    if (vb) {
      const p = vb.split(/\s+/).map(Number)
      if (p.length === 4) { w = p[2]; h = p[3] }
    }
    const hasWH = Number(svgEl.getAttribute('width')) || Number(svgEl.getAttribute('height'))
    if ((!w || !h) && hasWH) {
      w = Number(svgEl.getAttribute('width')) || 800
      h = Number(svgEl.getAttribute('height')) || 600
    }
    if (!w || !h) { w = 800; h = 600 }
    const ratio = targetWidth / w
    const targetHeight = Math.max(1, Math.round(h * ratio))
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    svgEl.setAttribute('width', String(targetWidth))
    svgEl.setAttribute('height', String(targetHeight))
    try { (svgEl.style as any).maxWidth = '100%'; (svgEl.style as any).height = 'auto' } catch {}
  } catch {}
}

export async function exportPdf(el: HTMLElement, opt?: any): Promise<Uint8Array> {
  const mod: any = await import('html2pdf.js/dist/html2pdf.bundle.min.js')
  const html2pdf: any = (mod && (mod.default || mod)) || mod

  const options = {
    margin: 10, // 单位：mm
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] },
    ...opt,
  }

  // 使用当前预览宽度，避免导出时放大/缩小
  const previewWidth = (() => {
    try {
      const r = (el as HTMLElement).getBoundingClientRect()
      return Math.max(1, Math.round(r.width || (el as HTMLElement).clientWidth || 720))
    } catch { return 720 }
  })()

  // 克隆并约束为与预览一致的宽度
  const wrap = document.createElement('div')
  wrap.style.position = 'fixed'
  wrap.style.left = '-10000px'
  wrap.style.top = '0'
  wrap.style.width = previewWidth + 'px'
  const clone = el.cloneNode(true) as HTMLElement
  clone.style.width = previewWidth + 'px'

  // 基础样式：保证图片不溢出
  const style = document.createElement('style')
  style.textContent = `
    .preview-body img, img { max-width: 100% !important; height: auto !important; }
    figure { max-width: 100% !important; }
  `
  clone.prepend(style)

  // 冻结 SVG 为屏幕显示尺寸（逐一读取原节点的像素尺寸）
  try {
    const origSvgs = Array.from((el as HTMLElement).querySelectorAll('svg')) as SVGElement[]
    const cloneSvgs = Array.from(clone.querySelectorAll('svg')) as SVGElement[]
    const n = Math.min(origSvgs.length, cloneSvgs.length)
    for (let i = 0; i < n; i++) {
      try {
        const r = (origSvgs[i] as any).getBoundingClientRect?.() || { width: 0, height: 0 }
        const w = Math.max(1, Math.round((r.width as number) || 0))
        const h = Math.max(1, Math.round((r.height as number) || 0))
        cloneSvgs[i].setAttribute('preserveAspectRatio', 'xMidYMid meet')
        if (w) cloneSvgs[i].setAttribute('width', String(w))
        if (h) cloneSvgs[i].setAttribute('height', String(h))
        try { (cloneSvgs[i].style as any).width = w + 'px'; (cloneSvgs[i].style as any).height = 'auto' } catch {}
      } catch {}
    }
  } catch {}

  wrap.appendChild(clone)
  document.body.appendChild(wrap)
  try {
    const ab: ArrayBuffer = await html2pdf().set(options).from(clone).toPdf().output('arraybuffer')
    return new Uint8Array(ab)
  } finally {
    try { document.body.removeChild(wrap) } catch {}
  }
}
