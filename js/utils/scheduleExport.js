import { showError, showSuccess } from './toast.js';
import { COACH_GPT_URL, COACH_SHARE_TEXT } from '../../domain/coachLinks.js';

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

export async function captureElementToBlob(sourceElement) {
  if (!sourceElement) return null;

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
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('empty capture'))), 'image/png');
    });
  } finally {
    captureNode?.remove();
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export async function openCoachWithStatsImage(sourceElement, { filename = 'stats-paradise-pass.png' } = {}) {
  if (!sourceElement) {
    showError('No hay stats visibles para compartir con el Coach.');
    return { ok: false };
  }

  const popup = window.open('about:blank', '_blank');
  try {
    const blob = await captureElementToBlob(sourceElement);
    if (!blob) throw new Error('capture failed');

    const safeName = filename.endsWith('.png') ? filename : `${filename}.png`;
    const file = new File([blob], safeName, { type: 'image/png' });

    if (popup) popup.location.href = COACH_GPT_URL;
    else window.open(COACH_GPT_URL, '_blank', 'noopener,noreferrer');

    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
            'text/plain': new Blob([COACH_SHARE_TEXT], { type: 'text/plain' }),
          }),
        ]);
        showSuccess('ChatGPT abierto. Pega la imagen y escribe tu caso.');
        return { ok: true, method: 'clipboard' };
      } catch {
        // Fall through to share or download.
      }
    }

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Stats Paradise Pass',
          text: COACH_SHARE_TEXT,
        });
        showSuccess('Comparte la imagen en ChatGPT y completa tu caso.');
        return { ok: true, method: 'share' };
      } catch (error) {
        if (error?.name === 'AbortError') {
          downloadBlob(blob, safeName);
          showSuccess('ChatGPT abierto. Sube la imagen descargada y escribe tu caso.');
          return { ok: true, method: 'download-after-cancel' };
        }
      }
    }

    downloadBlob(blob, safeName);
    showSuccess('ChatGPT abierto. Sube la imagen descargada y escribe tu caso.');
    return { ok: true, method: 'download' };
  } catch (error) {
    popup?.close();
    console.error(error);
    showError('No se pudo preparar la imagen. Intenta de nuevo.');
    return { ok: false, error };
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
