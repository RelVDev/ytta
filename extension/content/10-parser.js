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

    return {
      id: block.getAttribute("data-params") || "",
      type,
      text,
      required: Boolean(block.querySelector('[aria-label*="required" i], [aria-label*="wajib" i]')),
      options,
      scale,
      rows,
      columns,
      images: questionImages.slice(0, 4)
    };
  }

  global.FormHelperParser = { SELECTORS, parseQuestion };
})(globalThis);
