import { showError, showSuccess } from './toast.js';

async function loadHtml2Canvas() {
  const module = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm');
  return module.default;
}

function buildCaptureNode(source) {
  const clone = source.cloneNode(true);
  clone.classList.add('published-schedule--capture');
  const wrapper = document.createElement('div');
  wrapper.className = 'published-capture-root';
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);
  return wrapper;
}

export async function downloadScheduleImage(sourceElement, filename = 'horario-paradise-pass.png') {
  if (!sourceElement) {
    showError('No hay horario visible para exportar.');
    return { ok: false };
  }

  let captureNode = null;
  try {
    const html2canvas = await loadHtml2Canvas();
    captureNode = buildCaptureNode(sourceElement);
    const canvas = await html2canvas(captureNode, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const link = document.createElement('a');
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showSuccess('Imagen descargada. Envíala por WhatsApp.');
    return { ok: true };
  } catch (error) {
    console.error(error);
    showError('No se pudo generar la imagen. Intenta de nuevo.');
    return { ok: false, error };
  } finally {
    captureNode?.remove();
  }
}

export async function copyTextToClipboard(text) {
  if (!text) {
    showError('No hay texto para copiar.');
    return { ok: false };
  }
  try {
    await navigator.clipboard.writeText(text);
    showSuccess('Texto copiado. Pégalo en WhatsApp.');
    return { ok: true };
  } catch {
    showError('No se pudo copiar. Revisa permisos del navegador.');
    return { ok: false };
  }
}
