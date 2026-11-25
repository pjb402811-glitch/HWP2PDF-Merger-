import React, { useState, useEffect } from 'react';
import {
  AppMode,
  DocumentItem,
  HwpBatchResult,
  HwpConvertedItem,
  HwpFileItem,
  HwpOutputMode,
  HwpQualityPreset,
  MergeFormat,
  MergeResult,
} from './types';
import { Header } from './components/Header';
import { QualityGuaranteeBanner } from './components/QualityGuaranteeBanner';
import { DropZone } from './components/DropZone';
import { FileList } from './components/FileList';
import { MergeControls } from './components/MergeControls';
import { PreviewModal } from './components/PreviewModal';
import { HwpFileList } from './components/HwpFileList';
import { HwpControls } from './components/HwpControls';
import { HwpResultModal } from './components/HwpResultModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  inspectPdf,
  mergePdfsLossless,
  deletePagesFromPdfLossless,
  generateSamplePdf,
} from './utils/pdfMerger';
import {
  inspectPptx,
  mergePptxLossless,
  deleteSlidesFromPptxLossless,
  generateSamplePptx,
} from './utils/pptxMerger';
import {
  MAX_HWP_BATCH_FILES,
  inspectHwp,
  convertHwpBatchToIndividualPdfs,
  convertHwpBatchAndMergePdf,
  generateSampleHwp,
} from './utils/hwpConverter';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

export default function App() {
  const [currentFormat, setCurrentFormat] = useState<AppMode>('pdf');
  const [pdfFiles, setPdfFiles] = useState<DocumentItem[]>([]);
  const [pptxFiles, setPptxFiles] = useState<DocumentItem[]>([]);
  const [hwpFiles, setHwpFiles] = useState<HwpFileItem[]>([]);

  const [pdfOutputFileName, setPdfOutputFileName] = useState<string>('병합문서_merged');
  const [pptxOutputFileName, setPptxOutputFileName] = useState<string>('병합프레젠테이션_merged');

  const [hwpOutputMode, setHwpOutputMode] = useState<HwpOutputMode>('individual');
  const [hwpQuality, setHwpQuality] = useState<HwpQualityPreset>('high');
  const [hwpMergedFileName, setHwpMergedFileName] = useState<string>('한글변환_통합문서');

  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [isAddingSamples, setIsAddingSamples] = useState<boolean>(false);

  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [hwpBatchResult, setHwpBatchResult] = useState<HwpBatchResult | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const isMergeMode = currentFormat === 'pdf' || currentFormat === 'pptx';
  const activeMergeFormat: MergeFormat = currentFormat === 'pptx' ? 'pptx' : 'pdf';
  const activeMergeFiles = currentFormat === 'pdf' ? pdfFiles : pptxFiles;
  const activeFileCount = currentFormat === 'hwp' ? hwpFiles.length : activeMergeFiles.length;

  const setActiveMergeFiles = (
    updater: DocumentItem[] | ((prev: DocumentItem[]) => DocumentItem[])
  ) => {
    if (currentFormat === 'pdf') {
      setPdfFiles(updater);
    } else if (currentFormat === 'pptx') {
      setPptxFiles(updater);
    }
  };

  const outputFileName = currentFormat === 'pdf' ? pdfOutputFileName : pptxOutputFileName;
  const setOutputFileName = (name: string) => {
    if (currentFormat === 'pdf') {
      setPdfOutputFileName(name);
    } else {
      setPptxOutputFileName(name);
    }
  };

  // Auto-hide toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
  };

  // Process incoming files for PDF / PPTX / HWP
  const handleFilesSelected = async (
    newFiles: File[],
    targetMode: AppMode = currentFormat
  ) => {
    if (targetMode === 'hwp') {
      const remaining = MAX_HWP_BATCH_FILES - hwpFiles.length;
      if (remaining <= 0) {
        showToast(
          'error',
          `한 번에 최대 ${MAX_HWP_BATCH_FILES}개까지만 변환할 수 있습니다. 기존 목록을 정리한 뒤 추가해 주세요.`
        );
        return;
      }

      const filesToLoad = newFiles.slice(0, remaining);
      const skippedCount = newFiles.length - filesToLoad.length;
      const loadedHwpItems: HwpFileItem[] = [];

      for (const file of filesToLoad) {
        const ext = file.name.toLowerCase().endsWith('.hwpx') ? 'hwpx' : 'hwp';
        try {
          const { pageCount, needsPassword } = await inspectHwp(file);
          loadedHwpItems.push({
            id: `hwp-${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            name: file.name,
            ext,
            size: file.size,
            pageCount,
            status: needsPassword ? 'needs-password' : 'ready',
            needsPassword,
          });
        } catch (err) {
          console.error('HWP 로드 실패:', err);
          showToast(
            'error',
            `"${file.name}" 파일을 읽는 중 오류가 발생했습니다. 손상된 파일인지 확인해 주세요.`
          );
        }
      }

      if (loadedHwpItems.length > 0) {
        setHwpFiles((prev) => [...prev, ...loadedHwpItems].slice(0, MAX_HWP_BATCH_FILES));
        if (skippedCount > 0) {
          showToast(
            'info',
            `최대 ${MAX_HWP_BATCH_FILES}개 제한으로 ${loadedHwpItems.length}개만 추가되었습니다. (${skippedCount}개 제외)`
          );
        } else {
          showToast('success', `${loadedHwpItems.length}개의 한글 파일이 추가되었습니다.`);
        }
      }
      return;
    }

    const targetFormat: MergeFormat = targetMode;
    const newItems: DocumentItem[] = [];

    for (const file of newFiles) {
      try {
        if (targetFormat === 'pdf') {
          const { pageCount } = await inspectPdf(file);
          newItems.push({
            id: `pdf-${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            name: file.name,
            size: file.size,
            pageCount,
            pageRange: 'all',
            isValidRange: true,
            status: 'ready',
            format: 'pdf',
          });
        } else {
          const { slideCount, slideTitles } = await inspectPptx(file);
          newItems.push({
            id: `pptx-${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            name: file.name,
            size: file.size,
            pageCount: slideCount,
            pageRange: 'all',
            isValidRange: true,
            status: 'ready',
            slideTitles,
            format: 'pptx',
          });
        }
      } catch (err) {
        console.error(`${targetFormat.toUpperCase()} 로드 실패:`, err);
        showToast(
          'error',
          `"${file.name}" 파일을 읽는 중 오류가 발생했습니다. 손상되었거나 암호화된 파일인지 확인하세요.`
        );
      }
    }

    if (newItems.length > 0) {
      if (targetFormat === 'pdf') {
        setPdfFiles((prev) => [...prev, ...newItems]);
      } else {
        setPptxFiles((prev) => [...prev, ...newItems]);
      }
      showToast('success', `${newItems.length}개의 ${targetFormat.toUpperCase()} 파일이 추가되었습니다.`);
    }
  };

  // Format mismatch auto-handler
  const handleFormatMismatch = (detectedFormat: AppMode, files: File[]) => {
    setCurrentFormat(detectedFormat);
    handleFilesSelected(files, detectedFormat);
    const label =
      detectedFormat === 'hwp'
        ? '한글(HWP/HWPX) → PDF'
        : `${detectedFormat.toUpperCase()} 병합`;
    showToast('info', `파일 형식이 감지되어 '${label}' 모드로 자동 전환되었습니다.`);
  };

  // Add 3 instant sample files
  const handleAddSamples = async () => {
    setIsAddingSamples(true);
    try {
      if (currentFormat === 'pdf') {
        const sample1 = await generateSamplePdf('보고서_1분기_결과', 1, 3);
        const sample2 = await generateSamplePdf('기획서_신규사업안', 2, 2);
        const sample3 = await generateSamplePdf('부록_기술명세서', 3, 4);
        await handleFilesSelected([sample1, sample2, sample3], 'pdf');
        showToast('info', '테스트를 위한 3개의 샘플 PDF가 추가되었습니다.');
      } else if (currentFormat === 'pptx') {
        const sample1 = await generateSamplePptx('회사소개_IR자료', 1, 3);
        const sample2 = await generateSamplePptx('마케팅_캠페인전략', 2, 2);
        const sample3 = await generateSamplePptx('제품기능_로드맵', 3, 2);
        await handleFilesSelected([sample1, sample2, sample3], 'pptx');
        showToast('info', '테스트를 위한 3개의 샘플 PPTX 프레젠테이션이 추가되었습니다.');
      } else {
        const sample1 = await generateSampleHwp('업무보고서_1분기', 1);
        const sample2 = await generateSampleHwp('사업기획안_요약', 2);
        const sample3 = await generateSampleHwp('회의록_정리본', 3);
        await handleFilesSelected([sample1, sample2, sample3], 'hwp');
        showToast('info', '테스트를 위한 3개의 샘플 한글(HWP) 문서가 추가되었습니다.');
      }
    } catch (err) {
      console.error('샘플 생성 오류:', err);
      showToast('error', '샘플 파일을 생성하는 중 오류가 발생했습니다.');
    } finally {
      setIsAddingSamples(false);
    }
  };

  // Reordering & Sorting for PDF / PPTX
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setActiveMergeFiles((prev) => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === activeMergeFiles.length - 1) return;
    setActiveMergeFiles((prev) => {
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleRemove = (id: string) => {
    setActiveMergeFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearAll = () => {
    setActiveMergeFiles([]);
    showToast('info', '파일 목록을 모두 비웠습니다.');
  };

  const handleSortByName = (ascending: boolean = true) => {
    setActiveMergeFiles((prev) =>
      [...prev].sort((a, b) =>
        ascending ? a.name.localeCompare(b.name, 'ko') : b.name.localeCompare(a.name, 'ko')
      )
    );
  };

  const handleSortBySize = () => {
    setActiveMergeFiles((prev) => [...prev].sort((a, b) => b.size - a.size));
  };

  const handleReverseOrder = () => {
    setActiveMergeFiles((prev) => [...prev].reverse());
  };

  const handleUpdateRange = (id: string, range: string, isValid: boolean) => {
    setActiveMergeFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, pageRange: range, isValidRange: isValid } : f))
    );
  };

  // Reordering & Sorting for HWP
  const handleHwpMoveUp = (index: number) => {
    if (index === 0) return;
    setHwpFiles((prev) => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleHwpMoveDown = (index: number) => {
    if (index === hwpFiles.length - 1) return;
    setHwpFiles((prev) => {
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleHwpRemove = (id: string) => {
    setHwpFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleHwpClearAll = () => {
    setHwpFiles([]);
    showToast('info', '한글 파일 목록을 모두 비웠습니다.');
  };

  const handleHwpSortByName = (ascending: boolean = true) => {
    setHwpFiles((prev) =>
      [...prev].sort((a, b) =>
        ascending ? a.name.localeCompare(b.name, 'ko') : b.name.localeCompare(a.name, 'ko')
      )
    );
  };

  const handleHwpSortBySize = () => {
    setHwpFiles((prev) => [...prev].sort((a, b) => b.size - a.size));
  };

  const handleHwpReverseOrder = () => {
    setHwpFiles((prev) => [...prev].reverse());
  };

  const handleUnlockHwpPassword = async (id: string, password: string) => {
    const target = hwpFiles.find((f) => f.id === id);
    if (!target) return;

    try {
      const { pageCount } = await inspectHwp(target.file, password);
      setHwpFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                pageCount,
                password,
                needsPassword: false,
                status: 'ready',
                errorMessage: undefined,
              }
            : f
        )
      );
      showToast('success', `"${target.name}" 문서의 잠금이 해제되었습니다.`);
    } catch (err: any) {
      const msg = err?.message || '비밀번호가 일치하지 않습니다.';
      setHwpFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, errorMessage: msg } : f))
      );
      showToast('error', msg);
    }
  };

  // Merge Action (PDF / PPTX)
  const handleMerge = async () => {
    if (!isMergeMode) return;

    if (activeMergeFiles.length < 2) {
      showToast(
        'error',
        `병합하려면 최소 2개 이상의 ${activeMergeFormat.toUpperCase()} 파일이 필요합니다.`
      );
      return;
    }

    const invalidItem = activeMergeFiles.find((f) => !f.isValidRange);
    if (invalidItem) {
      showToast('error', `"${invalidItem.name}"의 지정 범위가 올바르지 않습니다.`);
      return;
    }

    setIsMerging(true);
    setProgressPercent(0);
    setCurrentStep('병합 준비 중...');

    const startTime = performance.now();
    const originalTotalSize = activeMergeFiles.reduce((sum, f) => sum + f.size, 0);

    try {
      if (activeMergeFormat === 'pdf') {
        const { pdfBytes, totalPages, pageList } = await mergePdfsLossless(
          activeMergeFiles,
          (progress, item) => {
            setProgressPercent(progress);
            setCurrentStep(item);
          }
        );

        const endTime = performance.now();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const cleanFileName = outputFileName.trim()
          ? outputFileName.trim().replace(/\.pdf$/i, '') + '.pdf'
          : 'merged_document.pdf';

        setMergeResult({
          blob,
          url,
          fileName: cleanFileName,
          totalSize: blob.size,
          totalPages,
          originalTotalSize,
          processingTimeMs: Math.round(endTime - startTime),
          format: 'pdf',
          pageList,
          initialBlob: blob,
          initialTotalPages: totalPages,
          initialPageList: pageList,
          deletedCount: 0,
        });
      } else {
        const { pptxBytes, totalSlides, slideList } = await mergePptxLossless(
          activeMergeFiles,
          (progress, item) => {
            setProgressPercent(progress);
            setCurrentStep(item);
          }
        );

        const endTime = performance.now();
        const blob = new Blob([pptxBytes], {
          type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        });
        const url = URL.createObjectURL(blob);

        const cleanFileName = outputFileName.trim()
          ? outputFileName.trim().replace(/\.pptx$/i, '') + '.pptx'
          : 'merged_presentation.pptx';

        setMergeResult({
          blob,
          url,
          fileName: cleanFileName,
          totalSize: blob.size,
          totalPages: totalSlides,
          originalTotalSize,
          processingTimeMs: Math.round(endTime - startTime),
          format: 'pptx',
          slideTitles: slideList,
          initialBlob: blob,
          initialTotalPages: totalSlides,
          initialSlideTitles: slideList,
          deletedCount: 0,
        });
      }

      showToast(
        'success',
        `${activeMergeFormat.toUpperCase()} 무손실 병합이 성공적으로 완료되었습니다!`
      );
    } catch (err) {
      console.error('병합 실패:', err);
      showToast('error', '병합 작업 중 오류가 발생했습니다. 파일 형식을 다시 확인해 주세요.');
    } finally {
      setIsMerging(false);
    }
  };

  // Convert HWP/HWPX -> PDF Action
  const handleConvertHwp = async () => {
    if (hwpFiles.length === 0) {
      showToast('error', '변환할 한글(.hwp / .hwpx) 파일을 먼저 추가해 주세요.');
      return;
    }

    if (hwpFiles.some((f) => f.needsPassword)) {
      showToast('error', '암호화된 한글 문서의 비밀번호를 먼저 입력해 주세요.');
      return;
    }

    setIsMerging(true);
    setProgressPercent(0);
    setCurrentStep('한글 WASM 변환 엔진 초기화 중...');

    const startTime = performance.now();
    const totalSourceSize = hwpFiles.reduce((sum, f) => sum + f.size, 0);

    try {
      if (hwpOutputMode === 'individual') {
        const items = await convertHwpBatchToIndividualPdfs(
          hwpFiles,
          hwpQuality,
          (percent, step) => {
            setProgressPercent(percent);
            setCurrentStep(step);
          }
        );

        const endTime = performance.now();
        const totalPages = items.reduce((sum, it) => sum + it.pageCount, 0);
        const totalOutputSize = items.reduce((sum, it) => sum + it.size, 0);

        setHwpBatchResult({
          outputMode: 'individual',
          items,
          totalFiles: items.length,
          totalPages,
          totalSourceSize,
          totalOutputSize,
          processingTimeMs: Math.round(endTime - startTime),
          quality: hwpQuality,
        });
        showToast('success', `${items.length}개의 한글 파일이 PDF로 변환되었습니다!`);
      } else {
        const { pdfBytes, totalPages, pageList, convertedItems } =
          await convertHwpBatchAndMergePdf(hwpFiles, hwpQuality, (percent, step) => {
            setProgressPercent(percent);
            setCurrentStep(step);
          });

        // Clean up intermediate per-file object URLs since we return a single merged PDF
        convertedItems.forEach((it) => URL.revokeObjectURL(it.url));

        const endTime = performance.now();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const cleanFileName = hwpMergedFileName.trim()
          ? hwpMergedFileName.trim().replace(/\.pdf$/i, '') + '.pdf'
          : '한글변환_통합문서.pdf';

        setMergeResult({
          blob,
          url,
          fileName: cleanFileName,
          totalSize: blob.size,
          totalPages,
          originalTotalSize: totalSourceSize,
          processingTimeMs: Math.round(endTime - startTime),
          format: 'pdf',
          pageList,
          initialBlob: blob,
          initialTotalPages: totalPages,
          initialPageList: pageList,
          deletedCount: 0,
        });

        showToast(
          'success',
          `${hwpFiles.length}개 한글 파일이 1개의 PDF(${totalPages}페이지)로 변환·병합되었습니다!`
        );
      }
    } catch (err: any) {
      console.error('한글 PDF 변환 실패:', err);
      showToast(
        'error',
        err?.message || '한글 문서를 PDF로 변환하는 중 오류가 발생했습니다.'
      );
    } finally {
      setIsMerging(false);
    }
  };

  // Send converted individual PDFs directly to PDF Merger tab
  const handleSendConvertedToPdfMerger = async (items: HwpConvertedItem[]) => {
    const convertedFiles = items.map(
      (it) => new File([it.blob], it.pdfFileName, { type: 'application/pdf' })
    );

    // Revoke batch result URLs before closing
    if (hwpBatchResult) {
      hwpBatchResult.items.forEach((it) => URL.revokeObjectURL(it.url));
      setHwpBatchResult(null);
    }

    setCurrentFormat('pdf');
    await handleFilesSelected(convertedFiles, 'pdf');
    showToast(
      'info',
      `변환된 ${convertedFiles.length}개의 PDF가 'PDF 병합' 목록에 추가되었습니다.`
    );
  };

  // Delete selected pages / slides from the merged document
  const handleDeleteMergedPages = async (indicesToDelete: number[]) => {
    if (!mergeResult || indicesToDelete.length === 0) return;

    try {
      if (mergeResult.format === 'pdf') {
        const { updatedBlob, totalPages, updatedPageList } = await deletePagesFromPdfLossless(
          mergeResult.blob,
          indicesToDelete,
          mergeResult.pageList
        );

        if (mergeResult.url) {
          URL.revokeObjectURL(mergeResult.url);
        }
        const newUrl = URL.createObjectURL(updatedBlob);
        const newDeletedCount = (mergeResult.deletedCount || 0) + indicesToDelete.length;

        setMergeResult((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            blob: updatedBlob,
            url: newUrl,
            totalSize: updatedBlob.size,
            totalPages,
            pageList: updatedPageList,
            deletedCount: newDeletedCount,
          };
        });
        showToast('success', `${indicesToDelete.length}개 페이지가 무손실로 삭제되었습니다.`);
      } else {
        const { updatedBlob, totalSlides, slideList } = await deleteSlidesFromPptxLossless(
          mergeResult.blob,
          indicesToDelete,
          mergeResult.slideTitles
        );

        if (mergeResult.url) {
          URL.revokeObjectURL(mergeResult.url);
        }
        const newUrl = URL.createObjectURL(updatedBlob);
        const newDeletedCount = (mergeResult.deletedCount || 0) + indicesToDelete.length;

        setMergeResult((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            blob: updatedBlob,
            url: newUrl,
            totalSize: updatedBlob.size,
            totalPages: totalSlides,
            slideTitles: slideList,
            deletedCount: newDeletedCount,
          };
        });
        showToast('success', `${indicesToDelete.length}개 슬라이드가 무손실로 삭제되었습니다.`);
      }
    } catch (err: any) {
      console.error('삭제 처리 실패:', err);
      showToast('error', err.message || '페이지 삭제 중 오류가 발생했습니다.');
      throw err;
    }
  };

  // Restore original merged document
  const handleRestoreOriginalMerged = () => {
    if (!mergeResult || !mergeResult.initialBlob) return;

    if (mergeResult.url) {
      URL.revokeObjectURL(mergeResult.url);
    }
    const newUrl = URL.createObjectURL(mergeResult.initialBlob);

    setMergeResult((prev) => {
      if (!prev || !prev.initialBlob) return null;
      return {
        ...prev,
        blob: prev.initialBlob,
        url: newUrl,
        totalSize: prev.initialBlob.size,
        totalPages: prev.initialTotalPages || prev.totalPages,
        pageList: prev.initialPageList,
        slideTitles: prev.initialSlideTitles,
        deletedCount: 0,
      };
    });
    showToast('info', '초기 병합본으로 전체 복원되었습니다.');
  };

  const handleCloseModal = () => {
    if (mergeResult?.url) {
      URL.revokeObjectURL(mergeResult.url);
    }
    setMergeResult(null);
  };

  const handleResetAll = () => {
    if (mergeResult?.url) {
      URL.revokeObjectURL(mergeResult.url);
    }
    setMergeResult(null);
    if (currentFormat === 'hwp') {
      setHwpFiles([]);
    } else {
      setActiveMergeFiles([]);
    }
  };

  const handleCloseHwpResultModal = () => {
    if (hwpBatchResult) {
      hwpBatchResult.items.forEach((it) => URL.revokeObjectURL(it.url));
    }
    setHwpBatchResult(null);
  };

  const handleResetAllHwp = () => {
    handleCloseHwpResultModal();
    setHwpFiles([]);
  };

  const triggerUploadClick = () => {
    const input = document.getElementById('document-file-input') as HTMLInputElement | null;
    if (input) {
      input.click();
    }
  };

  const hasInvalidRanges = activeMergeFiles.some((f) => !f.isValidRange);
  const hasLockedHwpFiles = hwpFiles.some((f) => f.needsPassword);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header with Format Switcher */}
      <Header
        currentFormat={currentFormat}
        onChangeFormat={setCurrentFormat}
        onAddSamples={handleAddSamples}
        isAddingSamples={isAddingSamples}
        fileCount={activeFileCount}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">
        {/* Quality Guarantee Card tailored to mode */}
        <QualityGuaranteeBanner format={currentFormat} />

        {/* Drop Zone */}
        <DropZone
          format={currentFormat}
          onFilesSelected={(files) => handleFilesSelected(files, currentFormat)}
          onAddSamples={handleAddSamples}
          isAddingSamples={isAddingSamples}
          hasFiles={activeFileCount > 0}
          onFormatMismatch={handleFormatMismatch}
          maxFiles={currentFormat === 'hwp' ? MAX_HWP_BATCH_FILES : undefined}
          currentFileCount={currentFormat === 'hwp' ? hwpFiles.length : undefined}
        />

        {/* PDF / PPTX Merge File List & Controls */}
        {isMergeMode && activeMergeFiles.length > 0 && (
          <>
            <FileList
              format={activeMergeFormat}
              files={activeMergeFiles}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onRemove={handleRemove}
              onUpdateRange={handleUpdateRange}
              onClearAll={handleClearAll}
              onSortByName={handleSortByName}
              onSortBySize={handleSortBySize}
              onReverseOrder={handleReverseOrder}
              onOpenUpload={triggerUploadClick}
            />

            <MergeControls
              format={activeMergeFormat}
              outputFileName={outputFileName}
              onChangeOutputFileName={setOutputFileName}
              onMerge={handleMerge}
              isMerging={isMerging}
              progressPercent={progressPercent}
              currentStep={currentStep}
              filesCount={activeMergeFiles.length}
              hasInvalidRanges={hasInvalidRanges}
            />
          </>
        )}

        {/* HWP / HWPX -> PDF File List & Controls */}
        {currentFormat === 'hwp' && hwpFiles.length > 0 && (
          <>
            <HwpFileList
              files={hwpFiles}
              onMoveUp={handleHwpMoveUp}
              onMoveDown={handleHwpMoveDown}
              onRemove={handleHwpRemove}
              onClearAll={handleHwpClearAll}
              onSortByName={handleHwpSortByName}
              onSortBySize={handleHwpSortBySize}
              onReverseOrder={handleHwpReverseOrder}
              onOpenUpload={triggerUploadClick}
              onUnlockPassword={handleUnlockHwpPassword}
            />

            <HwpControls
              outputMode={hwpOutputMode}
              onChangeOutputMode={setHwpOutputMode}
              quality={hwpQuality}
              onChangeQuality={setHwpQuality}
              mergedFileName={hwpMergedFileName}
              onChangeMergedFileName={setHwpMergedFileName}
              onConvert={handleConvertHwp}
              isConverting={isMerging}
              progressPercent={progressPercent}
              currentStep={currentStep}
              filesCount={hwpFiles.length}
              hasLockedFiles={hasLockedHwpFiles}
            />
          </>
        )}

        {/* Security & Privacy Notice */}
        <div className="mt-2 text-center text-xs text-slate-400">
          <p>
            {currentFormat === 'hwp'
              ? `* 모든 한글(.hwp, .hwpx) 파일은 브라우저 내장 WASM 엔진으로 기기 내부에서 직접 PDF로 변환되며, 서버로 업로드되지 않습니다. (1회 최대 ${MAX_HWP_BATCH_FILES}개)`
              : `* 모든 ${activeMergeFormat.toUpperCase()} 파일은 사용자 기기(브라우저) 내부에서 100% 무손실 바이너리로 직접 병합되며, 서버로 업로드되지 않습니다.`}
          </p>
        </div>
      </main>

      {/* Merge Preview & Page Deletion Modal (also used when HWP converts into 1 merged PDF) */}
      {mergeResult && (
        <PreviewModal
          result={mergeResult}
          onClose={handleCloseModal}
          onResetAll={handleResetAll}
          onDeletePages={handleDeleteMergedPages}
          onRestoreOriginal={handleRestoreOriginalMerged}
        />
      )}

      {/* HWP Individual Batch Conversion Result Modal */}
      {hwpBatchResult && (
        <HwpResultModal
          result={hwpBatchResult}
          onClose={handleCloseHwpResultModal}
          onResetAll={handleResetAllHwp}
          onSendToPdfMerger={handleSendConvertedToPdfMerger}
        />
      )}

      {/* Offline Status Indicator */}
      <OfflineIndicator />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="app-toast-message"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium animate-in slide-in-from-bottom-3 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : toastMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : toastMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-indigo-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
}
