"use strict";

(function initParser(global) {
  const SELECTORS = {
    questionBlocks: '[role="listitem"]',
    heading: '[role="heading"]',
    radio: '[role="radio"]',
    checkbox: '[role="checkbox"]',
    listbox: '[role="listbox"]',
    option: '[role="option"]',
    grid: '[role="grid"], table',
    textInput: 'input[type="text"]',
    paragraph: "textarea",
    date: 'input[type="date"]',
    time: 'input[type="time"]'
  };
  const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

  function textOf(element) {
    if (!element) return "";
    const labelledBy = element.getAttribute("aria-labelledby");
    const labelledText = labelledBy && labelledBy.split(/\s+/).map((id) => element.ownerDocument.getElementById(id)?.textContent || "").join(" ");
    return global.FormHelperUtils.cleanText(element.getAttribute("aria-label") || element.getAttribute("data-value") || labelledText || element.textContent);
  }

  function imageObject(img) {
    if (!img || !img.src || img.src.startsWith("data:image/svg+xml")) return null;
    const rect = img.getBoundingClientRect ? img.getBoundingClientRect() : { width: img.width, height: img.height };
    const width = rect.width || img.width || img.naturalWidth || 0;
    const height = rect.height || img.height || img.naturalHeight || 0;
    const questionImage = img.closest(SELECTORS.heading);
    const optionImage = img.closest(`${SELECTORS.radio}, ${SELECTORS.checkbox}, ${SELECTORS.option}`);
    if (width < 40 && height < 40 && !questionImage && !optionImage) return null;
    const declaredType = (img.getAttribute("type") || "").toLowerCase();
    return { url: img.src, mimeType: IMAGE_TYPES.has(declaredType) ? declaredType : "image/jpeg", base64: null };
  }

  function imagesIn(element) {
    return [...element.querySelectorAll("img")]
      .filter((img) => !img.closest(`${SELECTORS.radio}, ${SELECTORS.checkbox}, ${SELECTORS.option}`))
      .map(imageObject)
      .filter(Boolean)
      .filter((image) => !image.mimeType || IMAGE_TYPES.has(image.mimeType));
  }

  function optionFromElement(element, key) {
    const label = textOf(element) || textOf(element.parentElement);
    const image = [...element.querySelectorAll("img")].map(imageObject).find(Boolean) || null;
    return { key, text: label, image, isOther: /^(other|lainnya)(\b|$)/i.test(label) };
  }

  function buildOptions(elements) {
    return elements.map((element) => optionFromElement(element, ""))
      .filter((option) => option.text || option.image)
      .map((option, index) => ({ ...option, key: String.fromCharCode(65 + index) }));
  }

  function gridData(block, isCheckbox) {
    const table = block.querySelector(SELECTORS.grid);
    if (!table) return null;
    const rows = [...table.querySelectorAll("tr")];
    if (rows.length < 2) return null;
    const columns = [...rows[0].querySelectorAll("th, td")].slice(1).map(textOf).filter(Boolean);
    const questionRows = rows.slice(1).map((row) => textOf(row.querySelector("th, td"))).filter(Boolean);
    if (!questionRows.length || !columns.length) return null;
    const groups = [...block.querySelectorAll(isCheckbox ? SELECTORS.checkbox : SELECTORS.radio)];
    if (groups.length < questionRows.length) return null;
    return { rows: questionRows, columns };
  }

  function parseQuestion(block) {
    if (!block || !block.querySelector) return null;
    if (block.matches(".que")) return parseHebatQuestion(block);
    const heading = block.querySelector(SELECTORS.heading);
    const headingText = textOf(heading);
    const questionImages = imagesIn(block);
    const optionImages = [...block.querySelectorAll(`${SELECTORS.radio}, ${SELECTORS.checkbox}, ${SELECTORS.option}`)]
      .some((option) => [...option.querySelectorAll("img")].some((img) => imageObject(img)));
    if (!headingText && !questionImages.length && !optionImages) return null;
    const text = headingText || "Soal bergambar tanpa teks.";

    const radios = [...block.querySelectorAll(SELECTORS.radio)];
    const checkboxes = [...block.querySelectorAll(SELECTORS.checkbox)];
    const listbox = block.querySelector(SELECTORS.listbox);
    let type;
    let options = [];
    let scale = null;
    let rows = null;
    let columns = null;

    if (block.querySelector('input[type="file"]') || /upload file|unggah file/i.test(block.textContent)) {
      type = "unsupported_file_upload";
    } else if (radios.length > 1 && block.querySelector(SELECTORS.grid)) {
      type = "grid_mc";
      const grid = gridData(block, false);
      if (!grid) return null;
      ({ rows, columns } = grid);
    } else if (checkboxes.length > 1 && block.querySelector(SELECTORS.grid)) {
      type = "grid_checkbox";
      const grid = gridData(block, true);
      if (!grid) return null;
      ({ rows, columns } = grid);
    } else if (radios.length) {
      const labels = radios.map(textOf);
      const numbers = labels.map((value) => Number.parseInt(value, 10)).filter(Number.isFinite);
      if (numbers.length === radios.length && numbers.length > 1) {
        type = "linear_scale";
        scale = { min: Math.min(...numbers), max: Math.max(...numbers), minLabel: labels[0] === String(numbers[0]) ? "" : labels[0], maxLabel: labels.at(-1) === String(numbers.at(-1)) ? "" : labels.at(-1) };
        options = buildOptions(radios);
      } else {
        type = "multiple_choice";
        options = buildOptions(radios);
      }
    } else if (checkboxes.length) {
      type = "checkbox";
      options = buildOptions(checkboxes);
    } else if (listbox) {
      type = "dropdown";
      options = buildOptions([...block.querySelectorAll(SELECTORS.option)].filter((option) => !/^(select|pilih)(\b|$)/i.test(textOf(option))));
    } else if (block.querySelector(SELECTORS.paragraph)) {
      type = "paragraph";
    } else if (block.querySelector(SELECTORS.date)) {
      type = "date";
    } else if (block.querySelector(SELECTORS.time)) {
      type = "time";
    } else if (block.querySelector(SELECTORS.textInput)) {
      type = "short_answer";
    } else {
      return null;
    }

    const images = questionImages.slice(0, 4);
    let imageBudget = 4 - images.length;
    let imagesTruncated = questionImages.length > images.length;
    const limitedOptions = options.map((option) => {
      if (!option.image) return option;
      if (imageBudget > 0) {
        imageBudget -= 1;
        return option;
      }
      imagesTruncated = true;
      return { ...option, image: null };
    });

    return {
      id: block.getAttribute("data-params") || "",
      type,
      text,
      required: Boolean(block.querySelector('[aria-label*="required" i], [aria-label*="wajib" i]')),
      options: limitedOptions,
      scale,
      rows,
      columns,
      images,
      imagesTruncated
    };
  }

  function moodleInputLabel(input) {
    return input.labels?.[0]
      || (input.id && [...input.ownerDocument.querySelectorAll("label[for]")].find((label) => label.htmlFor === input.id))
      || input.closest(".r0, .r1, .answer div")
      || input.parentElement;
  }

  function moodleOption(input, index) {
    const label = moodleInputLabel(input);
    if (!label) return null;
    const labelText = label.querySelector('[data-region="answer-label"]') || label;
    const image = label.querySelector("img");
    const imgUrl = image ? (image.currentSrc || image.src || image.getAttribute("data-src") || "") : "";
    const optionImage = imgUrl ? { url: imgUrl, mimeType: "image/jpeg", base64: null } : null;
    const text = global.FormHelperUtils.cleanText(labelText.textContent);
    return { key: String.fromCharCode(65 + index), text, image: optionImage, isOther: false };
  }

  function parseHebatQuestion(block) {
    const qtext = block.querySelector(".qtext");
    if (!qtext) return null;
    const text = global.FormHelperUtils.cleanText(qtext.textContent) || "Soal bergambar tanpa teks.";
    const questionImages = [...qtext.querySelectorAll("img")].map((img) => ({
      url: img.currentSrc || img.src || img.getAttribute("data-src") || "",
      mimeType: "image/jpeg",
      base64: null
    })).filter((image) => image.url).slice(0, 4);
    const allQuestionImages = qtext.querySelectorAll("img").length;
    const radioInputs = [...block.querySelectorAll('.answer input[type="radio"]')];
    const checkboxInputs = [...block.querySelectorAll('.answer input[type="checkbox"]')];
    let type;
    let options = [];
    let scale = null;
    if (checkboxInputs.length) {
      type = "checkbox";
      options = checkboxInputs.map(moodleOption).filter((option) => option && (option.text || option.image));
    } else if (radioInputs.length) {
      type = "multiple_choice";
      options = radioInputs.map(moodleOption).filter((option) => option && (option.text || option.image));
    } else if (block.querySelector(".answer select")) {
      type = "dropdown";
      const select = block.querySelector(".answer select");
      options = [...select.options].filter((option) => option.value !== "").map((option, index) => ({
        key: String.fromCharCode(65 + index), text: global.FormHelperUtils.cleanText(option.textContent), image: null, isOther: false
      }));
    } else if (block.querySelector(".answer textarea, .answer [contenteditable=\"true\"], .answer .editor_atto_content, .answer .qtype_essay_response")
      || block.classList.contains("essay")
      || block.querySelector(".qtype_essay_response")) {
      type = "paragraph";
    } else if (block.querySelector('.answer input[type="text"], .answer input[type="number"]')) {
      type = "short_answer";
    } else {
      return null;
    }
    if (["multiple_choice", "checkbox", "dropdown"].includes(type) && !options.length) return null;
    const optionImages = options.filter((option) => option.image).length;
    const allowedQuestionImages = questionImages.slice(0, Math.max(0, 4 - optionImages));
    const optionBudget = Math.max(0, 4 - allowedQuestionImages.length);
    let usedOptionImages = 0;
    options = options.map((option) => {
      if (!option.image) return option;
      if (usedOptionImages++ < optionBudget) return option;
      return { ...option, image: null };
    });
    return {
      id: block.id || "",
      type,
      text,
      required: block.classList.contains("required") || Boolean(block.querySelector('[aria-required="true"]')),
      options,
      scale,
      rows: null,
      columns: null,
      images: allowedQuestionImages,
      imagesTruncated: allQuestionImages > allowedQuestionImages.length || optionImages > optionBudget
    };
  }

  function encodeCanvasWithBudget(img, maxBytes) {
    const naturalW = img.naturalWidth || img.width || 0;
    const naturalH = img.naturalHeight || img.height || 0;
    if (naturalW <= 1 && naturalH <= 1) return null;
    const edges = [1800, 1280, 900];
    for (const maxEdge of edges) {
      const ratio = Math.min(1, maxEdge / Math.max(naturalW, naturalH));
      const drawW = Math.max(1, Math.round(naturalW * ratio));
      const drawH = Math.max(1, Math.round(naturalH * ratio));
      const canvasW = Math.max(16, drawW);
      const canvasH = Math.max(16, drawH);
      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return null;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvasW, canvasH);
      context.drawImage(img, 0, 0, drawW, drawH);

      const pngUrl = canvas.toDataURL("image/png");
      const pngBase64 = pngUrl.split(",")[1] || "";
      if (pngBase64 && pngBase64.length <= Math.min(550_000, maxBytes)) {
        return { mimeType: "image/png", base64: pngBase64, url: null };
      }
      for (const quality of [0.92, 0.78, 0.62]) {
        const jpgUrl = canvas.toDataURL("image/jpeg", quality);
        const jpgBase64 = jpgUrl.split(",")[1] || "";
        if (jpgBase64 && jpgBase64.length <= maxBytes) {
          return { mimeType: "image/jpeg", base64: jpgBase64, url: null };
        }
      }
    }
    return null;
  }

  function captureRenderedImage(img, maxBytes = 1_400_000) {
    if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return null;
    try {
      const rawSrc = img.currentSrc || img.src || "";
      const sourceUrl = new URL(rawSrc, location.href);
      const isInlineOrSameOrigin = sourceUrl.origin === location.origin
        || sourceUrl.protocol === "data:"
        || sourceUrl.protocol === "blob:";
      if (!isInlineOrSameOrigin) return null;
      return encodeCanvasWithBudget(img, maxBytes);
    } catch {
      return null;
    }
  }

  async function waitForImageReady(img, timeoutMs = 3000) {
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) return;
    if (typeof img.decode === "function") {
      try {
        await Promise.race([img.decode(), new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
        if (img.naturalWidth > 0) return;
      } catch {
        // Fallback to load event below
      }
    }
    if (img.complete) return;
    await new Promise((resolve) => {
      const done = () => {
        img.removeEventListener("load", done);
        img.removeEventListener("error", done);
        resolve();
      };
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
      setTimeout(done, timeoutMs);
    });
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  function sniffImageMime(bytes) {
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes.length >= 6 && String.fromCharCode(...bytes.subarray(0, 3)) === "GIF") return "image/gif";
    if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "image/webp";
    return "";
  }

  async function fetchHebatImageFallback(img, maxBytes) {
    const rawSrc = img?.currentSrc || img?.src || img?.getAttribute?.("data-src") || "";
    if (!rawSrc) return null;
    let parsedUrl;
    try { parsedUrl = new URL(rawSrc, location.href); } catch { return null; }
    const sameOrigin = parsedUrl.origin === location.origin || parsedUrl.protocol === "data:" || parsedUrl.protocol === "blob:";
    if (sameOrigin && typeof fetch === "function") {
      try {
        const res = await fetch(parsedUrl.href, { credentials: "include" });
        if (res.ok) {
          const blob = await res.blob();
          if (typeof createImageBitmap === "function" && typeof document !== "undefined") {
            try {
              const bitmap = await createImageBitmap(blob);
              const pseudoImg = { naturalWidth: bitmap.width, naturalHeight: bitmap.height, width: bitmap.width, height: bitmap.height };
              const canvas = document.createElement("canvas");
              const ratio = Math.min(1, 1600 / Math.max(bitmap.width || 1, bitmap.height || 1));
              canvas.width = Math.max(16, Math.round(bitmap.width * ratio));
              canvas.height = Math.max(16, Math.round(bitmap.height * ratio));
              const ctx = canvas.getContext("2d", { alpha: false });
              if (ctx) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                bitmap.close?.();
                const jpgUrl = canvas.toDataURL("image/jpeg", 0.88);
                const base64 = jpgUrl.split(",")[1] || "";
                if (base64 && base64.length <= maxBytes) return { mimeType: "image/jpeg", base64, url: null };
              }
              void pseudoImg;
            } catch {
              // Fall back to raw bytes
            }
          }
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const mimeType = sniffImageMime(bytes) || (IMAGE_TYPES.has(blob.type) ? blob.type : "");
          if (mimeType && bytes.length > 0 && bytes.length <= 2 * 1024 * 1024) {
            const base64 = bytesToBase64(bytes);
            if (base64.length <= maxBytes) return { mimeType, base64, url: null };
          }
          const isSvg = blob.type === "image/svg+xml" || parsedUrl.pathname.toLowerCase().endsWith(".svg");
          if (isSvg && typeof Image === "function" && typeof URL.createObjectURL === "function") {
            const objUrl = URL.createObjectURL(blob);
            try {
              const svgImg = new Image();
              await new Promise((resolve) => {
                svgImg.onload = resolve;
                svgImg.onerror = resolve;
                svgImg.src = objUrl;
              });
              const captured = encodeCanvasWithBudget(svgImg, maxBytes);
              if (captured) return captured;
            } finally {
              URL.revokeObjectURL(objUrl);
            }
          }
        }
      } catch {
        // Fall through
      }
    }
    if (parsedUrl.protocol === "https:" && parsedUrl.origin !== location.origin) {
      return { mimeType: "image/jpeg", base64: null, url: parsedUrl.href };
    }
    return null;
  }

  function prepareHebatQuestion(block, question) {
    const prepared = { ...question, images: [], options: question.options.map((option) => ({ ...option, image: null })) };
    const qtextImages = [...block.querySelector(".qtext").querySelectorAll("img")];
    let truncated = question.imagesTruncated;
    let totalImageBytes = 0;
    const maxTotalBase64 = 1_800_000;
    for (const img of qtextImages.slice(0, question.images.length)) {
      const remaining = Math.max(200_000, maxTotalBase64 - totalImageBytes);
      const captured = captureRenderedImage(img, remaining);
      if (captured && totalImageBytes + captured.base64.length <= maxTotalBase64) {
        prepared.images.push(captured);
        totalImageBytes += captured.base64.length;
      } else truncated = true;
    }
    const inputImages = [...block.querySelectorAll('.answer input[type="radio"], .answer input[type="checkbox"]')]
      .map((input) => {
        const label = moodleInputLabel(input);
        return label?.querySelector("img") || null;
      });
    prepared.options = question.options.map((option) => {
      if (!option.image) return option;
      const optionIndex = option.key.charCodeAt(0) - 65;
      const img = inputImages[optionIndex];
      const remaining = Math.max(200_000, maxTotalBase64 - totalImageBytes);
      const captured = captureRenderedImage(img, remaining);
      if (!captured || totalImageBytes + captured.base64.length > maxTotalBase64) { truncated = true; return { ...option, image: null }; }
      totalImageBytes += captured.base64.length;
      return { ...option, image: captured };
    });
    prepared.imagesTruncated = truncated;
    return prepared;
  }

  async function prepareHebatQuestionAsync(block, question) {
    const prepared = { ...question, images: [], options: question.options.map((option) => ({ ...option, image: null })) };
    const qtextImages = [...block.querySelector(".qtext").querySelectorAll("img")];
    let truncated = question.imagesTruncated;
    let totalImageBytes = 0;
    const maxTotalBase64 = 1_800_000;
    for (const img of qtextImages.slice(0, question.images.length)) {
      await waitForImageReady(img);
      const remaining = Math.max(200_000, maxTotalBase64 - totalImageBytes);
      let captured = captureRenderedImage(img, remaining);
      if (!captured) captured = await fetchHebatImageFallback(img, remaining);
      if (captured && (!captured.base64 || totalImageBytes + captured.base64.length <= maxTotalBase64)) {
        prepared.images.push(captured);
        if (captured.base64) totalImageBytes += captured.base64.length;
      } else {
        truncated = true;
      }
    }
    const inputImages = [...block.querySelectorAll('.answer input[type="radio"], .answer input[type="checkbox"]')]
      .map((input) => {
        const label = moodleInputLabel(input);
        return label?.querySelector("img") || null;
      });
    prepared.options = await Promise.all(question.options.map(async (option) => {
      if (!option.image) return option;
      const optionIndex = option.key.charCodeAt(0) - 65;
      const img = inputImages[optionIndex];
      await waitForImageReady(img);
      const remaining = Math.max(200_000, maxTotalBase64 - totalImageBytes);
      let captured = captureRenderedImage(img, remaining);
      if (!captured) captured = await fetchHebatImageFallback(img, remaining);
      if (!captured || (captured.base64 && totalImageBytes + captured.base64.length > maxTotalBase64)) {
        truncated = true;
        return { ...option, image: null };
      }
      if (captured.base64) totalImageBytes += captured.base64.length;
      return { ...option, image: captured };
    }));
    prepared.imagesTruncated = truncated;
    return prepared;
  }

  function getQuestionBlocks(platform = "google") {
    return [...document.querySelectorAll(platform === "hebat" ? "#responseform .que" : SELECTORS.questionBlocks)];
  }

  global.FormHelperParser = { SELECTORS, parseQuestion, getQuestionBlocks, prepareHebatQuestion, prepareHebatQuestionAsync };
})(globalThis);
