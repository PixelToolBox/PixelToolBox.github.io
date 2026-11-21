(() => {
  const fileInput = document.getElementById("fileInput");
  const dropZone = document.getElementById("dropZone");
  const fileMeta = document.getElementById("fileMeta");
  const fileSummary = document.getElementById("fileSummary");
  const clearButton = document.getElementById("clearButton");
  const quality = document.getElementById("quality");
  const qualityValue = document.getElementById("qualityValue");
  const backgroundColor = document.getElementById("backgroundColor");
  const selectionCount = document.getElementById("selectionCount");
  const convertButton = document.getElementById("convertButton");
  const statusMessage = document.getElementById("statusMessage");
  const fileList = document.getElementById("fileList");
  const emptyResults = document.getElementById("emptyResults");
  const resultCount = document.getElementById("resultCount");

  let selectedFiles = [];
  let convertedUrls = [];

  function clearResults() {
    convertedUrls.forEach(url => URL.revokeObjectURL(url));
    convertedUrls = [];
    fileList.innerHTML = "";
    emptyResults.hidden = false;
    resultCount.textContent = "0 files";
  }

  function addFiles(fileListLike) {
    const incoming = Array.from(fileListLike).filter(file =>
      file.type === "image/png" || file.name.toLowerCase().endsWith(".png")
    );
    if (!incoming.length) {
      statusMessage.textContent = "Please choose PNG image files.";
      return;
    }

    const known = new Set(selectedFiles.map(file => `${file.name}-${file.size}-${file.lastModified}`));
    incoming.forEach(file => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (!known.has(key)) {
        selectedFiles.push(file);
        known.add(key);
      }
    });

    clearResults();
    updateSelection();
    statusMessage.textContent = "";
  }

  function updateSelection() {
    const count = selectedFiles.length;
    fileMeta.classList.toggle("visible", count > 0);
    fileSummary.textContent = count === 1 ? selectedFiles[0].name : `${count} PNG files selected`;
    selectionCount.textContent = count ? `${count} PNG${count === 1 ? "" : "s"} ready` : "No files selected";
    convertButton.disabled = count === 0;
  }

  function safeBaseName(name) {
    return name.replace(/\.png$/i, "") || "image";
  }

  function convertFile(file, qualityValue, background) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const sourceUrl = URL.createObjectURL(file);

      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d");
          context.fillStyle = background;
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0);

          canvas.toBlob(blob => {
            URL.revokeObjectURL(sourceUrl);
            if (!blob) {
              reject(new Error(`Could not convert ${file.name}`));
              return;
            }
            resolve({
              blob,
              name: `${safeBaseName(file.name)}.jpg`,
              width: image.naturalWidth,
              height: image.naturalHeight
            });
          }, "image/jpeg", qualityValue);
        } catch (error) {
          URL.revokeObjectURL(sourceUrl);
          reject(error);
        }
      };

      image.onerror = () => {
        URL.revokeObjectURL(sourceUrl);
        reject(new Error(`Could not read ${file.name}`));
      };
      image.src = sourceUrl;
    });
  }

  function addResult(result) {
    const url = URL.createObjectURL(result.blob);
    convertedUrls.push(url);

    const item = document.createElement("div");
    item.className = "converted-file";

    const info = document.createElement("div");
    info.className = "converted-file-info";

    const name = document.createElement("div");
    name.className = "converted-file-name";
    name.textContent = result.name;

    const detail = document.createElement("div");
    detail.className = "converted-file-detail";
    const sizeKB = Math.max(1, Math.round(result.blob.size / 1024));
    detail.textContent = `${result.width} × ${result.height} px · ${sizeKB} KB`;

    const link = document.createElement("a");
    link.href = url;
    link.download = result.name;
    link.textContent = "Download JPG";

    info.append(name, detail);
    item.append(info, link);
    fileList.append(item);
  }

  fileInput.addEventListener("change", event => {
    addFiles(event.target.files);
    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach(type => {
    dropZone.addEventListener(type, event => {
      event.preventDefault();
      dropZone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach(type => {
    dropZone.addEventListener(type, event => {
      event.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });
  dropZone.addEventListener("drop", event => addFiles(event.dataTransfer.files));

  quality.addEventListener("input", () => {
    qualityValue.textContent = `${quality.value}%`;
  });

  clearButton.addEventListener("click", () => {
    selectedFiles = [];
    clearResults();
    updateSelection();
    statusMessage.textContent = "";
  });

  convertButton.addEventListener("click", async () => {
    if (!selectedFiles.length) return;
    convertButton.disabled = true;
    clearResults();
    const qualitySetting = Number(quality.value) / 100;
    const background = backgroundColor.value;
    let completed = 0;
    let failed = 0;

    for (const file of selectedFiles) {
      statusMessage.textContent = `Converting ${completed + failed + 1} of ${selectedFiles.length}…`;
      try {
        const result = await convertFile(file, qualitySetting, background);
        addResult(result);
        completed++;
      } catch (error) {
        console.error(error);
        failed++;
      }
    }

    emptyResults.hidden = completed > 0;
    resultCount.textContent = `${completed} file${completed === 1 ? "" : "s"}`;
    statusMessage.textContent = failed
      ? `Finished: ${completed} converted, ${failed} failed.`
      : `Finished: ${completed} JPG file${completed === 1 ? "" : "s"} ready to download.`;
    convertButton.disabled = selectedFiles.length === 0;
  });
})();
