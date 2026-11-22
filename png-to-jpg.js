(() => {
  const $ = (id) => document.getElementById(id);
  const fileInput = $('fileInput'), dropZone = $('dropZone'), fileMeta = $('fileMeta');
  const fileSummary = $('fileSummary'), clearButton = $('clearButton');
  const quality = $('quality'), qualityValue = $('qualityValue'), qualityLabel = $('qualityLabel');
  const qualityGroup = $('qualityGroup'), outputFormat = $('outputFormat');
  const backgroundColor = $('backgroundColor'), backgroundGroup = $('backgroundGroup');
  const formatHint = $('formatHint'), selectionCount = $('selectionCount');
  const convertButton = $('convertButton'), statusMessage = $('statusMessage');
  const fileList = $('fileList'), emptyResults = $('emptyResults'), resultCount = $('resultCount');

  let selectedFiles = [];
  let convertedUrls = [];
  const accepted = new Set(['image/png', 'image/jpeg', 'image/webp']);

  function extensionFor(mime) {
    return mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp';
  }
  function clearResults() {
    convertedUrls.forEach(URL.revokeObjectURL);
    convertedUrls = [];
    fileList.innerHTML = '';
    emptyResults.hidden = false;
    resultCount.textContent = '0 files';
  }
  function addFiles(fileListLike) {
    const incoming = Array.from(fileListLike).filter(file =>
      accepted.has(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name)
    );
    if (!incoming.length) {
      statusMessage.textContent = 'Please choose PNG, JPG or WebP image files.';
      return;
    }
    const known = new Set(selectedFiles.map(file => `${file.name}-${file.size}-${file.lastModified}`));
    incoming.forEach(file => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (!known.has(key)) { selectedFiles.push(file); known.add(key); }
    });
    clearResults(); updateSelection(); statusMessage.textContent = '';
  }
  function updateSelection() {
    const count = selectedFiles.length;
    fileMeta.classList.toggle('visible', count > 0);
    fileSummary.textContent = count === 1 ? selectedFiles[0].name : `${count} images selected`;
    selectionCount.textContent = count ? `${count} image${count === 1 ? '' : 's'} ready` : 'No files selected';
    convertButton.disabled = count === 0;
  }
  function updateFormatControls() {
    const mime = outputFormat.value;
    const isPng = mime === 'image/png';
    const isJpg = mime === 'image/jpeg';
    qualityGroup.hidden = isPng;
    backgroundGroup.hidden = !isJpg;
    qualityLabel.textContent = `${isJpg ? 'JPG' : 'WebP'} quality`;
    formatHint.textContent = isJpg
      ? 'JPG does not support transparency. Transparent areas will be filled with the background colour above.'
      : isPng
        ? 'PNG is lossless and supports transparency. The quality slider is not needed.'
        : 'WebP supports transparency. The quality setting controls the balance between image quality and file size.';
  }
  function baseName(name) { return name.replace(/\.(png|jpe?g|webp)$/i, '') || 'image'; }

  function convertFile(file, mime, qualitySetting, background) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const sourceUrl = URL.createObjectURL(file);
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
          const context = canvas.getContext('2d');
          if (mime === 'image/jpeg') {
            context.fillStyle = background;
            context.fillRect(0, 0, canvas.width, canvas.height);
          }
          context.drawImage(image, 0, 0);
          canvas.toBlob(blob => {
            URL.revokeObjectURL(sourceUrl);
            if (!blob) { reject(new Error(`Could not convert ${file.name}`)); return; }
            if (blob.type !== mime) { reject(new Error(`${extensionFor(mime).toUpperCase()} export is not supported by this browser.`)); return; }
            resolve({ blob, name: `${baseName(file.name)}.${extensionFor(mime)}`, width: image.naturalWidth, height: image.naturalHeight });
          }, mime, mime === 'image/png' ? undefined : qualitySetting);
        } catch (error) { URL.revokeObjectURL(sourceUrl); reject(error); }
      };
      image.onerror = () => { URL.revokeObjectURL(sourceUrl); reject(new Error(`Could not read ${file.name}`)); };
      image.src = sourceUrl;
    });
  }
  function addResult(result, mime) {
    const url = URL.createObjectURL(result.blob); convertedUrls.push(url);
    const item = document.createElement('div'); item.className = 'converted-file';
    const info = document.createElement('div'); info.className = 'converted-file-info';
    const name = document.createElement('div'); name.className = 'converted-file-name'; name.textContent = result.name;
    const detail = document.createElement('div'); detail.className = 'converted-file-detail';
    detail.textContent = `${result.width} × ${result.height} px · ${Math.max(1, Math.round(result.blob.size / 1024))} KB`;
    const link = document.createElement('a'); link.href = url; link.download = result.name;
    link.textContent = `Download ${extensionFor(mime).toUpperCase()}`;
    info.append(name, detail); item.append(info, link); fileList.append(item);
    emptyResults.hidden = true; resultCount.textContent = `${fileList.children.length} file${fileList.children.length === 1 ? '' : 's'}`;
  }

  fileInput.addEventListener('change', event => { addFiles(event.target.files); fileInput.value = ''; });
  ['dragenter', 'dragover'].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.remove('dragover'); }));
  dropZone.addEventListener('drop', event => addFiles(event.dataTransfer.files));
  quality.addEventListener('input', () => { qualityValue.textContent = `${quality.value}%`; });
  outputFormat.addEventListener('change', updateFormatControls);
  clearButton.addEventListener('click', () => { selectedFiles = []; clearResults(); updateSelection(); statusMessage.textContent = ''; });

  convertButton.addEventListener('click', async () => {
    if (!selectedFiles.length) return;
    convertButton.disabled = true; clearResults();
    const mime = outputFormat.value;
    const qualitySetting = Number(quality.value) / 100;
    let completed = 0, failed = 0;
    for (const file of selectedFiles) {
      statusMessage.textContent = `Converting ${completed + failed + 1} of ${selectedFiles.length}…`;
      try { addResult(await convertFile(file, mime, qualitySetting, backgroundColor.value), mime); completed++; }
      catch (error) { failed++; console.error(error); }
    }
    statusMessage.textContent = failed
      ? `Finished: ${completed} converted, ${failed} failed. Your browser may not support this output format for some files.`
      : `Successfully converted ${completed} image${completed === 1 ? '' : 's'}.`;
    convertButton.disabled = selectedFiles.length === 0;
  });

  updateFormatControls(); updateSelection();
})();
