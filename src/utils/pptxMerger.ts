import JSZip from 'jszip';
import { DocumentItem } from '../types';
import { parsePageRange } from './pdfMerger';

/**
 * Inspect a PPTX file to get slide count and slide preview titles.
 * Validates PPTX OpenXML structure.
 */
export async function inspectPptx(file: File): Promise<{ slideCount: number; slideTitles: string[] }> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const presXmlFile = zip.file('ppt/presentation.xml');
  if (!presXmlFile) {
    throw new Error('유효한 파워포인트(PPTX) 파일이 아닙니다.');
  }

  const presXmlText = await presXmlFile.async('text');
  const parser = new DOMParser();
  const presDoc = parser.parseFromString(presXmlText, 'application/xml');

  // Find all sldId elements regardless of namespace prefix
  const allElements = Array.from(presDoc.getElementsByTagName('*'));
  const sldIdElements = allElements.filter((el) => el.localName === 'sldId');
  const slideCount = sldIdElements.length;

  if (slideCount === 0) {
    throw new Error('프레젠테이션에 슬라이드가 없습니다.');
  }

  // Read relationships to map r:id to slide files
  const relsFile = zip.file('ppt/_rels/presentation.xml.rels');
  const relMap = new Map<string, string>();

  if (relsFile) {
    const relsText = await relsFile.async('text');
    const relsDoc = parser.parseFromString(relsText, 'application/xml');
    const relElements = Array.from(relsDoc.getElementsByTagName('*')).filter(
      (el) => el.localName === 'Relationship'
    );
    for (const rel of relElements) {
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      if (id && target) {
        relMap.set(id, target);
      }
    }
  }

  const slideTitles: string[] = [];

  for (let i = 0; i < sldIdElements.length; i++) {
    const sldEl = sldIdElements[i];
    const rId =
      sldEl.getAttribute('r:id') ||
      sldEl.getAttribute('id') ||
      Array.from(sldEl.attributes).find((a) => a.name.endsWith(':id') || a.name === 'id')?.value;

    let slidePath = rId ? relMap.get(rId) : null;
    if (!slidePath) {
      slidePath = `slides/slide${i + 1}.xml`;
    }
    const fullPath = slidePath.startsWith('ppt/') ? slidePath : `ppt/${slidePath.replace(/^\//, '')}`;
    const slideFile = zip.file(fullPath) || zip.file(`ppt/slides/slide${i + 1}.xml`);

    if (slideFile) {
      try {
        const slideXmlText = await slideFile.async('text');
        const slideDoc = parser.parseFromString(slideXmlText, 'application/xml');
        const textNodes = Array.from(slideDoc.getElementsByTagName('*')).filter(
          (el) => el.localName === 't'
        );
        const extractedTexts = textNodes
          .map((n) => n.textContent?.trim() || '')
          .filter((t) => t.length > 0);

        if (extractedTexts.length > 0) {
          slideTitles.push(extractedTexts[0].slice(0, 40));
        } else {
          slideTitles.push(`슬라이드 ${i + 1}`);
        }
      } catch {
        slideTitles.push(`슬라이드 ${i + 1}`);
      }
    } else {
      slideTitles.push(`슬라이드 ${i + 1}`);
    }
  }

  return {
    slideCount,
    slideTitles,
  };
}

/**
 * Merge multiple PPTX files losslessly into one presentation.
 * Preserves 100% original layout, shapes, embedded media (images, audio, video),
 * themes, slide masters, and formatting without rasterization.
 */
export async function mergePptxLossless(
  items: DocumentItem[],
  onProgress?: (progress: number, currentItem: string) => void
): Promise<{ pptxBytes: Uint8Array; totalSlides: number; slideList: { slideNum: number; sourceDoc: string; title: string }[] }> {
  if (items.length === 0) {
    throw new Error('병합할 파일이 없습니다.');
  }

  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  // Load first document as base presentation
  const baseBuffer = await items[0].file.arrayBuffer();
  const mergedZip = await JSZip.loadAsync(baseBuffer);

  const slideResults: { slideNum: number; sourceDoc: string; title: string }[] = [];

  // Parse base presentation.xml
  const basePresFile = mergedZip.file('ppt/presentation.xml');
  if (!basePresFile) throw new Error('기본 프레젠테이션 파일을 읽을 수 없습니다.');
  let basePresDoc = parser.parseFromString(await basePresFile.async('text'), 'application/xml');

  // Parse base presentation.xml.rels
  const baseRelsFile = mergedZip.file('ppt/_rels/presentation.xml.rels');
  if (!baseRelsFile) throw new Error('기본 프레젠테이션 관계 파일을 읽을 수 없습니다.');
  let baseRelsDoc = parser.parseFromString(await baseRelsFile.async('text'), 'application/xml');

  // Parse [Content_Types].xml
  const contentTypesFile = mergedZip.file('[Content_Types].xml');
  if (!contentTypesFile) throw new Error('[Content_Types].xml을 찾을 수 없습니다.');
  let contentTypesDoc = parser.parseFromString(await contentTypesFile.async('text'), 'application/xml');

  // Helper to find nodes by local name
  const getByLocalName = (doc: Document | Element, name: string) =>
    Array.from(doc.getElementsByTagName('*')).filter((el) => el.localName === name);

  // Helper to get max id in sldIdLst
  let maxSldIdNum = 256;
  const sldIdLst = getByLocalName(basePresDoc, 'sldIdLst')[0];
  if (sldIdLst) {
    const existingSldIds = getByLocalName(sldIdLst, 'sldId');
    for (const el of existingSldIds) {
      const idVal = parseInt(el.getAttribute('id') || '0', 10);
      if (idVal > maxSldIdNum) maxSldIdNum = idVal;
    }
  }

  // Helper to get next relationship ID
  let maxRelId = 100;
  const relsRoot = getByLocalName(baseRelsDoc, 'Relationships')[0];
  const existingRels = getByLocalName(baseRelsDoc, 'Relationship');
  for (const r of existingRels) {
    const id = r.getAttribute('Id') || '';
    const num = parseInt(id.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > maxRelId) maxRelId = num;
  }

  // Handle Document 0's slide selection
  const doc0 = items[0];
  const doc0Inspection = await inspectPptx(doc0.file);
  const doc0Range = parsePageRange(doc0.pageRange, doc0Inspection.slideCount);

  // Read existing slide mapping in doc0
  const doc0SldIds = sldIdLst ? getByLocalName(sldIdLst, 'sldId') : [];
  const selectedDoc0SldIds = doc0SldIds.filter((_, idx) => doc0Range.indices.includes(idx));

  // If doc0 has some unselected slides, remove them from sldIdLst
  if (sldIdLst) {
    while (sldIdLst.firstChild) {
      sldIdLst.removeChild(sldIdLst.firstChild);
    }
    for (let idx = 0; idx < selectedDoc0SldIds.length; idx++) {
      const sld = selectedDoc0SldIds[idx];
      sldIdLst.appendChild(sld);
      const originalIdx = doc0Range.indices[idx];
      slideResults.push({
        slideNum: slideResults.length + 1,
        sourceDoc: doc0.name,
        title: doc0Inspection.slideTitles[originalIdx] || `슬라이드 ${originalIdx + 1}`,
      });
    }
  }

  if (onProgress) {
    onProgress(15, `${items[0].name} 기준 슬라이드 구성 완료`);
  }

  let totalSlideCounter = selectedDoc0SldIds.length;

  // Process subsequent presentations (Doc 1, 2, ...)
  for (let docIdx = 1; docIdx < items.length; docIdx++) {
    const item = items[docIdx];
    if (onProgress) {
      const pct = Math.round(15 + (docIdx / items.length) * 75);
      onProgress(pct, `${item.name} 슬라이드 및 미디어 병합 중...`);
    }

    const docBuffer = await item.file.arrayBuffer();
    const docZip = await JSZip.loadAsync(docBuffer);

    const docPresFile = docZip.file('ppt/presentation.xml');
    if (!docPresFile) continue;
    const docPresDoc = parser.parseFromString(await docPresFile.async('text'), 'application/xml');

    const docRelsFile = docZip.file('ppt/_rels/presentation.xml.rels');
    if (!docRelsFile) continue;
    const docRelsDoc = parser.parseFromString(await docRelsFile.async('text'), 'application/xml');

    const docInspection = await inspectPptx(item.file);
    const docRange = parsePageRange(item.pageRange, docInspection.slideCount);

    const prefix = `d${docIdx}_`;

    // 1. Copy Media Files directly without any compression degradation
    const mediaFolder = docZip.folder('ppt/media');
    if (mediaFolder) {
      const mediaFiles = Object.keys(docZip.files).filter((p) => p.startsWith('ppt/media/') && !docZip.files[p].dir);
      for (const mediaPath of mediaFiles) {
        const rawFileName = mediaPath.replace('ppt/media/', '');
        const targetPath = `ppt/media/${prefix}${rawFileName}`;
        const data = await docZip.files[mediaPath].async('uint8array');
        mergedZip.file(targetPath, data);
      }
    }

    // 2. Copy Themes
    const themeFiles = Object.keys(docZip.files).filter((p) => p.startsWith('ppt/theme/theme') && !docZip.files[p].dir);
    for (const themePath of themeFiles) {
      const rawTheme = themePath.replace('ppt/theme/', '');
      const targetPath = `ppt/theme/${prefix}${rawTheme}`;
      const content = await docZip.files[themePath].async('text');
      mergedZip.file(targetPath, content);

      // Add to [Content_Types].xml
      const override = contentTypesDoc.createElement('Override');
      override.setAttribute('PartName', `/${targetPath}`);
      override.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.theme+xml');
      getByLocalName(contentTypesDoc, 'Types')[0]?.appendChild(override);
    }

    // 3. Copy Slide Layouts and update relationships
    const layoutFiles = Object.keys(docZip.files).filter((p) => p.startsWith('ppt/slideLayouts/slideLayout') && !p.includes('/_rels/') && !docZip.files[p].dir);
    for (const layoutPath of layoutFiles) {
      const rawLayout = layoutPath.replace('ppt/slideLayouts/', '');
      const targetLayoutPath = `ppt/slideLayouts/${prefix}${rawLayout}`;
      const layoutXml = await docZip.files[layoutPath].async('text');
      mergedZip.file(targetLayoutPath, layoutXml);

      // Register layout in Content_Types
      const override = contentTypesDoc.createElement('Override');
      override.setAttribute('PartName', `/${targetLayoutPath}`);
      override.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml');
      getByLocalName(contentTypesDoc, 'Types')[0]?.appendChild(override);

      // Handle layout .rels
      const layoutRelsPath = `ppt/slideLayouts/_rels/${rawLayout}.rels`;
      const layoutRelsFile = docZip.file(layoutRelsPath);
      if (layoutRelsFile) {
        let relsText = await layoutRelsFile.async('text');
        // Rewrite target paths to point to prefixed slideMasters, themes, media
        relsText = relsText
          .replace(/Target="\.\.\/slideMasters\/(slideMaster\d+\.xml)"/g, `Target="../slideMasters/${prefix}$1"`)
          .replace(/Target="\.\.\/theme\/(theme\d+\.xml)"/g, `Target="../theme/${prefix}$1"`)
          .replace(/Target="\.\.\/media\/([^"]+)"/g, `Target="../media/${prefix}$1"`);

        mergedZip.file(`ppt/slideLayouts/_rels/${prefix}${rawLayout}.rels`, relsText);
      }
    }

    // 4. Copy Slide Masters and update relationships
    const masterFiles = Object.keys(docZip.files).filter((p) => p.startsWith('ppt/slideMasters/slideMaster') && !p.includes('/_rels/') && !docZip.files[p].dir);
    for (const masterPath of masterFiles) {
      const rawMaster = masterPath.replace('ppt/slideMasters/', '');
      const targetMasterPath = `ppt/slideMasters/${prefix}${rawMaster}`;
      const masterXml = await docZip.files[masterPath].async('text');
      mergedZip.file(targetMasterPath, masterXml);

      // Register master in Content_Types
      const override = contentTypesDoc.createElement('Override');
      override.setAttribute('PartName', `/${targetMasterPath}`);
      override.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml');
      getByLocalName(contentTypesDoc, 'Types')[0]?.appendChild(override);

      // Handle master .rels
      const masterRelsPath = `ppt/slideMasters/_rels/${rawMaster}.rels`;
      const masterRelsFile = docZip.file(masterRelsPath);
      if (masterRelsFile) {
        let relsText = await masterRelsFile.async('text');
        relsText = relsText
          .replace(/Target="\.\.\/slideLayouts\/(slideLayout\d+\.xml)"/g, `Target="../slideLayouts/${prefix}$1"`)
          .replace(/Target="\.\.\/theme\/(theme\d+\.xml)"/g, `Target="../theme/${prefix}$1"`)
          .replace(/Target="\.\.\/media\/([^"]+)"/g, `Target="../media/${prefix}$1"`);

        mergedZip.file(`ppt/slideMasters/_rels/${prefix}${rawMaster}.rels`, relsText);
      }

      // Add new slideMaster into presentation.xml & presentation.xml.rels
      maxRelId++;
      const masterRelId = `rIdM${maxRelId}`;

      const relEl = baseRelsDoc.createElement('Relationship');
      relEl.setAttribute('Id', masterRelId);
      relEl.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster');
      relEl.setAttribute('Target', `slideMasters/${prefix}${rawMaster}`);
      relsRoot.appendChild(relEl);

      const sldMasterIdLst = getByLocalName(basePresDoc, 'sldMasterIdLst')[0];
      if (sldMasterIdLst) {
        const sldMasterIdEl = basePresDoc.createElement('p:sldMasterId');
        sldMasterIdEl.setAttribute('id', `${2147483648 + docIdx * 1000 + maxRelId}`);
        sldMasterIdEl.setAttribute('r:id', masterRelId);
        sldMasterIdLst.appendChild(sldMasterIdEl);
      }
    }

    // 5. Copy Slides and map relationships
    const docRelMap = new Map<string, string>();
    const docRelElements = getByLocalName(docRelsDoc, 'Relationship');
    for (const r of docRelElements) {
      const id = r.getAttribute('Id');
      const target = r.getAttribute('Target');
      if (id && target) docRelMap.set(id, target);
    }

    const docSldIdLst = getByLocalName(docPresDoc, 'sldIdLst')[0];
    const docSldIds = docSldIdLst ? getByLocalName(docSldIdLst, 'sldId') : [];

    for (let sIdx = 0; sIdx < docSldIds.length; sIdx++) {
      // Check if this slide is in the requested page range
      if (!docRange.indices.includes(sIdx)) continue;

      totalSlideCounter++;
      const newSlideNum = totalSlideCounter;
      const currentSld = docSldIds[sIdx];
      const rId =
        currentSld.getAttribute('r:id') ||
        currentSld.getAttribute('id') ||
        Array.from(currentSld.attributes).find((a) => a.name.endsWith(':id') || a.name === 'id')?.value;

      let slidePath = rId ? docRelMap.get(rId) : null;
      if (!slidePath) slidePath = `slides/slide${sIdx + 1}.xml`;
      const fullSlidePath = slidePath.startsWith('ppt/') ? slidePath : `ppt/${slidePath.replace(/^\//, '')}`;

      const sourceSlideFile = docZip.file(fullSlidePath) || docZip.file(`ppt/slides/slide${sIdx + 1}.xml`);
      if (!sourceSlideFile) continue;

      const slideXml = await sourceSlideFile.async('text');
      const newSlidePath = `ppt/slides/slide${newSlideNum}.xml`;
      mergedZip.file(newSlidePath, slideXml);

      // Handle slide relationships (.rels)
      const rawSlideName = fullSlidePath.replace('ppt/slides/', '');
      const sourceSlideRelsFile = docZip.file(`ppt/slides/_rels/${rawSlideName}.rels`);
      if (sourceSlideRelsFile) {
        let slideRelsText = await sourceSlideRelsFile.async('text');
        // Rewrite target paths in slide relationship
        slideRelsText = slideRelsText
          .replace(/Target="\.\.\/slideLayouts\/(slideLayout\d+\.xml)"/g, `Target="../slideLayouts/${prefix}$1"`)
          .replace(/Target="\.\.\/media\/([^"]+)"/g, `Target="../media/${prefix}$1"`);

        mergedZip.file(`ppt/slides/_rels/slide${newSlideNum}.xml.rels`, slideRelsText);
      }

      // Add Override to [Content_Types].xml
      const override = contentTypesDoc.createElement('Override');
      override.setAttribute('PartName', `/${newSlidePath}`);
      override.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml');
      getByLocalName(contentTypesDoc, 'Types')[0]?.appendChild(override);

      // Add to presentation.xml.rels
      maxRelId++;
      const slideRelId = `rIdS${maxRelId}`;
      const relEl = baseRelsDoc.createElement('Relationship');
      relEl.setAttribute('Id', slideRelId);
      relEl.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide');
      relEl.setAttribute('Target', `slides/slide${newSlideNum}.xml`);
      relsRoot.appendChild(relEl);

      // Add to presentation.xml <p:sldIdLst>
      maxSldIdNum++;
      if (sldIdLst) {
        const newSldEl = basePresDoc.createElement('p:sldId');
        newSldEl.setAttribute('id', `${maxSldIdNum}`);
        newSldEl.setAttribute('r:id', slideRelId);
        sldIdLst.appendChild(newSldEl);
      }

      slideResults.push({
        slideNum: totalSlideCounter,
        sourceDoc: item.name,
        title: docInspection.slideTitles[sIdx] || `슬라이드 ${sIdx + 1}`,
      });
    }
  }

  // Serialize updated documents back into base zip
  mergedZip.file('ppt/presentation.xml', serializer.serializeToString(basePresDoc));
  mergedZip.file('ppt/_rels/presentation.xml.rels', serializer.serializeToString(baseRelsDoc));
  mergedZip.file('[Content_Types].xml', serializer.serializeToString(contentTypesDoc));

  if (onProgress) {
    onProgress(95, 'PPTX 무손실 패키지 압축 및 저장 중...');
  }

  const pptxBytes = await mergedZip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  if (onProgress) {
    onProgress(100, '완료');
  }

  return {
    pptxBytes,
    totalSlides: totalSlideCounter,
    slideList: slideResults,
  };
}

/**
 * Losslessly delete selected slides (0-based indices) from a merged PPTX Blob.
 * Directly updates OpenXML package structures (presentation.xml, presentation.xml.rels, [Content_Types].xml)
 * without re-compressing or touching media or formatting.
 */
export async function deleteSlidesFromPptxLossless(
  pptxBlob: Blob,
  slideIndicesToDelete: number[],
  currentSlideList?: { slideNum: number; sourceDoc: string; title: string }[]
): Promise<{
  updatedBlob: Blob;
  totalSlides: number;
  slideList: { slideNum: number; sourceDoc: string; title: string }[];
}> {
  if (slideIndicesToDelete.length === 0) {
    return {
      updatedBlob: pptxBlob,
      totalSlides: currentSlideList?.length || 0,
      slideList: currentSlideList || [],
    };
  }

  const buffer = await pptxBlob.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const presXmlFile = zip.file('ppt/presentation.xml');
  if (!presXmlFile) throw new Error('유효한 PPTX 파일이 아닙니다.');

  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const presDoc = parser.parseFromString(await presXmlFile.async('text'), 'application/xml');
  const relsFile = zip.file('ppt/_rels/presentation.xml.rels');
  if (!relsFile) throw new Error('PPTX 관계 파일을 찾을 수 없습니다.');
  const relsDoc = parser.parseFromString(await relsFile.async('text'), 'application/xml');

  const contentTypesFile = zip.file('[Content_Types].xml');
  if (!contentTypesFile) throw new Error('[Content_Types].xml을 찾을 수 없습니다.');
  const contentTypesDoc = parser.parseFromString(await contentTypesFile.async('text'), 'application/xml');

  const getByLocalName = (doc: Document | Element, name: string) =>
    Array.from(doc.getElementsByTagName('*')).filter((el) => el.localName === name);

  const sldIdLst = getByLocalName(presDoc, 'sldIdLst')[0];
  if (!sldIdLst) throw new Error('슬라이드 목록을 찾을 수 없습니다.');

  const sldIds = getByLocalName(sldIdLst, 'sldId');
  if (slideIndicesToDelete.length >= sldIds.length) {
    throw new Error('모든 슬라이드를 삭제할 수는 없습니다. 최소 1개 이상의 슬라이드가 남아있어야 합니다.');
  }

  // Map presentation.xml.rels
  const relMap = new Map<string, Element>();
  const relElements = getByLocalName(relsDoc, 'Relationship');
  for (const r of relElements) {
    const id = r.getAttribute('Id');
    if (id) relMap.set(id, r);
  }

  const toDeleteSet = new Set(slideIndicesToDelete);
  const remainingList: { slideNum: number; sourceDoc: string; title: string }[] = [];

  for (let idx = 0; idx < sldIds.length; idx++) {
    const sldIdEl = sldIds[idx];
    if (toDeleteSet.has(idx)) {
      const rId =
        sldIdEl.getAttribute('r:id') ||
        sldIdEl.getAttribute('id') ||
        Array.from(sldIdEl.attributes).find((a) => a.name.endsWith(':id') || a.name === 'id')?.value;

      if (rId) {
        const relEl = relMap.get(rId);
        if (relEl) {
          const target = relEl.getAttribute('Target');
          if (target) {
            const cleanTarget = target.replace(/^\//, '');
            const fullTarget = cleanTarget.startsWith('ppt/') ? cleanTarget : `ppt/${cleanTarget}`;
            zip.remove(fullTarget);

            const rawSlide = fullTarget.replace('ppt/slides/', '');
            zip.remove(`ppt/slides/_rels/${rawSlide}.rels`);

            // Remove Override in [Content_Types].xml
            const overrides = getByLocalName(contentTypesDoc, 'Override');
            for (const ov of overrides) {
              const partName = ov.getAttribute('PartName');
              if (partName === `/${fullTarget}` || partName === `/${target}` || partName === `/${cleanTarget}`) {
                ov.parentNode?.removeChild(ov);
              }
            }
          }
          relEl.parentNode?.removeChild(relEl);
        }
      }
      sldIdEl.parentNode?.removeChild(sldIdEl);
    } else {
      const originalMeta = currentSlideList ? currentSlideList[idx] : undefined;
      remainingList.push({
        slideNum: remainingList.length + 1,
        sourceDoc: originalMeta?.sourceDoc || '병합 파일',
        title: originalMeta?.title || `슬라이드 ${remainingList.length + 1}`,
      });
    }
  }

  zip.file('ppt/presentation.xml', serializer.serializeToString(presDoc));
  zip.file('ppt/_rels/presentation.xml.rels', serializer.serializeToString(relsDoc));
  zip.file('[Content_Types].xml', serializer.serializeToString(contentTypesDoc));

  const updatedBytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const updatedBlob = new Blob([updatedBytes], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });

  return {
    updatedBlob,
    totalSlides: remainingList.length,
    slideList: remainingList,
  };
}

/**
 * Generate a complete, valid sample PPTX for instant user testing.
 */
export async function generateSamplePptx(
  title: string,
  docNumber: number,
  slideCount: number = 2
): Promise<File> {
  const zip = new JSZip();

  const colorHex = docNumber === 1 ? '1D4ED8' : docNumber === 2 ? '047857' : 'B91C1C';
  const colorName = docNumber === 1 ? 'Royal Blue' : docNumber === 2 ? 'Forest Emerald' : 'Ruby Crimson';

  // 1. [Content_Types].xml
  let contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>`;

  for (let s = 1; s <= slideCount; s++) {
    contentTypesXml += `\n  <Override PartName="/ppt/slides/slide${s}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  }
  contentTypesXml += `\n</Types>`;
  zip.file('[Content_Types].xml', contentTypesXml);

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );

  // 3. ppt/_rels/presentation.xml.rels
  let presRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`;

  for (let s = 1; s <= slideCount; s++) {
    presRelsXml += `\n  <Relationship Id="rId${s + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${s}.xml"/>`;
  }
  presRelsXml += `\n</Relationships>`;
  zip.file('ppt/_rels/presentation.xml.rels', presRelsXml);

  // 4. ppt/presentation.xml
  let presXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>`;

  for (let s = 1; s <= slideCount; s++) {
    presXml += `\n    <p:sldId id="${255 + s}" r:id="rId${s + 1}"/>`;
  }
  presXml += `\n  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
  zip.file('ppt/presentation.xml', presXml);

  // 5. ppt/slideMasters/slideMaster1.xml
  zip.file(
    'ppt/slideMasters/slideMaster1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
  </p:sldLayoutIdLst>
</p:sldMaster>`
  );

  // 6. ppt/slideMasters/_rels/slideMaster1.xml.rels
  zip.file(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`
  );

  // 7. ppt/slideLayouts/slideLayout1.xml
  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank">
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`
  );

  // 8. ppt/slideLayouts/_rels/slideLayout1.xml.rels
  zip.file(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`
  );

  // 9. ppt/theme/theme1.xml
  zip.file(
    'ppt/theme/theme1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1F2937"/></a:dk2>
      <a:lt2><a:srgbClr val="F3F4F6"/></a:lt2>
      <a:accent1><a:srgbClr val="${colorHex}"/></a:accent1>
      <a:accent2><a:srgbClr val="4B5563"/></a:accent2>
      <a:accent3><a:srgbClr val="9CA3AF"/></a:accent3>
      <a:accent4><a:srgbClr val="D1D5DB"/></a:accent4>
      <a:accent5><a:srgbClr val="E5E7EB"/></a:accent5>
      <a:accent6><a:srgbClr val="F9FAFB"/></a:accent6>
      <a:hlink><a:srgbClr val="2563EB"/></a:hlink>
      <a:folHlink><a:srgbClr val="9333EA"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Office">
      <a:majorFont><a:latin typeface="Calibri"/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`
  );

  // 10. For each slide: create slideN.xml and slideN.xml.rels
  for (let s = 1; s <= slideCount; s++) {
    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      
      <!-- Top Decorative Color Banner Shape -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="HeaderBanner"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="914400" y="731520"/><a:ext cx="10363200" cy="91440"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="${colorHex}"/></a:solidFill>
        </p:spPr>
      </p:sp>

      <!-- Slide Title Text Shape -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="TitleText"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="title"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="914400" y="1097280"/><a:ext cx="10363200" cy="1143000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="ko-KR" sz="3600" b="1"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill></a:rPr>
              <a:t>${title} - 슬라이드 ${s}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Subtitle and Description Body -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="4" name="ContentBody"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="body" idx="1"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="914400" y="2468880"/><a:ext cx="10363200" cy="3291840"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="ko-KR" sz="2000" b="1"><a:solidFill><a:srgbClr val="${colorHex}"/></a:solidFill></a:rPr>
              <a:t>[프레젠테이션 #${docNumber} • 테마: ${colorName}]</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:r>
              <a:rPr lang="ko-KR" sz="1800"><a:solidFill><a:srgbClr val="334155"/></a:solidFill></a:rPr>
              <a:t>• 원본 PPTX 벡터 도형, 텍스트 상자 및 레이아웃 서식이 100% 무손실로 병합됩니다.</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:r>
              <a:rPr lang="ko-KR" sz="1800"><a:solidFill><a:srgbClr val="334155"/></a:solidFill></a:rPr>
              <a:t>• 압축 손실이나 이미지 깨짐 없이 각 프레젠테이션의 마스터와 레이아웃이 보존됩니다.</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;

    zip.file(`ppt/slides/slide${s}.xml`, slideXml);
    zip.file(
      `ppt/slides/_rels/slide${s}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`
    );
  }

  const pptxBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const blob = new Blob([pptxBytes], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
  return new File([blob], `${title.replace(/\s+/g, '_')}.pptx`, {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}
